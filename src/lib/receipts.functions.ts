import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin, requireWorker } from "./auth.server";
import { logAudit } from "./audit.server";

const adminBase = z.object({ token: z.string() });

const CATEGORIES = ["Materials", "Fuel", "Tools", "Subcontractor", "Permits", "Other"] as const;

// ---------- Internal: AI parse ----------

async function aiParseReceipt(receiptUrl: string, mime: string, jobSites: { id: string; label: string }[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI not configured");

  // Build content block
  const content: any[] = [
    {
      type: "text",
      text:
        "Extract structured data from this receipt. Return ONLY valid JSON matching the schema. " +
        "If a field is illegible, set it to null. Category must be one of: " +
        CATEGORIES.join(", ") + ". " +
        "If the vendor address or name clearly matches one of these job sites, return its id as job_site_id; otherwise null.\n" +
        "Job sites:\n" +
        (jobSites.length ? jobSites.map(j => `- ${j.id}: ${j.label}`).join("\n") : "(none)") +
        "\n\nSchema: { vendor: string|null, date: string|null (YYYY-MM-DD), subtotal: number|null, tax: number|null, total: number|null, category: string|null, job_site_id: string|null, confidence: number (0-1) }",
    },
  ];

  if (mime === "application/pdf") {
    // Fetch and base64 the PDF (Gemini accepts PDF files inline)
    const buf = Buffer.from(await (await fetch(receiptUrl)).arrayBuffer());
    content.unshift({
      type: "file",
      file: { filename: "receipt.pdf", file_data: `data:application/pdf;base64,${buf.toString("base64")}` },
    });
  } else {
    content.unshift({ type: "image_url", image_url: { url: receiptUrl } });
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  return parsed;
}

// ---------- Internal: Sheets sync ----------

const SHEET_COLUMNS = [
  "ID", "Date", "Worker", "Vendor", "Description", "Category", "Job Site",
  "Subtotal", "Tax", "Total", "Reimbursement Amount", "Week Start", "Receipt URL",
  "Material Type", "Billable Client",
];
const SHEET_LAST_COL = "O"; // 15 columns


async function gw(url: string, init?: RequestInit) {
  const lovKey = process.env.LOVABLE_API_KEY!;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY!;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${lovKey}`,
      "X-Connection-Api-Key": connKey,
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Sheets ${res.status}: ${t.slice(0, 300)}`);
  }
  return res;
}

async function ensureTabExists(sheetId: string, tab: string) {
  const metaUrl = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
  const meta: any = await (await gw(metaUrl)).json();
  const titles: string[] = (meta?.sheets || []).map((s: any) => s?.properties?.title).filter(Boolean);
  if (titles.includes(tab)) return;
  await gw(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
  });
}

async function ensureSheetHeader(sheetId: string, tab: string) {
  await ensureTabExists(sheetId, tab);
  const range = `${tab}!A1:M1`;
  const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}`;
  const get: any = await (await gw(url)).json();
  const have = get?.values?.[0] || [];
  if (have.length >= SHEET_COLUMNS.length) return;
  await gw(url + "?valueInputOption=USER_ENTERED", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: [SHEET_COLUMNS] }),
  });
}


export async function syncRowExternal(reimbursementId: string) {
  return syncRow(reimbursementId);
}

async function syncRow(reimbursementId: string) {
  const { data: s } = await supabaseAdmin.from("app_settings")
    .select("google_sheet_id, google_sheet_tab, sheet_sync_enabled").eq("id", 1).single();
  if (!s?.sheet_sync_enabled || !s.google_sheet_id) return { skipped: true };
  const tab = s.google_sheet_tab || "Receipts";

  const { data: r } = await supabaseAdmin.from("reimbursements")
    .select("id, is_admin_receipt, payee_label, description, amount, week_start, receipt_url, parsed_vendor, parsed_date, parsed_subtotal, parsed_tax, parsed_total, parsed_category, parsed_job_site_id, workers(name), job_sites!reimbursements_parsed_job_site_id_fkey(label)")
    .eq("id", reimbursementId).maybeSingle();
  if (!r) return { skipped: true };

  await ensureSheetHeader(s.google_sheet_id, tab);

  const workerCell = r.is_admin_receipt
    ? (r.payee_label || "Admin")
    : ((r as any).workers?.name || "");

  const row = [
    r.id,
    r.parsed_date || "",
    workerCell,
    r.parsed_vendor || "",
    r.description || "",
    r.parsed_category || "",
    (r as any).job_sites?.label || "",
    r.parsed_subtotal ?? "",
    r.parsed_tax ?? "",
    r.parsed_total ?? "",
    r.amount ?? "",
    r.week_start || "",
    r.receipt_url || "",
  ];

  // Find existing row by ID in column A

  const findUrl = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${s.google_sheet_id}/values/${tab}!A:A`;
  const findBody: any = await (await gw(findUrl)).json();
  const col: string[][] = findBody?.values || [];
  let rowIdx = -1;
  for (let i = 1; i < col.length; i++) {
    if (col[i]?.[0] === reimbursementId) { rowIdx = i + 1; break; }
  }

  if (rowIdx > 0) {
    const range = `${tab}!A${rowIdx}:M${rowIdx}`;
    await gw(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${s.google_sheet_id}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    });
  } else {
    await gw(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${s.google_sheet_id}/values/${tab}!A:M:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    });
  }


  await supabaseAdmin.from("reimbursements").update({ sheet_row_id: reimbursementId }).eq("id", reimbursementId);
  return { ok: true };
}

// ---------- Public: parse one receipt (server-internal, called by workers too) ----------

export async function runParseForReimbursement(reimbursementId: string): Promise<void> {
  await supabaseAdmin.from("reimbursements").update({ parse_status: "pending" }).eq("id", reimbursementId);
  try {
    const { data: r } = await supabaseAdmin.from("reimbursements")
      .select("id, receipt_url, receipt_mime").eq("id", reimbursementId).maybeSingle();
    if (!r?.receipt_url) {
      await supabaseAdmin.from("reimbursements").update({ parse_status: "failed" }).eq("id", reimbursementId);
      return;
    }
    const { data: sites } = await supabaseAdmin.from("job_sites")
      .select("id, label").is("archived_at", null).limit(200);
    const parsed = await aiParseReceipt(r.receipt_url, r.receipt_mime || "image/jpeg", sites ?? []);

    const category = CATEGORIES.includes(parsed.category) ? parsed.category : null;
    const jobSiteId = (sites ?? []).some(s => s.id === parsed.job_site_id) ? parsed.job_site_id : null;
    const num = (v: any) => (v == null || v === "" || isNaN(Number(v))) ? null : Number(v);

    await supabaseAdmin.from("reimbursements").update({
      parsed_vendor: parsed.vendor || null,
      parsed_date: parsed.date || null,
      parsed_subtotal: num(parsed.subtotal),
      parsed_tax: num(parsed.tax),
      parsed_total: num(parsed.total),
      parsed_category: category,
      parsed_job_site_id: jobSiteId,
      parse_confidence: num(parsed.confidence),
      parse_raw: parsed,
      parse_status: "ok",
      parsed_at: new Date().toISOString(),
    }).eq("id", reimbursementId);

    try { await syncRow(reimbursementId); } catch (e) { console.error("sheet sync failed", e); }
  } catch (e: any) {
    console.error("parse failed", e);
    await supabaseAdmin.from("reimbursements").update({
      parse_status: "failed",
      parse_raw: { error: String(e?.message || e) },
      parsed_at: new Date().toISOString(),
    }).eq("id", reimbursementId);
  }
}

export const parseReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    await runParseForReimbursement(data.id);
    await logAudit({
      actor: { kind: "admin" }, action: "reimbursement_parse",
      entityType: "reimbursement", entityId: data.id,
    });
    return refreshed;
  });

export const updateParsedReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    id: z.string().uuid(),
    vendor: z.string().max(200).nullable().optional(),
    date: z.string().nullable().optional(),
    subtotal: z.number().nullable().optional(),
    tax: z.number().nullable().optional(),
    total: z.number().nullable().optional(),
    category: z.enum(CATEGORIES).nullable().optional(),
    jobSiteId: z.string().uuid().nullable().optional(),
    materialType: z.enum(["regular", "client_billable"]).optional(),
    billableJobSiteId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const patch: any = { parse_status: "manual", parsed_at: new Date().toISOString() };
    if (data.vendor !== undefined) patch.parsed_vendor = data.vendor;
    if (data.date !== undefined) patch.parsed_date = data.date || null;
    if (data.subtotal !== undefined) patch.parsed_subtotal = data.subtotal;
    if (data.tax !== undefined) patch.parsed_tax = data.tax;
    if (data.total !== undefined) patch.parsed_total = data.total;
    if (data.category !== undefined) patch.parsed_category = data.category;
    if (data.jobSiteId !== undefined) patch.parsed_job_site_id = data.jobSiteId;
    if (data.materialType !== undefined) patch.material_type = data.materialType;
    if (data.billableJobSiteId !== undefined) patch.billable_job_site_id = data.billableJobSiteId;

    // Validate: client-billable must reference a real, active client job site
    const willBeBillable = data.materialType === "client_billable"
      || (data.materialType === undefined && data.billableJobSiteId);
    if (willBeBillable) {
      const targetId = data.billableJobSiteId;
      if (!targetId) {
        // allow clearing material_type back to regular by passing materialType: 'regular'
        // but if marking billable, require a site
        if (data.materialType === "client_billable") throw new Error("Pick a client job site to bill");
      } else {
        const { data: site } = await supabaseAdmin.from("job_sites")
          .select("id, kind, archived_at").eq("id", targetId).maybeSingle();
        if (!site || site.kind !== "client" || site.archived_at) {
          throw new Error("Billable job site must be an active client site");
        }
      }
    }
    // If switching back to regular, clear billable link
    if (data.materialType === "regular") patch.billable_job_site_id = null;

    const { error } = await supabaseAdmin.from("reimbursements").update(patch).eq("id", data.id);
    if (error) throw error;

    await logAudit({
      actor: { kind: "admin" }, action: "reimbursement_edit_parsed",
      entityType: "reimbursement", entityId: data.id, after: patch,
    });

    try { await syncRow(data.id); } catch (e) { console.error("sheet sync failed", e); }
    return refreshed;
  });


// ---------- Sheets settings ----------

export const getSheetSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: s } = await supabaseAdmin.from("app_settings")
      .select("google_sheet_id, google_sheet_tab, sheet_sync_enabled").eq("id", 1).single();
    return { ...refreshed, settings: s, connectorReady: !!process.env.GOOGLE_SHEETS_API_KEY };
  });

export const updateSheetSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    sheetId: z.string().nullable().optional(),
    tab: z.string().min(1).max(100).nullable().optional(),
    enabled: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const patch: any = {};
    if (data.sheetId !== undefined) {
      // Accept full URL or raw ID
      let id = data.sheetId || "";
      const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (m) id = m[1];
      patch.google_sheet_id = id || null;
    }
    if (data.tab !== undefined) patch.google_sheet_tab = data.tab || "Receipts";
    if (data.enabled !== undefined) patch.sheet_sync_enabled = data.enabled;
    const { error } = await supabaseAdmin.from("app_settings").update(patch).eq("id", 1);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" }, action: "sheet_settings_update",
      entityType: "app_settings", after: patch,
    });
    return refreshed;
  });

export const backfillSheet = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: rows } = await supabaseAdmin.from("reimbursements")
      .select("id").not("receipt_url", "is", null).order("created_at", { ascending: true }).limit(500);
    let synced = 0; let failed = 0; let skipped = 0;
    let firstError: string | null = null;
    for (const r of rows ?? []) {
      try {
        const res: any = await syncRow(r.id);
        if (res?.skipped) skipped++; else synced++;
      } catch (e: any) {
        failed++;
        if (!firstError) firstError = String(e?.message || e);
        console.error("backfill row failed", e);
      }
    }
    return { ...refreshed, synced, failed, skipped, firstError };
  });


export const parseUnprocessed = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: rows } = await supabaseAdmin.from("reimbursements")
      .select("id").not("receipt_url", "is", null).is("parse_status", null).limit(50);
    let started = 0;
    for (const r of rows ?? []) {
      // Sequential to avoid rate limits
      try { await runParseForReimbursement(r.id); started++; } catch {}
    }
    return { ...refreshed, processed: started };
  });

// Worker can trigger parse on their own freshly uploaded receipt
export const workerTriggerParse = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const { data: r } = await supabaseAdmin.from("reimbursements")
      .select("worker_id").eq("id", data.id).maybeSingle();
    if (!r || r.worker_id !== wid) throw new Error("Not found");
    await runParseForReimbursement(data.id);
    return { ok: true };
  });

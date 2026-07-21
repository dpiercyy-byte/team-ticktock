import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin, verifyToken } from "./auth.server";
import { parseLedgerJobXlsx } from "./ledger-xlsx";

// Accepts either an admin token or a worker token — Ledger is available to any signed-in user.
function requireAnySession(token: string): "admin" | "worker" {
  const p = verifyToken<{ kind: string }>(token);
  if (p.kind !== "admin" && p.kind !== "worker") {
    throw new Response("Unauthorized", { status: 401 });
  }
  return p.kind as "admin" | "worker";
}

// Only admins may mutate.
function requireAdminOnly(token: string) {
  return requireAdmin(token);
}

const TokenSchema = z.object({ token: z.string() });

export const listLedgerJobs = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    requireAnySession(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("ledger_jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const createLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    address: z.string().min(1).max(300),
    client_name: z.string().max(200).optional().nullable(),
    start_date: z.string().optional().nullable(),
    lead_source: z.string().max(100).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    requireAdminOnly(data.token);
    const record = {
      address: data.address.trim(),
      client_name: data.client_name?.trim() || null,
      start_date: data.start_date || new Date().toISOString().slice(0, 10),
      finish_date: null as string | null,
      lead_source: data.lead_source?.trim() || "unknown",
    };
    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs").insert(record).select("*").single();
    if (error) throw error;
    // Auto-create/link a Clockwise client job_site so hours can be tracked against this job.
    try {
      const { ensureJobSiteForLedgerJob } = await import("./ledger-jobs-sync.server");
      await ensureJobSiteForLedgerJob(row.id);
    } catch { /* non-fatal */ }
    return row;
  });


const LogEntry = z.object({
  date: z.string().nullable().optional(),
  amount: z.number(),
  comment: z.string().optional(),
  category: z.string().optional(),
  vendor: z.string().optional(),
  method: z.string().optional(),
  has_hst: z.boolean().optional(),
});

const JobPatch = z.object({
  // meta — always editable
  lead_source: z.string().optional(),
  payments_received: z.number().optional(),
  finish_date: z.string().nullable().optional(),
  linked_job_site_id: z.string().uuid().nullable().optional(),
  // content — blocked when sheet-linked
  address: z.string().min(1).max(300).optional(),
  client_name: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  total_price: z.number().optional(),
  gross_cash: z.number().optional(),
  gross_with_hst: z.number().optional(),
  finish_materials: z.number().optional(),
  building_materials: z.number().optional(),
  subs: z.number().optional(),
  labor: z.number().optional(),
  price_log: z.array(LogEntry).optional(),
  expense_log: z.array(LogEntry).optional(),
  payments_log: z.array(LogEntry).optional(),
});

const CONTENT_FIELDS = new Set([
  "address", "client_name", "start_date",
  "total_price", "gross_cash", "gross_with_hst",
  "finish_materials", "building_materials", "subs", "labor",
  "price_log", "expense_log", "payments_log",
]);

export const updateLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string(), id: z.string().uuid(), patch: JobPatch }).parse(d))
  .handler(async ({ data }) => {
    requireAdminOnly(data.token);
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.patch)) {
      if (v !== undefined) clean[k] = v;
    }
    if (Object.keys(clean).length === 0) throw new Response("No fields", { status: 400 });

    // Sheet-linked jobs: sheet is source of truth for content fields.
    const touchesContent = Object.keys(clean).some((k) => CONTENT_FIELDS.has(k));
    if (touchesContent) {
      const { data: current } = await supabaseAdmin
        .from("ledger_jobs").select("sheet_id").eq("id", data.id).maybeSingle();
      if ((current as any)?.sheet_id) {
        throw new Response("This job is linked to a Google Sheet. Edit the sheet directly, or unlink it first.", { status: 409 });
      }
    }

    // Recompute net + profit_margin when totals/costs change.
    const recomputeKeys = ["total_price", "finish_materials", "building_materials", "subs", "labor"];
    if (recomputeKeys.some((k) => k in clean)) {
      const { data: cur } = await supabaseAdmin
        .from("ledger_jobs")
        .select("total_price, finish_materials, building_materials, subs, labor")
        .eq("id", data.id).maybeSingle();
      const merged = { ...(cur as any), ...clean } as Record<string, number>;
      const totalP = Number(merged.total_price) || 0;
      const exp = (Number(merged.finish_materials) || 0) + (Number(merged.building_materials) || 0)
        + (Number(merged.subs) || 0) + (Number(merged.labor) || 0);
      (clean as any).net = totalP - exp;
      (clean as any).profit_margin = totalP > 0 ? (totalP - exp) / totalP : 0;
    }

    // If admin explicitly edits labor, respect it and stop auto-syncing labor for this job.
    if ("labor" in clean) (clean as any).labor_manual_override = true;

    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs").update(clean as never).eq("id", data.id).select("*").single();
    if (error) throw error;
    if ((row as any)?.sheet_id && !(row as any)?.finish_date) {
      import("./ledger-sheet-export.server")
        .then((m) => m.pushJobToSheet(data.id).catch(() => {}))
        .catch(() => {});
    }
    // If finish_date was just set, archive the linked Clockwise site.
    if ("finish_date" in clean && (row as any)?.finish_date) {
      try {
        const { archiveLinkedSiteForLedgerJob } = await import("./ledger-jobs-sync.server");
        await archiveLinkedSiteForLedgerJob(data.id);
      } catch { /* non-fatal */ }
    }
    return row;
  });


export const deleteLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    requireAdminOnly(data.token);
    const { error } = await supabaseAdmin.from("ledger_jobs").delete().eq("id", data.id);
    if (error) throw error;
    return { deleted: 1 };
  });


export const uploadLedgerJobXlsx = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    filename: z.string().min(1).max(200),
    base64: z.string().min(1),
    markClosed: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    requireAdminOnly(data.token);
    if (!/\.(xlsx|xlsm)$/i.test(data.filename)) {
      throw new Response("Only .xlsx / .xlsm files are supported", { status: 400 });
    }
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    let parsed;
    try {
      parsed = parseLedgerJobXlsx(bytes, data.filename);
    } catch (e) {
      throw new Response(`Failed to parse xlsx: ${(e as Error).message}`, { status: 400 });
    }

    if (data.markClosed && !parsed.finish_date) {
      parsed.finish_date = parsed.start_date ?? new Date().toISOString().slice(0, 10);
    }

    // Try to auto-link to a Clockwise job_site by address prefix match
    let linked_job_site_id: string | null = null;
    const firstPart = parsed.address.split("(")[0].trim().split(",")[0].trim();
    if (firstPart.length > 4) {
      const { data: sites } = await supabaseAdmin
        .from("job_sites").select("id, label").ilike("label", `%${firstPart}%`).limit(1);
      if (sites && sites.length) linked_job_site_id = sites[0].id;
    }

    // Upsert by address (case-insensitive)
    const { data: existing } = await supabaseAdmin
      .from("ledger_jobs").select("id, linked_job_site_id").ilike("address", parsed.address).maybeSingle();

    const record = { ...parsed, linked_job_site_id: existing?.linked_job_site_id ?? linked_job_site_id };

    let savedRow: any;
    let created = false;
    if (existing) {
      const { data: row, error } = await supabaseAdmin
        .from("ledger_jobs").update(record).eq("id", existing.id).select("*").single();
      if (error) throw error;
      savedRow = row;
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("ledger_jobs").insert(record).select("*").single();
      if (error) throw error;
      savedRow = row;
      created = true;
    }
    // Best-effort: link/create a Clockwise site and archive it if the job is closed.
    try {
      const { ensureJobSiteForLedgerJob, archiveLinkedSiteForLedgerJob } = await import("./ledger-jobs-sync.server");
      if (!parsed.finish_date) await ensureJobSiteForLedgerJob(savedRow.id);
      else await archiveLinkedSiteForLedgerJob(savedRow.id);
    } catch { /* non-fatal */ }
    return { created, job: savedRow };
  });



// Imports the per-job Google Sheet workbooks ("MM/DD ongoing *** Address") into
// Ledger projects. One-way only: the sheet is the source of truth for the rows
// it owns, and every imported row is tagged with its source so anything typed
// into the app is left alone.
import { supabaseAdmin } from "./db.server";
import { findOrCreateClient, findOrCreateProperty } from "./ledger-crm.server";
import {
  addressKey,
  parseFileName,
  parseJobSheet,
  parsedTotals,
  reconciliationWarnings,
  type ParsedJobSheet,
} from "./sheet-jobs-parse";

const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const SHEETS = "https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets";

async function gw(url: string, connKey: string | undefined, init?: RequestInit) {
  const lovKey = process.env.LOVABLE_API_KEY;
  if (!lovKey || !connKey) throw new Error("Google connector not configured");
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
    throw new Error(`Google ${res.status}: ${t.slice(0, 300)}`);
  }
  return res;
}

const drive = (path: string) => gw(`${DRIVE}${path}`, process.env.GOOGLE_DRIVE_API_KEY);
const sheets = (path: string) => gw(`${SHEETS}${path}`, process.env.GOOGLE_SHEETS_API_KEY);

const dollarsToCents = (n: number) => Math.round(n * 100);

export type SheetJobSource = {
  id: string;
  fileId: string;
  fileName: string;
  address: string | null;
  startLabel: string | null;
  ongoing: boolean;
  projectId: string | null;
  matchMode: string;
  status: string;
  warnings: string[];
  lastError: string | null;
  sheetTotals: Record<string, number | null> | null;
  lastSyncedAt: string | null;
  driveModifiedAt: string | null;
};

const rowToSource = (r: Record<string, any>): SheetJobSource => ({
  id: r.id,
  fileId: r.file_id,
  fileName: r.file_name,
  address: r.address ?? null,
  startLabel: r.start_label ?? null,
  ongoing: !!r.ongoing,
  projectId: r.project_id ?? null,
  matchMode: r.match_mode ?? "auto",
  status: r.status ?? "pending",
  warnings: Array.isArray(r.warnings) ? r.warnings : [],
  lastError: r.last_error ?? null,
  sheetTotals: r.sheet_totals ?? null,
  lastSyncedAt: r.last_synced_at ?? null,
  driveModifiedAt: r.drive_modified_at ?? null,
});

export async function listSources(): Promise<SheetJobSource[]> {
  const { data, error } = await supabaseAdmin
    .from("sheet_job_sources")
    .select("*")
    .order("ongoing", { ascending: false })
    .order("file_name");
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, any>>).map(rowToSource);
}

/* ---------------- discovery ---------------- */

type DriveFile = { id: string; name: string; modifiedTime?: string };

export async function discoverSheets(): Promise<{ found: number; tracked: number }> {
  const q = encodeURIComponent(
    "name contains 'ongoing' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
  );
  const res = await drive(
    `/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=200&orderBy=name`,
  );
  const body = (await res.json()) as { files?: DriveFile[] };
  const files = body.files ?? [];

  for (const f of files) {
    const meta = parseFileName(f.name);
    if (meta.isCopy) continue;
    await supabaseAdmin.from("sheet_job_sources").upsert(
      {
        file_id: f.id,
        file_name: f.name,
        address: meta.address || null,
        start_label: meta.startLabel,
        ongoing: meta.ongoing,
        drive_modified_at: f.modifiedTime ?? null,
      },
      { onConflict: "file_id" },
    );
  }

  // Files we already track stay tracked after a rename — refresh their name so
  // we notice when "ongoing" is dropped (the job is finished).
  const existing = await listSources();
  const seen = new Set(files.map((f) => f.id));
  for (const src of existing) {
    if (seen.has(src.fileId)) continue;
    try {
      const r = await drive(`/files/${src.fileId}?fields=id,name,modifiedTime,trashed`);
      const f = (await r.json()) as DriveFile & { trashed?: boolean };
      const meta = parseFileName(f.name);
      await supabaseAdmin
        .from("sheet_job_sources")
        .update({
          file_name: f.name,
          ongoing: meta.ongoing && !f.trashed,
          address: meta.address || src.address,
          drive_modified_at: f.modifiedTime ?? null,
        })
        .eq("id", src.id);
    } catch {
      /* file removed or no longer shared — leave the record as-is */
    }
  }

  const tracked = (await listSources()).length;
  return { found: files.length, tracked };
}

/* ---------------- matching ---------------- */

async function matchProject(address: string): Promise<string | null> {
  const key = addressKey(address);
  if (!key) return null;
  const { data, error } = await supabaseAdmin
    .from("ledger_jobs")
    .select("id, address, name")
    .is("archived_at", null);
  if (error) throw error;
  const hit = (data ?? []).find((j: any) => addressKey(j.address ?? "") === key);
  return hit ? (hit as any).id : null;
}

async function createProjectFromSheet(
  address: string,
  parsed: ParsedJobSheet,
): Promise<string> {
  const clientName = parsed.clientName?.trim() || address;
  const clientId = await findOrCreateClient({ name: clientName });
  const propertyId = await findOrCreateProperty(clientId, { address });
  const lastName = clientName.split(/\s+/).slice(-1)[0];
  const contract = parsed.priceLines.reduce((s, p) => s + p.amount, 0);

  const { data: created, error } = await supabaseAdmin
    .from("ledger_jobs")
    .insert({
      name: `${lastName} renovation`,
      client_name: clientName,
      address,
      client_id: clientId,
      property_id: propertyId,
      project_type: "renovation",
      trades: [],
      status: "active",
      sales_stage: "won",
      delivery_status: "in_progress",
      budget_cents: dollarsToCents(contract),
      estimated_value_cents: dollarsToCents(contract),
      expected_start_date: parsed.startDate,
      actual_start_date: parsed.startDate,
      expected_completion_date: parsed.finishDate,
      activated_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (error) throw error;

  await supabaseAdmin.from("ledger_job_events").insert({
    job_id: created.id,
    kind: "created",
    title: "Job created from Google Sheet",
  });
  return created.id as string;
}

/* ---------------- import ---------------- */

async function fetchValues(fileId: string): Promise<unknown[][]> {
  // No tab name → the API reads the first sheet, which is where every job
  // workbook keeps its data.
  const res = await sheets(`/${fileId}/values/A1:P400?valueRenderOption=FORMATTED_VALUE`);
  const body = (await res.json()) as { values?: unknown[][] };
  return body.values ?? [];
}

export async function syncSource(
  sourceId: string,
): Promise<{ ok: boolean; projectId: string | null; warnings: string[]; error?: string }> {
  const { data: row, error } = await supabaseAdmin
    .from("sheet_job_sources")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Response("Not found", { status: 404 });
  const src = rowToSource(row as Record<string, any>);

  try {
    const yearHint = new Date().getUTCFullYear();
    const parsed = parseJobSheet(await fetchValues(src.fileId), yearHint);
    const warnings = [...parsed.warnings, ...reconciliationWarnings(parsed)];

    const address = src.address || parsed.clientName || "";
    let projectId = src.projectId;
    if (!projectId && address) projectId = await matchProject(address);
    let matchMode = src.projectId ? src.matchMode : projectId ? "auto" : "created";
    if (!projectId) {
      if (!address) throw new Error("No address could be read from the file name.");
      projectId = await createProjectFromSheet(address, parsed);
      matchMode = "created";
    }

    await writeSheetRows(projectId, src.fileId, parsed);

    const totals = parsedTotals(parsed);
    await supabaseAdmin
      .from("sheet_job_sources")
      .update({
        project_id: projectId,
        match_mode: matchMode,
        status: warnings.length > 0 ? "warning" : "synced",
        warnings,
        last_error: null,
        sheet_totals: { ...totals, sheetLabour: parsed.sheetTotals.labour },
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", src.id);

    return { ok: true, projectId, warnings };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("sheet_job_sources")
      .update({ status: "error", last_error: message.slice(0, 500) })
      .eq("id", src.id);
    return { ok: false, projectId: src.projectId, warnings: [], error: message };
  }
}

/** Replace only the rows this file owns; app-entered rows keep source='manual'. */
async function writeSheetRows(projectId: string, fileId: string, parsed: ParsedJobSheet) {
  const source = `sheet:${fileId}`;

  for (const table of ["project_payments", "project_costs", "project_change_orders"] as const) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("project_id", projectId)
      .eq("source", source);
    if (error) throw error;
  }

  if (parsed.payments.length > 0) {
    const rows = parsed.payments.map((p) => ({
      project_id: projectId,
      description: p.method ? `Payment (${p.method})` : "Payment",
      amount_expected_cents: dollarsToCents(p.amount),
      amount_received_cents: dollarsToCents(p.amount),
      due_date: p.date,
      received_date: p.date,
      method: p.method,
      notes: "Imported from job sheet",
      source,
      source_key: p.key,
    }));
    const { error } = await supabaseAdmin.from("project_payments").insert(rows as never);
    if (error) throw error;
  }

  // Sheet labour rows are deliberately not imported as costs: labour is owned by
  // Clockwise time entries and importing both would double-count it.
  const costRows = parsed.costs
    .filter((c) => c.category !== "labour")
    .map((c) => ({
      project_id: projectId,
      category: c.category,
      description: c.description,
      vendor: null,
      amount_cents: dollarsToCents(c.amount),
      incurred_on: c.date,
      client_billable: false,
      notes: "Imported from job sheet",
      source,
      source_key: c.key,
    }));
  if (costRows.length > 0) {
    const { error } = await supabaseAdmin.from("project_costs").insert(costRows as never);
    if (error) throw error;
  }

  // First price line is the contract; the rest are approved change orders.
  const [base, ...extras] = parsed.priceLines;
  if (base) {
    const { error } = await supabaseAdmin
      .from("ledger_jobs")
      .update({ budget_cents: dollarsToCents(base.amount) })
      .eq("id", projectId);
    if (error) throw error;
  }
  if (extras.length > 0) {
    const rows = extras.map((p) => ({
      project_id: projectId,
      description: p.description,
      amount_cents: dollarsToCents(p.amount),
      status: "approved",
      approved_date: null,
      notes: "Imported from job sheet",
      source,
      source_key: p.key,
    }));
    const { error } = await supabaseAdmin.from("project_change_orders").insert(rows as never);
    if (error) throw error;
  }
}

export async function syncAll(): Promise<{
  synced: number;
  failed: number;
  results: Array<{ fileName: string; ok: boolean; error?: string; warnings: string[] }>;
}> {
  await discoverSheets();
  const sources = (await listSources()).filter((s) => s.ongoing);
  const results: Array<{ fileName: string; ok: boolean; error?: string; warnings: string[] }> = [];
  for (const s of sources) {
    const r = await syncSource(s.id);
    results.push({ fileName: s.fileName, ok: r.ok, error: r.error, warnings: r.warnings });
  }
  await supabaseAdmin
    .from("app_settings")
    .update({ sheet_jobs_last_sync_at: new Date().toISOString() })
    .eq("id", 1);
  return {
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export async function getSyncSettings(): Promise<{ enabled: boolean; lastSyncAt: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("sheet_jobs_sync_enabled, sheet_jobs_last_sync_at")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return {
    enabled: !!(data as any)?.sheet_jobs_sync_enabled,
    lastSyncAt: (data as any)?.sheet_jobs_last_sync_at ?? null,
  };
}

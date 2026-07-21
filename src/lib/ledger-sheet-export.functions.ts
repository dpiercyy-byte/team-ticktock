import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";

const adminBase = z.object({ token: z.string() });

function parseSheetId(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const m = raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : raw;
}

export const setJobSheet = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ jobId: z.string().uuid(), url: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const sheetId = parseSheetId(data.url) || null;
    const { error } = await supabaseAdmin
      .from("ledger_jobs")
      .update({ sheet_id: sheetId, sheet_last_sync_at: null } as never)
      .eq("id", data.jobId);
    if (error) throw error;
    return { ...refreshed, sheetId };
  });

export const pushJobToSheetFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { pushJobToSheet } = await import("./ledger-sheet-export.server");
    const r = await pushJobToSheet(data.jobId);
    return { ...refreshed, ...r };
  });

export const pullJobFromSheetFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { pullJobFromSheet } = await import("./ledger-sheet-export.server");
    const r = await pullJobFromSheet(data.jobId);
    return { ...refreshed, ...r };
  });

// List recently synced sheet-linked Ledger jobs — used by the /ledger "Recent sheets" picker.
export const listRecentSheetJobs = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("ledger_jobs")
      .select("id, address, client_name, sheet_id, sheet_last_sync_at, finish_date, updated_at")
      .not("sheet_id", "is", null)
      .order("sheet_last_sync_at", { ascending: false, nullsFirst: false })
      .limit(12);
    if (error) throw error;
    return rows ?? [];
  });

// Open (or create) a Ledger job for a given Google Sheet URL, then pull.
export const openLedgerJobFromSheet = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ url: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const sheetId = parseSheetId(data.url);
    if (!sheetId) throw new Response("Invalid Google Sheet URL", { status: 400 });

    // Reuse if a Ledger job already points at this sheet.
    const { data: existing } = await supabaseAdmin
      .from("ledger_jobs").select("id").eq("sheet_id", sheetId).maybeSingle();
    let jobId = existing?.id as string | undefined;

    if (!jobId) {
      const placeholder = `Sheet ${sheetId.slice(0, 8)}`;
      const { data: inserted, error } = await supabaseAdmin
        .from("ledger_jobs")
        .insert({
          address: placeholder,
          start_date: new Date().toISOString().slice(0, 10),
          lead_source: "unknown",
          sheet_id: sheetId,
        })
        .select("id").single();
      if (error) throw error;
      jobId = inserted.id;
    }

    try {
      const { pullJobFromSheet } = await import("./ledger-sheet-export.server");
      await pullJobFromSheet(jobId!);
    } catch (e: any) {
      return { jobId, sheetId, pulled: false, error: e?.message || String(e) };
    }
    return { jobId, sheetId, pulled: true };
  });

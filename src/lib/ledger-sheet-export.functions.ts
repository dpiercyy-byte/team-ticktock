import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";

const adminBase = z.object({ token: z.string() });

export const getLedgerExportSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: s } = await supabaseAdmin
      .from("app_settings")
      .select("ledger_export_sheet_id, ledger_export_last_sync_at")
      .eq("id", 1)
      .single();
    return {
      ...refreshed,
      settings: s,
      connectorReady: !!process.env.GOOGLE_SHEETS_API_KEY,
    };
  });

export const updateLedgerExportSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ sheetId: z.string().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let id = data.sheetId || "";
    const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m) id = m[1];
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ ledger_export_sheet_id: id || null } as never)
      .eq("id", 1);
    if (error) throw error;
    return refreshed;
  });

export const runLedgerSheetExportFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { runLedgerSheetExport } = await import("./ledger-sheet-export.server");
    const result = await runLedgerSheetExport();
    return { ...refreshed, ...result };
  });

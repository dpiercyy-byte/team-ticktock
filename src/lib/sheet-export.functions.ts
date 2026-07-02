import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";

const adminBase = z.object({ token: z.string() });

export const getWorkerExportSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: s } = await supabaseAdmin
      .from("app_settings")
      .select("worker_export_sheet_id, worker_export_last_sync_at")
      .eq("id", 1)
      .single();
    return {
      ...refreshed,
      settings: s,
      connectorReady: !!process.env.GOOGLE_SHEETS_API_KEY,
    };
  });

export const updateWorkerExportSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({ sheetId: z.string().nullable() }).parse(d)
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let id = data.sheetId || "";
    const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m) id = m[1];
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ worker_export_sheet_id: id || null })
      .eq("id", 1);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "worker_export_settings_update",
      entityType: "app_settings",
      after: { worker_export_sheet_id: id || null },
    });
    return refreshed;
  });

export const runWorkerSheetExportFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { runWorkerSheetExport } = await import("./sheet-export.server");
    const result = await runWorkerSheetExport();
    await logAudit({
      actor: { kind: "admin" },
      action: "worker_export_run",
      entityType: "app_settings",
      after: result,
    });
    return { ...refreshed, ...result };
  });

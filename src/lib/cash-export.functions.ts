import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";

const adminBase = z.object({ token: z.string() });

export const getCashExportSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: s } = await supabaseAdmin
      .from("app_settings")
      .select("cash_export_sheet_id, cash_export_tab, cash_export_enabled")
      .eq("id", 1)
      .single();
    return {
      ...refreshed,
      settings: s,
      connectorReady: !!process.env.GOOGLE_SHEETS_API_KEY,
    };
  });

export const updateCashExportSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        sheetId: z.string().nullable(),
        tab: z.string().min(1),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let id = data.sheetId || "";
    const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m) id = m[1];
    const after = {
      cash_export_sheet_id: id || null,
      cash_export_tab: data.tab.trim(),
      cash_export_enabled: data.enabled,
    };
    const { error } = await supabaseAdmin.from("app_settings").update(after).eq("id", 1);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "cash_export_settings_update",
      entityType: "app_settings",
      after,
    });
    return refreshed;
  });

export const testCashExportFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { testCashExport } = await import("./cash-export.server");
    try {
      const result = await testCashExport();
      return { ...refreshed, ok: true as const, ...result };
    } catch (e: any) {
      return { ...refreshed, ok: false as const, error: e?.message || String(e) };
    }
  });

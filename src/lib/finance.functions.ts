import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";

const adminBase = z.object({ token: z.string() });

const CHANGE_ORDER_STATUS = ["draft", "approved", "rejected"] as const;
const COST_CATEGORIES = ["subcontractor", "permit", "other"] as const;

/* ---------------- Change orders ---------------- */

export const saveChangeOrder = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        id: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid(),
        description: z.string().trim().min(1).max(200),
        amount: z.number(),
        status: z.enum(CHANGE_ORDER_STATUS),
        approvedDate: z.string().nullable(),
        notes: z.string().trim().max(500).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const row = {
      project_id: data.projectId,
      description: data.description,
      amount_cents: Math.round(data.amount * 100),
      status: data.status,
      approved_date: data.status === "approved" ? data.approvedDate || null : null,
      notes: data.notes || null,
    };

    let before: unknown = null;
    if (data.id) {
      const { data: prev } = await supabaseAdmin
        .from("project_change_orders")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      before = prev ?? null;
      const { error } = await supabaseAdmin
        .from("project_change_orders")
        .update(row)
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("project_change_orders").insert(row);
      if (error) throw error;
    }

    await logAudit({
      actor: { kind: "admin" },
      action: data.id ? "change_order_update" : "change_order_create",
      entityType: "project_change_order",
      entityId: data.id ?? data.projectId,
      before,
      after: row,
    });
    return refreshed;
  });

export const deleteChangeOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: before } = await supabaseAdmin
      .from("project_change_orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("project_change_orders")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "change_order_delete",
      entityType: "project_change_order",
      entityId: data.id,
      before: before ?? null,
    });
    return refreshed;
  });

/* ---------------- Project costs ---------------- */

export const saveProjectCost = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        id: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid(),
        category: z.enum(COST_CATEGORIES),
        description: z.string().trim().min(1).max(200),
        vendor: z.string().trim().max(120).nullable(),
        amount: z.number().min(0),
        incurredOn: z.string().nullable(),
        clientBillable: z.boolean(),
        notes: z.string().trim().max(500).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const row = {
      project_id: data.projectId,
      category: data.category,
      description: data.description,
      vendor: data.vendor || null,
      amount_cents: Math.round(data.amount * 100),
      incurred_on: data.incurredOn || null,
      client_billable: data.clientBillable,
      notes: data.notes || null,
    };

    let before: unknown = null;
    if (data.id) {
      const { data: prev } = await supabaseAdmin
        .from("project_costs")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      before = prev ?? null;
      const { error } = await supabaseAdmin.from("project_costs").update(row).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("project_costs").insert(row);
      if (error) throw error;
    }

    await logAudit({
      actor: { kind: "admin" },
      action: data.id ? "project_cost_update" : "project_cost_create",
      entityType: "project_cost",
      entityId: data.id ?? data.projectId,
      before,
      after: row,
    });
    return refreshed;
  });

export const deleteProjectCost = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: before } = await supabaseAdmin
      .from("project_costs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("project_costs").delete().eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "project_cost_delete",
      entityType: "project_cost",
      entityId: data.id,
      before: before ?? null,
    });
    return refreshed;
  });

/* ---------------- Project summary export ---------------- */

export const getProjectSummaryExportSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: s } = await supabaseAdmin
      .from("app_settings")
      .select("project_summary_sheet_id, project_summary_last_sync_at")
      .eq("id", 1)
      .single();
    return {
      ...refreshed,
      settings: s,
      connectorReady: !!process.env.GOOGLE_SHEETS_API_KEY,
    };
  });

export const updateProjectSummaryExportSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ sheetId: z.string().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let id = data.sheetId || "";
    const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m) id = m[1];
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ project_summary_sheet_id: id || null })
      .eq("id", 1);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "project_summary_export_settings_update",
      entityType: "app_settings",
      after: { project_summary_sheet_id: id || null },
    });
    return refreshed;
  });

export const runProjectSummaryExportFn = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { runProjectSummaryExport } = await import("./finance-export.server");
    const result = await runProjectSummaryExport();
    await logAudit({
      actor: { kind: "admin" },
      action: "project_summary_export_run",
      entityType: "app_settings",
      after: result,
    });
    return { ...refreshed, ...result };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";
import { supabaseAdmin } from "./db.server";
import {
  discoverSheets,
  getSyncSettings,
  listSources,
  syncAll,
  syncSource,
} from "./sheet-jobs.server";

const adminBase = z.object({ token: z.string() });

export const listSheetJobSources = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const [sources, settings] = await Promise.all([listSources(), getSyncSettings()]);
    return { ...refreshed, sources, settings };
  });

export const discoverSheetJobs = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const result = await discoverSheets();
    return { ...refreshed, ...result, sources: await listSources() };
  });

export const syncSheetJobs = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const result = await syncAll();
    await logAudit({
      actor: { kind: "admin" },
      action: "sheet_jobs_sync",
      entityType: "sheet_job_sources",
      after: { synced: result.synced, failed: result.failed },
    });
    return { ...refreshed, ...result, sources: await listSources() };
  });

export const syncSheetJob = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const result = await syncSource(data.id);
    return { ...refreshed, ...result, sources: await listSources() };
  });

export const linkSheetJob = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({ id: z.string().uuid(), projectId: z.string().uuid().nullable() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("sheet_job_sources")
      .update({
        project_id: data.projectId,
        match_mode: data.projectId ? "manual" : "auto",
        status: "pending",
      })
      .eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "sheet_job_link",
      entityType: "sheet_job_source",
      entityId: data.id,
      after: { projectId: data.projectId },
    });
    return { ...refreshed, sources: await listSources() };
  });

export const setSheetJobsSyncEnabled = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ sheet_jobs_sync_enabled: data.enabled })
      .eq("id", 1);
    if (error) throw error;
    return { ...refreshed, settings: await getSyncSettings() };
  });

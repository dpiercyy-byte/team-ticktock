import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireWorker, requireAdmin } from "./auth.server";
import { resolveSite } from "./geo.server";
import { logAudit } from "./audit.server";




const FOURTEEN_HOURS_MS = 14 * 60 * 60 * 1000;

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun
  x.setDate(x.getDate() - day);
  return x;
}

function hoursBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600_000;
}

// === Worker ===

export const getWorkerState = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const wkStart = startOfWeek(now);

    const [{ data: active }, { data: weekRows }, { data: worker }, { data: settings }] =
      await Promise.all([
        supabaseAdmin.from("time_entries").select("id, clock_in, project, geo_status, offsite_reason_code")
          .eq("worker_id", wid).is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle(),
        supabaseAdmin.from("time_entries").select("clock_in, clock_out")
          .eq("worker_id", wid).gte("clock_in", wkStart.toISOString()),
        supabaseAdmin.from("workers").select("name, hourly_rate").eq("id", wid).single(),
        supabaseAdmin.from("app_settings").select("project_tracking_enabled, show_pay_estimates").eq("id", 1).single(),
      ]);

    let todayHours = 0, weekHours = 0;
    for (const r of weekRows ?? []) {
      const end = r.clock_out ?? now.toISOString();
      const h = hoursBetween(r.clock_in, end);
      weekHours += h;
      if (new Date(r.clock_in) >= dayStart) todayHours += h;
    }

    return {
      worker,
      active,
      todayHours,
      weekHours,
      settings,
    };
  });

export const clockIn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    project: z.string().trim().max(100).optional(),
    lat: z.number().finite().optional().nullable(),
    lng: z.number().finite().optional().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const { data: existing } = await supabaseAdmin
      .from("time_entries").select("id").eq("worker_id", wid).is("clock_out", null).maybeSingle();
    if (existing) throw new Response("Already clocked in", { status: 400 });
    const geo = await resolveSite(data.lat, data.lng);
    const nowISO = new Date().toISOString();
    const { data: inserted, error } = await supabaseAdmin.from("time_entries").insert({
      worker_id: wid,
      clock_in: nowISO,
      project: data.project || geo.siteLabel || null,
      created_by: "worker",
      clock_in_lat: data.lat ?? null,
      clock_in_lng: data.lng ?? null,
      job_site_id: geo.jobSiteId,
      geo_status: geo.status,
    }).select("id").single();
    if (error) throw error;
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "clock_in",
      entityType: "time_entry",
      entityId: inserted?.id,
      after: { clock_in: nowISO, job_site_id: geo.jobSiteId, geo_status: geo.status, project: data.project || geo.siteLabel || null },
    });
    const needsReason = geo.status === "off_site" || geo.status === "no_gps";
    return { ok: true, geo, entryId: inserted?.id, needsReason };
  });

export const clockOut = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    lat: z.number().finite().optional().nullable(),
    lng: z.number().finite().optional().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const { data: active } = await supabaseAdmin
      .from("time_entries").select("id, clock_in, job_site_id, geo_status").eq("worker_id", wid).is("clock_out", null).maybeSingle();
    if (!active) throw new Response("Not clocked in", { status: 400 });
    const now = new Date();
    const flagged = now.getTime() - new Date(active.clock_in).getTime() > FOURTEEN_HOURS_MS;
    const geo = await resolveSite(data.lat, data.lng);
    const { error } = await supabaseAdmin.from("time_entries")
      .update({
        clock_out: now.toISOString(),
        flagged_review: flagged,
        clock_out_lat: data.lat ?? null,
        clock_out_lng: data.lng ?? null,
      })
      .eq("id", active.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "clock_out",
      entityType: "time_entry",
      entityId: active.id,
      after: { clock_out: now.toISOString(), flagged_review: flagged },
      metadata: { hours: (now.getTime() - new Date(active.clock_in).getTime()) / 3600_000 },
    });
    const needsReason = geo.status === "off_site" || geo.status === "no_gps";
    return { ok: true, geo, entryId: active.id, needsReason };
  });


const REASON_CODES = ["material_pickup", "client_visit", "travel", "forgot_clockout", "new_site", "other"] as const;

export const workerSetEntryReason = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    entryId: z.string().uuid(),
    code: z.enum(REASON_CODES).nullable(),
    note: z.string().trim().max(200).nullable().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const { data: row, error: e0 } = await supabaseAdmin
      .from("time_entries")
      .select("id, worker_id, offsite_reason_code, offsite_reason_note")
      .eq("id", data.entryId).maybeSingle();
    if (e0) throw e0;
    if (!row || row.worker_id !== wid) throw new Response("Not found", { status: 404 });
    const note = data.note?.trim() || null;
    const { error } = await supabaseAdmin.from("time_entries")
      .update({ offsite_reason_code: data.code, offsite_reason_note: note })
      .eq("id", data.entryId);
    if (error) throw error;
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "entry_reason_set",
      entityType: "time_entry",
      entityId: data.entryId,
      before: { offsite_reason_code: row.offsite_reason_code, offsite_reason_note: row.offsite_reason_note },
      after: { offsite_reason_code: data.code, offsite_reason_note: note },
    });
    return { ok: true };
  });


// === Admin ===


const adminBase = z.object({ token: z.string() });

export const adminListEntries = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    workerId: z.string().uuid(),
    from: z.string().optional(),
    to: z.string().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let q = supabaseAdmin.from("time_entries")
      .select("id, clock_in, clock_out, project, created_by, flagged_review, geo_status, offsite_reason_code, offsite_reason_note, job_site_id, job_sites(label, kind, archived_at)")
      .eq("worker_id", data.workerId).order("clock_in", { ascending: false });

    if (data.from) q = q.gte("clock_in", data.from);
    if (data.to) q = q.lte("clock_in", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { ...refreshed, entries: rows ?? [] };
  });

async function checkOverlap(workerId: string, clockInISO: string, clockOutISO: string | null, excludeId?: string) {
  // Overlap if existing.clock_in < newOut AND (existing.clock_out IS NULL OR existing.clock_out > newIn)
  const { data: rows } = await supabaseAdmin.from("time_entries")
    .select("id, clock_in, clock_out").eq("worker_id", workerId);
  const newIn = new Date(clockInISO).getTime();
  const newOut = clockOutISO ? new Date(clockOutISO).getTime() : Infinity;
  for (const r of rows ?? []) {
    if (excludeId && r.id === excludeId) continue;
    const a = new Date(r.clock_in).getTime();
    const b = r.clock_out ? new Date(r.clock_out).getTime() : Infinity;
    if (a < newOut && b > newIn) return true;
  }
  return false;
}

export const adminAddEntry = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    workerId: z.string().uuid(),
    clockIn: z.string(),
    clockOut: z.string(),
    project: z.string().trim().max(100).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    if (new Date(data.clockOut) <= new Date(data.clockIn))
      throw new Response("Clock out must be after clock in", { status: 400 });
    if (await checkOverlap(data.workerId, data.clockIn, data.clockOut))
      throw new Response("Entry overlaps an existing one", { status: 400 });
    const flagged = new Date(data.clockOut).getTime() - new Date(data.clockIn).getTime() > FOURTEEN_HOURS_MS;
    const { data: inserted, error } = await supabaseAdmin.from("time_entries").insert({
      worker_id: data.workerId,
      clock_in: data.clockIn,
      clock_out: data.clockOut,
      project: data.project || null,
      created_by: "admin",
      flagged_review: flagged,
    }).select("id").single();
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_create",
      entityType: "time_entry",
      entityId: inserted?.id,
      after: { worker_id: data.workerId, clock_in: data.clockIn, clock_out: data.clockOut, project: data.project ?? null, flagged_review: flagged },
    });
    return refreshed;
  });

export const adminEditEntry = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    entryId: z.string().uuid(),
    clockIn: z.string(),
    clockOut: z.string().nullable(),
    project: z.string().trim().max(100).nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row, error: e1 } = await supabaseAdmin
      .from("time_entries").select("worker_id, clock_in, clock_out, project, flagged_review").eq("id", data.entryId).single();
    if (e1) throw e1;
    if (data.clockOut && new Date(data.clockOut) <= new Date(data.clockIn))
      throw new Response("Clock out must be after clock in", { status: 400 });
    if (await checkOverlap(row.worker_id, data.clockIn, data.clockOut, data.entryId))
      throw new Response("Entry overlaps an existing one", { status: 400 });
    const flagged = data.clockOut
      ? new Date(data.clockOut).getTime() - new Date(data.clockIn).getTime() > FOURTEEN_HOURS_MS
      : false;
    const { error } = await supabaseAdmin.from("time_entries")
      .update({ clock_in: data.clockIn, clock_out: data.clockOut, project: data.project, flagged_review: flagged })
      .eq("id", data.entryId);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_edit",
      entityType: "time_entry",
      entityId: data.entryId,
      before: { clock_in: row.clock_in, clock_out: row.clock_out, project: row.project, flagged_review: row.flagged_review },
      after: { clock_in: data.clockIn, clock_out: data.clockOut, project: data.project, flagged_review: flagged },
    });
    return refreshed;
  });

export const adminDeleteEntry = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row } = await supabaseAdmin
      .from("time_entries").select("worker_id, clock_in, clock_out, project, geo_status, job_site_id").eq("id", data.entryId).maybeSingle();
    const { error } = await supabaseAdmin.from("time_entries").delete().eq("id", data.entryId);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_delete",
      entityType: "time_entry",
      entityId: data.entryId,
      before: row ?? undefined,
    });
    return refreshed;
  });

export const adminUpdateEntryGeo = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    entryId: z.string().uuid(),
    status: z.enum(["verified", "supplier", "off_site", "no_gps"]),
    jobSiteId: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    if ((data.status === "verified" || data.status === "supplier") && !data.jobSiteId) {
      throw new Response("Job site required for this status", { status: 400 });
    }
    const { data: prev } = await supabaseAdmin
      .from("time_entries").select("geo_status, job_site_id, job_sites(label)").eq("id", data.entryId).maybeSingle();
    const newJobSiteId = data.status === "verified" || data.status === "supplier" ? data.jobSiteId : null;
    let newLabel: string | null = null;
    if (newJobSiteId) {
      const { data: s } = await supabaseAdmin.from("job_sites").select("label").eq("id", newJobSiteId).maybeSingle();
      newLabel = s?.label ?? null;
    }
    const { error } = await supabaseAdmin.from("time_entries")
      .update({ geo_status: data.status, job_site_id: newJobSiteId })
      .eq("id", data.entryId);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_geo_update",
      entityType: "time_entry",
      entityId: data.entryId,
      before: { geo_status: prev?.geo_status ?? null, job_site_id: prev?.job_site_id ?? null, job_site_label: (prev as any)?.job_sites?.label ?? null },
      after: { geo_status: data.status, job_site_id: newJobSiteId, job_site_label: newLabel },
    });
    return refreshed;
  });

export const adminFlaggedEntries = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("time_entries")
      .select("id, worker_id, clock_in, clock_out, project, workers(name)")
      .eq("flagged_review", true)
      .order("clock_in", { ascending: false });
    if (error) throw error;
    return { ...refreshed, entries: rows ?? [] };
  });

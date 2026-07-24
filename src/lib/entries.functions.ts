import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireWorker, requireAdmin } from "./auth.server";
import { resolveSite, type GeoStatus } from "./geo.server";
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

function resolvedClockOutTag(
  geo: { status: string | null; jobSiteId: string | null },
  fallback: { geo_status: string | null; job_site_id: string | null },
) : { status: GeoStatus; jobSiteId: string | null } {
  const resolvedStatus = geo.status ?? null;
  const hasUsableResolvedTag =
    resolvedStatus === "verified" ||
    resolvedStatus === "supplier" ||
    resolvedStatus === "off_site";
  return {
    status: hasUsableResolvedTag ? resolvedStatus : (fallback.geo_status as GeoStatus | null) ?? "no_gps",
    jobSiteId: hasUsableResolvedTag ? geo.jobSiteId : fallback.job_site_id ?? null,
  };
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
        supabaseAdmin.from("time_entries")
          .select("id, clock_in, project, geo_status, offsite_reason_code, planned_job_site_id, planned_job:job_sites!planned_job_site_id(label)")
          .eq("worker_id", wid).is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle(),
        supabaseAdmin.from("time_entries").select("clock_in, clock_out")
          .eq("worker_id", wid).gte("clock_in", wkStart.toISOString()),
        supabaseAdmin.from("workers").select("name, hourly_rate").eq("id", wid).single(),
        supabaseAdmin.from("app_settings").select("project_tracking_enabled, show_pay_estimates").eq("id", 1).single(),
      ]);

    let todayHours = 0, weekHours = 0;
    for (const r of weekRows ?? []) {
      if (!r.clock_out) continue; // open entry; live session hours added on client
      const h = hoursBetween(r.clock_in, r.clock_out);
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


// Accept a client-captured timestamp for offline queue replay. Clamp to a sane
// window so a wonky device clock can't backdate / future-date entries.
function resolveClientTimestamp(raw?: string | null): { iso: string; backdated: boolean } {
  const now = Date.now();
  if (!raw) return { iso: new Date(now).toISOString(), backdated: false };
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return { iso: new Date(now).toISOString(), backdated: false };
  const MAX_PAST = 24 * 60 * 60 * 1000; // 24h
  const MAX_FUTURE = 2 * 60 * 1000;     // 2m
  if (t > now + MAX_FUTURE) return { iso: new Date(now).toISOString(), backdated: false };
  if (now - t > MAX_PAST) return { iso: new Date(now).toISOString(), backdated: false };
  if (Math.abs(now - t) < 5_000) return { iso: new Date(now).toISOString(), backdated: false };
  return { iso: new Date(t).toISOString(), backdated: true };
}

export const clockIn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    project: z.string().trim().max(100).optional(),
    lat: z.number().finite().optional().nullable(),
    lng: z.number().finite().optional().nullable(),
    plannedJobSiteId: z.string().uuid().nullable().optional(),
    clientTimestamp: z.string().datetime().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const { data: existing } = await supabaseAdmin
      .from("time_entries").select("id").eq("worker_id", wid).is("clock_out", null).maybeSingle();
    if (existing) throw new Response("Already clocked in", { status: 400 });
    const geo = await resolveSite(data.lat, data.lng);
    const ts = resolveClientTimestamp(data.clientTimestamp);
    const plannedId = data.plannedJobSiteId ?? null;
    const { data: inserted, error } = await supabaseAdmin.from("time_entries").insert({
      worker_id: wid,
      clock_in: ts.iso,
      project: data.project || geo.siteLabel || null,
      created_by: "worker",
      clock_in_lat: data.lat ?? null,
      clock_in_lng: data.lng ?? null,
      job_site_id: geo.jobSiteId,
      geo_status: geo.status,
      planned_job_site_id: plannedId,
    }).select("id").single();
    if (error) throw error;
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "clock_in",
      entityType: "time_entry",
      entityId: inserted?.id,
      after: { clock_in: ts.iso, job_site_id: geo.jobSiteId, geo_status: geo.status, project: data.project || geo.siteLabel || null, planned_job_site_id: plannedId },
      metadata: ts.backdated ? { offline_sync: true, client_timestamp: data.clientTimestamp } : undefined,
    });
    const needsReason = geo.status === "off_site" || geo.status === "no_gps";
    return { ok: true, geo, entryId: inserted?.id, needsReason };
  });


export const clockOut = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    lat: z.number().finite().optional().nullable(),
    lng: z.number().finite().optional().nullable(),
    clientTimestamp: z.string().datetime().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const { data: active } = await supabaseAdmin
      .from("time_entries").select("id, clock_in, job_site_id, geo_status, planned_job_site_id").eq("worker_id", wid).is("clock_out", null).maybeSingle();
    if (!active) throw new Response("Not clocked in", { status: 400 });
    const ts = resolveClientTimestamp(data.clientTimestamp);
    let outISO = ts.iso;
    if (new Date(outISO) <= new Date(active.clock_in)) {
      outISO = new Date(new Date(active.clock_in).getTime() + 60_000).toISOString();
    }
    const flagged = new Date(outISO).getTime() - new Date(active.clock_in).getTime() > FOURTEEN_HOURS_MS;
    const geo = await resolveSite(data.lat, data.lng);
    const outTag = resolvedClockOutTag(geo, active);
    const { error } = await supabaseAdmin.from("time_entries")
      .update({
        clock_out: outISO,
        flagged_review: flagged,
        clock_out_lat: data.lat ?? null,
        clock_out_lng: data.lng ?? null,
        clock_out_geo_status: outTag.status,
        clock_out_job_site_id: outTag.jobSiteId,
      })
      .eq("id", active.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "clock_out",
      entityType: "time_entry",
      entityId: active.id,
      after: {
        clock_out: outISO,
        flagged_review: flagged,
        clock_out_geo_status: outTag.status,
        clock_out_job_site_id: outTag.jobSiteId,
      },
      metadata: {
        hours: (new Date(outISO).getTime() - new Date(active.clock_in).getTime()) / 3600_000,
        ...(ts.backdated ? { offline_sync: true, client_timestamp: data.clientTimestamp } : {}),
      },
    });
    const needsReason = outTag.status === "off_site" || outTag.status === "no_gps";
    const inNonClient = active.geo_status === "supplier" || active.geo_status === "off_site" || active.geo_status === "no_gps";
    const outNonClient = outTag.status === "supplier" || outTag.status === "off_site" || outTag.status === "no_gps";
    const needsPlannedJob = inNonClient && outNonClient && !active.planned_job_site_id;
    // (Ledger sync removed — Ledger is being rebuilt.)

    return { ok: true, geo: { ...geo, status: outTag.status, jobSiteId: outTag.jobSiteId }, entryId: active.id, needsReason, needsPlannedJob };
  });




// Shared helper: when clocking out without GPS (admin force / auto), mirror the clock-in tag.
export async function forceCloseEntry(opts: {
  entryId: string;
  clockOutISO: string;
  actor: { kind: "admin" } | { kind: "system" };
  reason: "admin_force" | "auto_8pm";
}) {
  const { data: row, error: e0 } = await supabaseAdmin
    .from("time_entries")
    .select("id, clock_in, clock_out, geo_status, job_site_id")
    .eq("id", opts.entryId).maybeSingle();
  if (e0) throw e0;
  if (!row) throw new Response("Entry not found", { status: 404 });
  if (row.clock_out) throw new Response("Already clocked out", { status: 400 });

  let outISO = opts.clockOutISO;
  if (new Date(outISO) <= new Date(row.clock_in)) {
    outISO = new Date(new Date(row.clock_in).getTime() + 60_000).toISOString();
  }
  const flagged = new Date(outISO).getTime() - new Date(row.clock_in).getTime() > FOURTEEN_HOURS_MS;
  const mirroredStatus = row.geo_status ?? "no_gps";
  const mirroredSite = row.job_site_id ?? null;

  const { error } = await supabaseAdmin.from("time_entries").update({
    clock_out: outISO,
    flagged_review: flagged,
    clock_out_geo_status: mirroredStatus,
    clock_out_job_site_id: mirroredSite,
  }).eq("id", opts.entryId);
  if (error) throw error;

  await logAudit({
    actor: opts.actor,
    action: opts.reason === "admin_force" ? "entry_force_clock_out" : "entry_auto_clock_out",
    entityType: "time_entry",
    entityId: opts.entryId,
    before: { clock_out: null },
    after: {
      clock_out: outISO,
      flagged_review: flagged,
      clock_out_geo_status: mirroredStatus,
      clock_out_job_site_id: mirroredSite,
    },
    metadata: { reason: opts.reason, hours: (new Date(outISO).getTime() - new Date(row.clock_in).getTime()) / 3600_000 },
  });
  try {
    const { recomputeLaborForEntryContext } = await import("./ledger-jobs-sync.server");
    const { data: full } = await supabaseAdmin
      .from("time_entries")
      .select("planned_job_site_id, assigned_job_site_ids, job_site_id, clock_out_job_site_id")
      .eq("id", opts.entryId).maybeSingle();
    if (full) await recomputeLaborForEntryContext(full as any);
  } catch { /* non-fatal */ }
  return { entryId: opts.entryId, clockOut: outISO, flagged };
}


export const adminForceClockOut = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    await forceCloseEntry({
      entryId: data.entryId,
      clockOutISO: new Date().toISOString(),
      actor: { kind: "admin" },
      reason: "admin_force",
    });
    return refreshed;
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
      .select("id, clock_in, clock_out, project, created_by, flagged_review, geo_status, offsite_reason_code, offsite_reason_note, job_site_id, planned_job_site_id, clock_out_geo_status, clock_out_job_site_id, assigned_job_site_ids, job_sites!job_site_id(label, kind, archived_at), planned_job:job_sites!planned_job_site_id(label), clock_out_site:job_sites!clock_out_job_site_id(label, kind, archived_at)")
      .eq("worker_id", data.workerId).order("clock_in", { ascending: false });

    if (data.from) q = q.gte("clock_in", data.from);
    if (data.to) q = q.lte("clock_in", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;

    // Hydrate assigned site labels in stack order
    const allIds = Array.from(new Set((rows ?? []).flatMap((r: any) => r.assigned_job_site_ids ?? [])));
    let siteMap = new Map<string, { id: string; label: string }>();
    if (allIds.length) {
      const { data: sites } = await supabaseAdmin.from("job_sites").select("id, label").in("id", allIds);
      siteMap = new Map((sites ?? []).map((s: any) => [s.id, { id: s.id, label: s.label }]));
    }
    const entries = (rows ?? []).map((r: any) => ({
      ...r,
      assigned_sites: (r.assigned_job_site_ids ?? [])
        .map((id: string) => siteMap.get(id))
        .filter(Boolean),
    }));
    return { ...refreshed, entries };
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
    assignedJobSiteIds: z.array(z.string().uuid()).max(5).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    if (new Date(data.clockOut) <= new Date(data.clockIn))
      throw new Response("Clock out must be after clock in", { status: 400 });
    if (await checkOverlap(data.workerId, data.clockIn, data.clockOut))
      throw new Response("Entry overlaps an existing one", { status: 400 });
    const assignedIds = await validateAssignedSites(data.assignedJobSiteIds);
    const flagged = new Date(data.clockOut).getTime() - new Date(data.clockIn).getTime() > FOURTEEN_HOURS_MS;
    const { data: inserted, error } = await supabaseAdmin.from("time_entries").insert({
      worker_id: data.workerId,
      clock_in: data.clockIn,
      clock_out: data.clockOut,
      project: data.project || null,
      created_by: "admin",
      flagged_review: flagged,
      assigned_job_site_ids: assignedIds,
    }).select("id").single();
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_create",
      entityType: "time_entry",
      entityId: inserted?.id,
      after: { worker_id: data.workerId, clock_in: data.clockIn, clock_out: data.clockOut, project: data.project ?? null, flagged_review: flagged, assigned_job_site_ids: assignedIds },
    });
    return refreshed;
  });

async function validateAssignedSites(ids?: string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const unique = Array.from(new Set(ids));
  const { data: found } = await supabaseAdmin.from("job_sites")
    .select("id, archived_at").in("id", unique);
  const okSet = new Set((found ?? []).filter((s: any) => !s.archived_at).map((s: any) => s.id));
  const ordered = ids.filter((id) => okSet.has(id));
  // preserve order and dedupe
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ordered) { if (!seen.has(id)) { seen.add(id); out.push(id); } }
  return out;
}

export const adminEditEntry = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    entryId: z.string().uuid(),
    clockIn: z.string(),
    clockOut: z.string().nullable(),
    project: z.string().trim().max(100).nullable(),
    assignedJobSiteIds: z.array(z.string().uuid()).max(5).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row, error: e1 } = await supabaseAdmin
      .from("time_entries").select("worker_id, clock_in, clock_out, project, flagged_review, assigned_job_site_ids").eq("id", data.entryId).single();
    if (e1) throw e1;
    if (data.clockOut && new Date(data.clockOut) <= new Date(data.clockIn))
      throw new Response("Clock out must be after clock in", { status: 400 });
    if (await checkOverlap(row.worker_id, data.clockIn, data.clockOut, data.entryId))
      throw new Response("Entry overlaps an existing one", { status: 400 });
    const flagged = data.clockOut
      ? new Date(data.clockOut).getTime() - new Date(data.clockIn).getTime() > FOURTEEN_HOURS_MS
      : false;
    const assignedIds = data.assignedJobSiteIds !== undefined
      ? await validateAssignedSites(data.assignedJobSiteIds)
      : (row.assigned_job_site_ids ?? []);
    const { error } = await supabaseAdmin.from("time_entries")
      .update({ clock_in: data.clockIn, clock_out: data.clockOut, project: data.project, flagged_review: flagged, assigned_job_site_ids: assignedIds })
      .eq("id", data.entryId);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_edit",
      entityType: "time_entry",
      entityId: data.entryId,
      before: { clock_in: row.clock_in, clock_out: row.clock_out, project: row.project, flagged_review: row.flagged_review, assigned_job_site_ids: row.assigned_job_site_ids ?? [] },
      after: { clock_in: data.clockIn, clock_out: data.clockOut, project: data.project, flagged_review: flagged, assigned_job_site_ids: assignedIds },
    });
    try {
      const { recomputeLaborForEntryContext } = await import("./ledger-jobs-sync.server");
      const { data: full } = await supabaseAdmin
        .from("time_entries")
        .select("planned_job_site_id, assigned_job_site_ids, job_site_id, clock_out_job_site_id")
        .eq("id", data.entryId).maybeSingle();
      if (full) await recomputeLaborForEntryContext(full as any);
    } catch { /* non-fatal */ }
    return refreshed;
  });


export const adminDeleteEntry = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row } = await supabaseAdmin
      .from("time_entries").select("worker_id, clock_in, clock_out, project, geo_status, job_site_id, planned_job_site_id, assigned_job_site_ids, clock_out_job_site_id").eq("id", data.entryId).maybeSingle();
    const { error } = await supabaseAdmin.from("time_entries").delete().eq("id", data.entryId);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_delete",
      entityType: "time_entry",
      entityId: data.entryId,
      before: row ?? undefined,
    });
    if (row) {
      try {
        const { recomputeLaborForEntryContext } = await import("./ledger-jobs-sync.server");
        await recomputeLaborForEntryContext(row as any);
      } catch { /* non-fatal */ }
    }
    return refreshed;
  });


export const adminUpdateEntryGeo = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    entryId: z.string().uuid(),
    status: z.enum(["verified", "supplier", "off_site", "no_gps"]),
    jobSiteId: z.string().uuid().nullable(),
    field: z.enum(["in", "out"]).optional().default("in"),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    if ((data.status === "verified" || data.status === "supplier") && !data.jobSiteId) {
      throw new Response("Job site required for this status", { status: 400 });
    }
    const statusCol = data.field === "out" ? "clock_out_geo_status" : "geo_status";
    const jobCol = data.field === "out" ? "clock_out_job_site_id" : "job_site_id";
    const { data: prev } = await supabaseAdmin
      .from("time_entries")
      .select(`${statusCol}, ${jobCol}`)
      .eq("id", data.entryId).maybeSingle();
    const newJobSiteId = data.status === "verified" || data.status === "supplier" ? data.jobSiteId : null;
    let newLabel: string | null = null;
    if (newJobSiteId) {
      const { data: s } = await supabaseAdmin.from("job_sites").select("label").eq("id", newJobSiteId).maybeSingle();
      newLabel = s?.label ?? null;
    }
    const update: any = { [statusCol]: data.status, [jobCol]: newJobSiteId };
    const { error } = await (supabaseAdmin.from("time_entries") as any)
      .update(update)
      .eq("id", data.entryId);


    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_geo_update",
      entityType: "time_entry",
      entityId: data.entryId,
      before: { [statusCol]: (prev as any)?.[statusCol] ?? null, [jobCol]: (prev as any)?.[jobCol] ?? null },
      after: { [statusCol]: data.status, [jobCol]: newJobSiteId, job_site_label: newLabel },
      metadata: { field: data.field },
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

// === Planned job site (heading-to) ===

export const workerListActiveClientSites = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("job_sites")
      .select("id, label")
      .eq("kind", "client")
      .is("archived_at", null)
      .order("label", { ascending: true });
    if (error) throw error;
    return { sites: rows ?? [] };
  });

export const workerSetPlannedJob = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    entryId: z.string().uuid(),
    jobSiteId: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const { data: row, error: e0 } = await supabaseAdmin
      .from("time_entries")
      .select("id, worker_id, planned_job_site_id")
      .eq("id", data.entryId).maybeSingle();
    if (e0) throw e0;
    if (!row || row.worker_id !== wid) throw new Response("Not found", { status: 404 });
    let label: string | null = null;
    if (data.jobSiteId) {
      const { data: s } = await supabaseAdmin.from("job_sites").select("label, kind, archived_at").eq("id", data.jobSiteId).maybeSingle();
      if (!s || s.archived_at || s.kind !== "client") throw new Response("Invalid job site", { status: 400 });
      label = s.label;
    }
    const { error } = await supabaseAdmin.from("time_entries")
      .update({ planned_job_site_id: data.jobSiteId })
      .eq("id", data.entryId);
    if (error) throw error;
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "entry_planned_job_set",
      entityType: "time_entry",
      entityId: data.entryId,
      before: { planned_job_site_id: row.planned_job_site_id },
      after: { planned_job_site_id: data.jobSiteId, planned_job_label: label },
    });
    return { ok: true };
  });

export const adminUpdateEntryPlannedJob = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    entryId: z.string().uuid(),
    jobSiteId: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: prev } = await supabaseAdmin
      .from("time_entries")
      .select("planned_job_site_id, planned_job:job_sites!planned_job_site_id(label)")
      .eq("id", data.entryId).maybeSingle();
    let label: string | null = null;
    if (data.jobSiteId) {
      const { data: s } = await supabaseAdmin.from("job_sites").select("label").eq("id", data.jobSiteId).maybeSingle();
      label = s?.label ?? null;
    }
    const { error } = await supabaseAdmin.from("time_entries")
      .update({ planned_job_site_id: data.jobSiteId })
      .eq("id", data.entryId);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "entry_planned_job_update",
      entityType: "time_entry",
      entityId: data.entryId,
      before: { planned_job_site_id: prev?.planned_job_site_id ?? null, planned_job_label: (prev as any)?.planned_job?.label ?? null },
      after: { planned_job_site_id: data.jobSiteId, planned_job_label: label },
    });
    return refreshed;
  });


import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin, requireWorker } from "./auth.server";
import { logAudit } from "./audit.server";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/).nullable().optional();
const adminBase = z.object({ token: z.string() });
const db = () => supabaseAdmin.from("schedule_assignments") as any;
const subDb = () => supabaseAdmin.from("schedule_subs") as any;
const subAsg = () => supabaseAdmin.from("schedule_sub_assignments") as any;

function addDays(d: string, n: number) {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

const SELECT = "id, worker_id, job_site_id, work_date, arrival_time, note, job_sites(label, address, lat, lng)";

export const adminWeekSchedule = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ weekStart: ymd }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const [{ data: workers }, { data: sites }, { data: rows, error }, { data: subs }, { data: subRows }] = await Promise.all([
      supabaseAdmin.from("workers").select("id, name").order("name"),
      supabaseAdmin.from("job_sites").select("id, label, address, kind, archived_at, completed_at, project_id").order("label"),
      db().select(SELECT).gte("work_date", data.weekStart).lt("work_date", addDays(data.weekStart, 7)),
      subDb().select("id, name, trade, phone").is("archived_at", null).order("name"),
      subAsg()
        .select("id, sub_id, job_site_id, work_date, arrival_time, note, job_sites(label, address)")
        .gte("work_date", data.weekStart)
        .lt("work_date", addDays(data.weekStart, 7)),
    ]);
    if (error) throw error;
    const activeSites = (sites ?? []).filter(
      (s: any) => (s.kind ?? "client") === "client" && !s.archived_at && !s.completed_at,
    );
    return { ...refreshed, workers: workers ?? [], sites: activeSites, assignments: rows ?? [], subs: subs ?? [], subAssignments: subRows ?? [] };
  });

export const upsertAssignment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        workerIds: z.array(z.string().uuid()).max(50),
        subIds: z.array(z.string().uuid()).max(50).optional(),
        dates: z.array(ymd).min(1).max(14),
        jobSiteId: z.string().uuid(),
        arrivalTime: hhmm,
        note: z.string().trim().max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const rows = data.workerIds.flatMap((w) =>
      data.dates.map((date) => ({
        worker_id: w,
        work_date: date,
        job_site_id: data.jobSiteId,
        arrival_time: data.arrivalTime || null,
        note: data.note || null,
        updated_at: new Date().toISOString(),
      })),
    );
    const subIds = data.subIds ?? [];
    if (!rows.length && !subIds.length) throw new Error("Pick at least one worker or sub trade");
    if (rows.length) {
      const { error } = await db().upsert(rows, { onConflict: "worker_id,work_date" });
      if (error) throw error;
    }
    if (subIds.length) {
      const subRows = subIds.flatMap((sid) =>
        data.dates.map((date) => ({
          sub_id: sid,
          work_date: date,
          job_site_id: data.jobSiteId,
          arrival_time: data.arrivalTime || null,
          note: data.note || null,
          updated_at: new Date().toISOString(),
        })),
      );
      const { error } = await subAsg().upsert(subRows, { onConflict: "sub_id,work_date" });
      if (error) throw error;
    }
    await logAudit({
      actor: { kind: "admin" },
      action: "schedule_assign",
      entityType: "schedule",
      after: { workerIds: data.workerIds, subIds, dates: data.dates, jobSiteId: data.jobSiteId, arrivalTime: data.arrivalTime },
    });
    return refreshed;
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: before } = await db().select("*").eq("id", data.id).maybeSingle();
    const { error } = await db().delete().eq("id", data.id);
    if (error) throw error;
    await logAudit({ actor: { kind: "admin" }, action: "schedule_remove", entityType: "schedule", entityId: data.id, before });
    return refreshed;
  });

export const deleteSubAssignment = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: before } = await subAsg().select("*").eq("id", data.id).maybeSingle();
    const { error } = await subAsg().delete().eq("id", data.id);
    if (error) throw error;
    await logAudit({ actor: { kind: "admin" }, action: "schedule_sub_remove", entityType: "schedule", entityId: data.id, before });
    return refreshed;
  });

export const upsertSub = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        trade: z.string().trim().max(60).nullable().optional(),
        phone: z.string().trim().max(30).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const row = { name: data.name, trade: data.trade || null, phone: data.phone || null };
    const { data: saved, error } = data.id
      ? await subDb().update(row).eq("id", data.id).select("id").single()
      : await subDb().insert(row).select("id").single();
    if (error) throw error;
    await logAudit({ actor: { kind: "admin" }, action: data.id ? "schedule_sub_update" : "schedule_sub_create", entityType: "schedule_sub", entityId: saved.id, after: row });
    return refreshed;
  });

export const archiveSub = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await subDb().update({ archived_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    await logAudit({ actor: { kind: "admin" }, action: "schedule_sub_archive", entityType: "schedule_sub", entityId: data.id });
    return refreshed;
  });

export const copyLastWeek = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ weekStart: ymd }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const prevStart = addDays(data.weekStart, -7);
    const { data: prev, error } = await db()
      .select("worker_id, job_site_id, work_date, arrival_time, note")
      .gte("work_date", prevStart)
      .lt("work_date", data.weekStart);
    if (error) throw error;
    const { data: existing } = await db()
      .select("worker_id, work_date")
      .gte("work_date", data.weekStart)
      .lt("work_date", addDays(data.weekStart, 7));
    const taken = new Set((existing ?? []).map((r: any) => `${r.worker_id}|${r.work_date}`));
    const rows = (prev ?? [])
      .map((r: any) => ({ ...r, work_date: addDays(r.work_date, 7) }))
      .filter((r: any) => !taken.has(`${r.worker_id}|${r.work_date}`));
    if (rows.length) {
      const { error: e2 } = await db().insert(rows);
      if (e2) throw e2;
    }
    await logAudit({ actor: { kind: "admin" }, action: "schedule_copy_week", entityType: "schedule", metadata: { weekStart: data.weekStart, copied: rows.length } });
    return { ...refreshed, copied: rows.length };
  });

export const workerMySchedule = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string(), from: ymd }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const { data: rows, error } = await db()
      .select(SELECT)
      .eq("worker_id", wid)
      .gte("work_date", data.from)
      .lt("work_date", addDays(data.from, 7))
      .order("work_date");
    if (error) throw error;
    return { assignments: rows ?? [] };
  });

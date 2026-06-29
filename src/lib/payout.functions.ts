import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";

function startOfWeekISO(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}


function endOfWeek(weekStart: string) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

export const weeklyPayout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    weekStart: z.string(), // YYYY-MM-DD (Sunday)
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const start = new Date(data.weekStart);
    const end = endOfWeek(data.weekStart);

    const [{ data: workers }, { data: entries }, { data: reimbs }, { data: paidRows }] = await Promise.all([
      supabaseAdmin.from("workers").select("id, name, hourly_rate").order("name"),
      supabaseAdmin.from("time_entries").select("worker_id, clock_in, clock_out")
        .gte("clock_in", start.toISOString()).lt("clock_in", end.toISOString())
        .not("clock_out", "is", null),
      supabaseAdmin.from("reimbursements").select("worker_id, amount, description")
        .eq("week_start", data.weekStart),
      supabaseAdmin.from("weekly_payouts").select("worker_id, paid_at, paid_by, amount")
        .eq("week_start", data.weekStart),
    ]);

    const summary = (workers ?? []).map((w) => {
      const myEntries = (entries ?? []).filter((e) => e.worker_id === w.id);
      const hours = myEntries.reduce((s, e) =>
        s + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600_000, 0);
      const myReimbs = (reimbs ?? []).filter((r) => r.worker_id === w.id);
      const reimbTotal = myReimbs.reduce((s, r) => s + Number(r.amount), 0);
      const wages = hours * Number(w.hourly_rate);
      const paid = (paidRows ?? []).find((p) => p.worker_id === w.id) ?? null;
      return {
        workerId: w.id,
        name: w.name,
        hourlyRate: Number(w.hourly_rate),
        hours,
        wages,
        reimbursements: myReimbs,
        reimbTotal,
        total: wages + reimbTotal,
        paidAt: paid?.paid_at ?? null,
        paidBy: paid?.paid_by ?? null,
      };
    });


    return { ...refreshed, summary, weekStart: data.weekStart };
  });

export const lifetimePayout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);

    const [{ data: workers }, { data: entries }, { data: reimbs }] = await Promise.all([
      supabaseAdmin.from("workers").select("id, name, hourly_rate").order("name"),
      supabaseAdmin.from("time_entries").select("worker_id, clock_in, clock_out")
        .not("clock_out", "is", null),
      supabaseAdmin.from("reimbursements").select("worker_id, amount"),
    ]);

    const summary = (workers ?? []).map((w) => {
      const myEntries = (entries ?? []).filter((e) => e.worker_id === w.id);
      const hours = myEntries.reduce((s, e) =>
        s + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600_000, 0);
      const myReimbs = (reimbs ?? []).filter((r) => r.worker_id === w.id);
      const reimbTotal = myReimbs.reduce((s, r) => s + Number(r.amount), 0);
      const wages = hours * Number(w.hourly_rate);
      return {
        workerId: w.id,
        name: w.name,
        hourlyRate: Number(w.hourly_rate),
        hours,
        wages,
        reimbCount: myReimbs.length,
        reimbTotal,
        total: wages + reimbTotal,
      };
    });

    return { ...refreshed, summary };
  });

export const exportEntriesCsv = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    weekStart: z.string(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const start = new Date(data.weekStart);
    const end = endOfWeek(data.weekStart);
    const { data: rows, error } = await supabaseAdmin
      .from("time_entries")
      .select("clock_in, clock_out, project, created_by, flagged_review, workers(name)")
      .gte("clock_in", start.toISOString()).lt("clock_in", end.toISOString())
      .order("clock_in");
    if (error) throw error;
    const header = "Worker,Clock In,Clock Out,Hours,Project,Created By,Flagged\n";
    const csv = header + (rows ?? []).map((r: any) => {
      const hours = r.clock_out
        ? ((new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 3600_000).toFixed(2)
        : "";
      const project = (r.project ?? "General").replace(/"/g, '""');
      return `"${r.workers?.name ?? ""}","${r.clock_in}","${r.clock_out ?? ""}",${hours},"${project}",${r.created_by},${r.flagged_review}`;
    }).join("\n");
    return { ...refreshed, csv };
  });

// ===== Pending / Paid tracking =====

export const listPendingWeeks = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    includePaid: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);

    const [{ data: workers }, { data: entries }, { data: reimbs }, { data: paidRows }] = await Promise.all([
      supabaseAdmin.from("workers").select("id, name, hourly_rate").order("name"),
      supabaseAdmin.from("time_entries").select("worker_id, clock_in, clock_out")
        .not("clock_out", "is", null),
      supabaseAdmin.from("reimbursements").select("worker_id, week_start, amount"),
      supabaseAdmin.from("weekly_payouts").select("worker_id, week_start, paid_at, paid_by, amount"),
    ]);

    const workerMap = new Map((workers ?? []).map((w) => [w.id, w]));
    const buckets = new Map<string, { workerId: string; weekStart: string; hours: number; reimbTotal: number }>();

    for (const e of entries ?? []) {
      const wk = startOfWeekISO(new Date(e.clock_in));
      const key = `${e.worker_id}|${wk}`;
      const cur = buckets.get(key) ?? { workerId: e.worker_id, weekStart: wk, hours: 0, reimbTotal: 0 };
      cur.hours += (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600_000;
      buckets.set(key, cur);
    }
    for (const r of reimbs ?? []) {
      const wk = String(r.week_start);
      const key = `${r.worker_id}|${wk}`;
      const cur = buckets.get(key) ?? { workerId: r.worker_id, weekStart: wk, hours: 0, reimbTotal: 0 };
      cur.reimbTotal += Number(r.amount);
      buckets.set(key, cur);
    }

    const paidMap = new Map(
      (paidRows ?? []).map((p) => [`${p.worker_id}|${p.week_start}`, p])
    );

    const now = Date.now();
    const items = Array.from(buckets.values())
      .map((b) => {
        const w = workerMap.get(b.workerId);
        const rate = Number(w?.hourly_rate ?? 0);
        const wages = b.hours * rate;
        const total = wages + b.reimbTotal;
        const paid = paidMap.get(`${b.workerId}|${b.weekStart}`) ?? null;
        const weekEnd = addDaysISO(b.weekStart, 6);
        const endTs = new Date(weekEnd + "T23:59:59").getTime();
        const ageDays = Math.floor((now - endTs) / 86_400_000);
        let status: "paid" | "overdue" | "unpaid";
        if (paid) status = "paid";
        else if (ageDays >= 14) status = "overdue";
        else status = "unpaid";
        return {
          workerId: b.workerId,
          workerName: w?.name ?? "Unknown",
          weekStart: b.weekStart,
          weekEnd,
          hours: b.hours,
          hourlyRate: rate,
          wages,
          reimbursements: b.reimbTotal,
          total,
          status,
          paidAt: paid?.paid_at ?? null,
          paidBy: paid?.paid_by ?? null,
          paidAmount: paid ? Number(paid.amount) : null,
        };
      })
      .filter((x) => x.total > 0 || x.status === "paid")
      .filter((x) => data.includePaid ? true : x.status !== "paid")
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.workerName.localeCompare(b.workerName));

    return { ...refreshed, items };
  });

export const markWeekPaid = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    workerId: z.string().uuid(),
    weekStart: z.string(),
    notes: z.string().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const start = new Date(data.weekStart);
    const end = new Date(data.weekStart);
    end.setDate(end.getDate() + 7);

    const [{ data: w }, { data: entries }, { data: reimbs }] = await Promise.all([
      supabaseAdmin.from("workers").select("id, name, hourly_rate").eq("id", data.workerId).maybeSingle(),
      supabaseAdmin.from("time_entries").select("clock_in, clock_out")
        .eq("worker_id", data.workerId)
        .gte("clock_in", start.toISOString()).lt("clock_in", end.toISOString())
        .not("clock_out", "is", null),
      supabaseAdmin.from("reimbursements").select("amount")
        .eq("worker_id", data.workerId).eq("week_start", data.weekStart),
    ]);
    if (!w) throw new Error("Worker not found");

    const hours = (entries ?? []).reduce((s, e) =>
      s + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600_000, 0);
    const reimbTotal = (reimbs ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const wages = hours * Number(w.hourly_rate);
    const amount = wages + reimbTotal;

    const { error } = await supabaseAdmin.from("weekly_payouts").upsert({
      worker_id: data.workerId,
      week_start: data.weekStart,
      hours, wages, reimbursement_total: reimbTotal, amount,
      paid_at: new Date().toISOString(),
      paid_by: "Admin",
      notes: data.notes ?? null,
    }, { onConflict: "worker_id,week_start" });
    if (error) throw error;

    await logAudit({
      actor: { kind: "admin" },
      action: "mark_week_paid",
      entityType: "weekly_payout",
      entityId: `${data.workerId}:${data.weekStart}`,
      after: { workerId: data.workerId, weekStart: data.weekStart, amount, hours, wages, reimbTotal },
      metadata: { workerName: w.name },
    });

    return { ...refreshed, ok: true };
  });

export const unmarkWeekPaid = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    workerId: z.string().uuid(),
    weekStart: z.string(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: prev } = await supabaseAdmin.from("weekly_payouts")
      .select("*").eq("worker_id", data.workerId).eq("week_start", data.weekStart).maybeSingle();
    const { error } = await supabaseAdmin.from("weekly_payouts")
      .delete().eq("worker_id", data.workerId).eq("week_start", data.weekStart);
    if (error) throw error;

    await logAudit({
      actor: { kind: "admin" },
      action: "unmark_week_paid",
      entityType: "weekly_payout",
      entityId: `${data.workerId}:${data.weekStart}`,
      before: prev ?? null,
    });

    return { ...refreshed, ok: true };
  });

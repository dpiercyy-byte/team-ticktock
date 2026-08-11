import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin, requireWorker } from "./auth.server";
import { logAudit } from "./audit.server";
import { addDaysISO, endOfWeek, payoutStatus, startOfWeekISO } from "./payout-math";


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
      supabaseAdmin.from("weekly_payouts").select("worker_id, paid_at, paid_by, paid_by_person, amount, actual_paid, tip_amount")
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
        paidByPerson: (paid as any)?.paid_by_person ?? null,
        actualPaid: paid?.actual_paid != null ? Number(paid.actual_paid) : null,
        tipAmount: paid?.tip_amount != null ? Number(paid.tip_amount) : null,
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
      supabaseAdmin.from("weekly_payouts").select("worker_id, week_start, paid_at, paid_by, paid_by_person, amount, actual_paid, tip_amount"),
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
      if (!r.worker_id) continue; // skip admin (standalone) receipts
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
        const status = payoutStatus(b.weekStart, !!paid, now);

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
          paidByPerson: (paid as any)?.paid_by_person ?? null,
          paidAmount: paid ? Number(paid.amount) : null,
          actualPaid: paid?.actual_paid != null ? Number(paid.actual_paid) : null,
          tipAmount: paid?.tip_amount != null ? Number(paid.tip_amount) : null,
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
    actualPaid: z.number().nonnegative().optional(),
    paidByPerson: z.enum(["Michael", "Dylan"]).optional(),
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
    const actualPaid = data.actualPaid != null ? data.actualPaid : amount;
    const tipAmount = Number((actualPaid - amount).toFixed(2));
    const paidAt = new Date();

    const { error } = await supabaseAdmin.from("weekly_payouts").upsert({
      worker_id: data.workerId,
      week_start: data.weekStart,
      hours, wages, reimbursement_total: reimbTotal, amount,
      actual_paid: actualPaid,
      tip_amount: tipAmount,
      paid_at: paidAt.toISOString(),
      paid_by: "Admin",
      paid_by_person: data.paidByPerson ?? null,
      notes: data.notes ?? null,
    }, { onConflict: "worker_id,week_start" });
    if (error) throw error;

    await logAudit({
      actor: { kind: "admin" },
      action: "mark_week_paid",
      entityType: "weekly_payout",
      entityId: `${data.workerId}:${data.weekStart}`,
      after: { workerId: data.workerId, weekStart: data.weekStart, amount, actualPaid, tipAmount, hours, wages, reimbTotal, paidByPerson: data.paidByPerson ?? null },
      metadata: { workerName: w.name },
    });

    // Cash Tracking sheet export (best-effort; never blocks the payout).
    let sheetRow: number | null = null;
    let sheetError: string | null = null;
    let sheetSkipped: "disabled" | "unconfigured" | "no_payer" | null = null;
    if (!data.paidByPerson) {
      sheetSkipped = "no_payer";
    } else {
      try {
        const { getCashExportSettings, appendCashPayoutRow } = await import("./cash-export.server");
        const settings = await getCashExportSettings();
        if (!settings.sheetId) {
          sheetSkipped = "unconfigured";
        } else if (!settings.enabled) {
          sheetSkipped = "disabled";
        } else {
          const res = await appendCashPayoutRow({
            payer: data.paidByPerson,
            amount: actualPaid,
            paidAt,
            workerName: w.name,
            weekStart: data.weekStart,
          });
          sheetRow = res.row;
          await logAudit({
            actor: { kind: "admin" },
            action: "cash_export_row_added",
            entityType: "weekly_payout",
            entityId: `${data.workerId}:${data.weekStart}`,
            after: { payer: data.paidByPerson, row: res.row, values: res.values },
          });
        }
      } catch (e: any) {
        sheetError = e?.message || String(e);
      }
    }

    return { ...refreshed, ok: true, sheetRow, sheetError, sheetSkipped };
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

// Worker-facing: summary of a specific week for the calling worker.
export const workerWeekSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    weekStart: z.string(), // YYYY-MM-DD (Sunday)
  }).parse(d))
  .handler(async ({ data }) => {
    const workerId = requireWorker(data.token);
    const start = new Date(data.weekStart);
    const end = endOfWeek(data.weekStart);

    const [{ data: w }, { data: entries }, { data: reimbs }, { data: paid }] = await Promise.all([
      supabaseAdmin.from("workers").select("hourly_rate").eq("id", workerId).maybeSingle(),
      supabaseAdmin.from("time_entries").select("clock_in, clock_out")
        .eq("worker_id", workerId)
        .gte("clock_in", start.toISOString()).lt("clock_in", end.toISOString())
        .not("clock_out", "is", null),
      supabaseAdmin.from("reimbursements").select("id, description, amount, receipt_url, receipt_mime")
        .eq("worker_id", workerId).eq("week_start", data.weekStart),
      supabaseAdmin.from("weekly_payouts").select("paid_at, paid_by, amount, actual_paid, tip_amount")
        .eq("worker_id", workerId).eq("week_start", data.weekStart).maybeSingle(),
    ]);

    const hours = (entries ?? []).reduce((s, e) =>
      s + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600_000, 0);
    const rate = Number(w?.hourly_rate ?? 0);
    const wages = hours * rate;
    const reimbTotal = (reimbs ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const total = wages + reimbTotal;

    const weekEndISO = addDaysISO(data.weekStart, 6);
    const status = payoutStatus(data.weekStart, !!paid);

    return {
      weekStart: data.weekStart,
      weekEnd: weekEndISO,

      hours, hourlyRate: rate, wages, reimbTotal, total,
      reimbursements: reimbs ?? [],
      status,
      paidAt: paid?.paid_at ?? null,
      paidBy: paid?.paid_by ?? null,
      actualPaid: paid?.actual_paid != null ? Number(paid.actual_paid) : null,
      tipAmount: paid?.tip_amount != null ? Number(paid.tip_amount) : null,
    };
  });


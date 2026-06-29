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

    const [{ data: workers }, { data: entries }, { data: reimbs }] = await Promise.all([
      supabaseAdmin.from("workers").select("id, name, hourly_rate").order("name"),
      supabaseAdmin.from("time_entries").select("worker_id, clock_in, clock_out")
        .gte("clock_in", start.toISOString()).lt("clock_in", end.toISOString())
        .not("clock_out", "is", null),
      supabaseAdmin.from("reimbursements").select("worker_id, amount, description")
        .eq("week_start", data.weekStart),
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
        reimbursements: myReimbs,
        reimbTotal,
        total: wages + reimbTotal,
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

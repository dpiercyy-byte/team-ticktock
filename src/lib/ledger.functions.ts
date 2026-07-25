import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";

const adminBase = z.object({ token: z.string() });

export const LEDGER_STATUSES = [
  "Lead",
  "Site Visit Required",
  "Estimate Required",
  "Waiting For Approval",
  "Scheduled",
  "Active",
  "Completed",
] as const;

export const LEDGER_PROJECT_TYPES = [
  "Bathroom",
  "Kitchen",
  "Basement",
  "Addition",
  "Whole Home",
  "Commercial",
  "Maintenance",
  "Custom",
] as const;

export const LEDGER_TRADES = [
  "Demo",
  "Framing",
  "Drywall",
  "Insulation",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Painting",
  "Flooring",
  "Tile",
  "Millwork",
  "Trim",
  "Cabinetry",
  "Countertops",
  "Glass",
  "Exterior",
  "Roofing",
  "Landscaping",
] as const;

export const LEDGER_EVENT_KINDS = [
  "created",
  "status",
  "note",
  "visit",
  "estimate",
  "approval",
  "payment",
  "clockin",
  "receipt",
  "material",
  "change_order",
  "inspection",
  "completed",
] as const;

export type LedgerStatus = (typeof LEDGER_STATUSES)[number];
export type LedgerProjectType = (typeof LEDGER_PROJECT_TYPES)[number];
export type LedgerTrade = (typeof LEDGER_TRADES)[number];
export type LedgerEventKind = (typeof LEDGER_EVENT_KINDS)[number];

export type LedgerJob = {
  id: string;
  name: string;
  client: { name: string; email?: string | null; phone?: string | null };
  address: string;
  projectType: LedgerProjectType | string;
  trades: string[];
  status: LedgerStatus | string;
  progress: number;
  budget: number; // dollars
  collected: number;
  expenses: number;
  workersOnSite: number;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LedgerTimelineEvent = {
  id: string;
  jobId: string;
  kind: LedgerEventKind | string;
  title: string;
  detail: string | null;
  occurredAt: string;
};

type JobRow = {
  id: string;
  name: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  address: string;
  project_type: string;
  trades: string[] | null;
  status: string;
  progress: number;
  budget_cents: number | string;
  collected_cents: number | string;
  expenses_cents: number | string;
  workers_on_site: number;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
};

const centsToDollars = (n: number | string) => Number(n) / 100;
const dollarsToCents = (n: number) => Math.round(n * 100);

function rowToJob(r: JobRow): LedgerJob {
  return {
    id: r.id,
    name: r.name,
    client: { name: r.client_name, email: r.client_email, phone: r.client_phone },
    address: r.address,
    projectType: r.project_type,
    trades: r.trades ?? [],
    status: r.status,
    progress: r.progress,
    budget: centsToDollars(r.budget_cents),
    collected: centsToDollars(r.collected_cents),
    expenses: centsToDollars(r.expenses_cents),
    workersOnSite: r.workers_on_site,
    scheduledFor: r.scheduled_for,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const JOB_COLS =
  "id, name, client_name, client_email, client_phone, address, project_type, trades, status, progress, budget_cents, collected_cents, expenses_cents, workers_on_site, scheduled_for, created_at, updated_at";

export const listLedgerJobs = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("ledger_jobs")
      .select(JOB_COLS)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return { ...refreshed, jobs: (rows ?? []).map(rowToJob) };
  });

export const getLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs")
      .select(JOB_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Response("Not found", { status: 404 });
    const { data: events, error: evErr } = await supabaseAdmin
      .from("ledger_job_events")
      .select("id, job_id, kind, title, detail, occurred_at")
      .eq("job_id", data.id)
      .order("occurred_at", { ascending: false });
    if (evErr) throw evErr;
    return {
      ...refreshed,
      job: rowToJob(row),
      timeline: (events ?? []).map((e) => ({
        id: e.id,
        jobId: e.job_id,
        kind: e.kind,
        title: e.title,
        detail: e.detail,
        occurredAt: e.occurred_at,
      })) as LedgerTimelineEvent[],
    };
  });

export const createLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      clientName: z.string().trim().min(1).max(120),
      clientEmail: z.string().trim().max(200).optional().nullable(),
      clientPhone: z.string().trim().max(60).optional().nullable(),
      address: z.string().trim().min(1).max(300),
      projectType: z.string().trim().min(1).max(60),
      trades: z.array(z.string().max(60)).max(30),
      status: z.enum(LEDGER_STATUSES),
      scheduledFor: z.string().datetime().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const lastName = data.clientName.trim().split(/\s+/).slice(-1)[0];
    const name = `${lastName} ${data.projectType}`;
    const { data: created, error } = await supabaseAdmin
      .from("ledger_jobs")
      .insert({
        name,
        client_name: data.clientName,
        client_email: data.clientEmail ?? null,
        client_phone: data.clientPhone ?? null,
        address: data.address,
        project_type: data.projectType,
        trades: data.trades,
        status: data.status,
        scheduled_for: data.scheduledFor ?? null,
      })
      .select(JOB_COLS)
      .single();
    if (error) throw error;
    await supabaseAdmin.from("ledger_job_events").insert([
      { job_id: created.id, kind: "created", title: "Job created" },
      { job_id: created.id, kind: "status", title: `Status set to ${data.status}` },
    ]);
    return { ...refreshed, job: rowToJob(created) };
  });

export const updateLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      id: z.string().uuid(),
      patch: z.object({
        name: z.string().trim().min(1).max(160).optional(),
        clientName: z.string().trim().min(1).max(120).optional(),
        clientEmail: z.string().trim().max(200).nullable().optional(),
        clientPhone: z.string().trim().max(60).nullable().optional(),
        address: z.string().trim().min(1).max(300).optional(),
        projectType: z.string().trim().min(1).max(60).optional(),
        trades: z.array(z.string().max(60)).max(30).optional(),
        status: z.enum(LEDGER_STATUSES).optional(),
        progress: z.number().int().min(0).max(100).optional(),
        budget: z.number().min(0).max(100_000_000).optional(),
        collected: z.number().min(0).max(100_000_000).optional(),
        expenses: z.number().min(0).max(100_000_000).optional(),
        workersOnSite: z.number().int().min(0).max(500).optional(),
        scheduledFor: z.string().datetime().nullable().optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: prev, error: prevErr } = await supabaseAdmin
      .from("ledger_jobs").select("status").eq("id", data.id).maybeSingle();
    if (prevErr) throw prevErr;
    if (!prev) throw new Response("Not found", { status: 404 });

    const p = data.patch;
    const upd: Record<string, any> = {};
    if (p.name !== undefined) upd.name = p.name;
    if (p.clientName !== undefined) upd.client_name = p.clientName;
    if (p.clientEmail !== undefined) upd.client_email = p.clientEmail;
    if (p.clientPhone !== undefined) upd.client_phone = p.clientPhone;
    if (p.address !== undefined) upd.address = p.address;
    if (p.projectType !== undefined) upd.project_type = p.projectType;
    if (p.trades !== undefined) upd.trades = p.trades;
    if (p.status !== undefined) upd.status = p.status;
    if (p.progress !== undefined) upd.progress = p.progress;
    if (p.budget !== undefined) upd.budget_cents = dollarsToCents(p.budget);
    if (p.collected !== undefined) upd.collected_cents = dollarsToCents(p.collected);
    if (p.expenses !== undefined) upd.expenses_cents = dollarsToCents(p.expenses);
    if (p.workersOnSite !== undefined) upd.workers_on_site = p.workersOnSite;
    if (p.scheduledFor !== undefined) upd.scheduled_for = p.scheduledFor;

    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs").update(upd as never).eq("id", data.id).select(JOB_COLS).single();
    if (error) throw error;

    if (p.status && p.status !== prev.status) {
      await supabaseAdmin.from("ledger_job_events").insert({
        job_id: data.id,
        kind: "status",
        title: `Status changed to ${p.status}`,
      });
    }
    return { ...refreshed, job: rowToJob(row) };
  });

export const addLedgerJobEvent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      id: z.string().uuid(),
      kind: z.enum(LEDGER_EVENT_KINDS),
      title: z.string().trim().min(1).max(200),
      detail: z.string().trim().max(1000).optional().nullable(),
      occurredAt: z.string().datetime().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("ledger_job_events")
      .insert({
        job_id: data.id,
        kind: data.kind,
        title: data.title,
        detail: data.detail ?? null,
        occurred_at: data.occurredAt ?? new Date().toISOString(),
      })
      .select("id, job_id, kind, title, detail, occurred_at")
      .single();
    if (error) throw error;
    await supabaseAdmin
      .from("ledger_jobs").update({ updated_at: new Date().toISOString() }).eq("id", data.id);
    return {
      ...refreshed,
      event: {
        id: row.id, jobId: row.job_id, kind: row.kind, title: row.title,
        detail: row.detail, occurredAt: row.occurred_at,
      } as LedgerTimelineEvent,
    };
  });

export const deleteLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("ledger_jobs").delete().eq("id", data.id);
    if (error) throw error;
    return { ...refreshed, ok: true };
  });

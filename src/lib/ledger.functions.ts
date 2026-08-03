import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { findOrCreateClient, findOrCreateProperty } from "./ledger-crm.server";
import {
  LEDGER_SALES_STAGES,
  LEDGER_DELIVERY_STATUSES,
  statusToStages,
  stagesToStatus,
} from "./ledger-stages";

export { LEDGER_SALES_STAGES, LEDGER_DELIVERY_STATUSES } from "./ledger-stages";
export type { LedgerSalesStage, LedgerDeliveryStatus } from "./ledger-stages";

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

export type LedgerClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  leadSource: string | null;
  preferredContactMethod: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LedgerProperty = {
  id: string;
  clientId: string | null;
  address: string;
  unit: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LedgerJob = {
  id: string;
  name: string;
  client: { name: string; email?: string | null; phone?: string | null };
  clientId: string | null;
  propertyId: string | null;
  address: string;
  projectType: LedgerProjectType | string;
  trades: string[];
  status: LedgerStatus | string;
  salesStage: string;
  deliveryStatus: string;
  estimatedValue: number;
  assignedOwner: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  expectedStartDate: string | null;
  actualStartDate: string | null;
  expectedCompletionDate: string | null;
  actualCompletionDate: string | null;
  lostReason: string | null;
  progress: number;
  budget: number; // dollars
  collected: number;
  expenses: number;
  workersOnSite: number;
  scheduledFor: string | null;
  archivedAt: string | null;
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
  client_id: string | null;
  property_id: string | null;
  sales_stage: string | null;
  delivery_status: string | null;
  estimated_value_cents: number | string | null;
  assigned_owner: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  expected_start_date: string | null;
  actual_start_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  lost_reason: string | null;
  project_type: string;
  trades: string[] | null;
  status: string;
  progress: number;
  budget_cents: number | string;
  collected_cents: number | string;
  expenses_cents: number | string;
  workers_on_site: number;
  scheduled_for: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: { id: string; name: string; email: string | null; phone: string | null } | null;
  properties?: { id: string; address: string } | null;
};

const centsToDollars = (n: number | string) => Number(n) / 100;
const dollarsToCents = (n: number) => Math.round(n * 100);

function rowToJob(r: JobRow): LedgerJob {
  // Canonical relations win; embedded legacy fields are the fallback.
  const client = r.clients ?? null;
  const property = r.properties ?? null;
  const mapped = statusToStages(r.status);
  return {
    id: r.id,
    name: r.name,
    client: {
      name: client?.name ?? r.client_name,
      email: client?.email ?? r.client_email,
      phone: client?.phone ?? r.client_phone,
    },
    clientId: r.client_id ?? null,
    propertyId: r.property_id ?? null,
    address: property?.address ?? r.address,
    projectType: r.project_type,
    trades: r.trades ?? [],
    status: r.status,
    salesStage: r.sales_stage ?? mapped.salesStage,
    deliveryStatus: r.delivery_status ?? mapped.deliveryStatus,
    estimatedValue: centsToDollars(r.estimated_value_cents ?? 0),
    assignedOwner: r.assigned_owner ?? null,
    nextAction: r.next_action ?? null,
    nextActionDueAt: r.next_action_due_at ?? null,
    expectedStartDate: r.expected_start_date ?? null,
    actualStartDate: r.actual_start_date ?? null,
    expectedCompletionDate: r.expected_completion_date ?? null,
    actualCompletionDate: r.actual_completion_date ?? null,
    lostReason: r.lost_reason ?? null,
    progress: r.progress,
    budget: centsToDollars(r.budget_cents),
    collected: centsToDollars(r.collected_cents),
    expenses: centsToDollars(r.expenses_cents),
    workersOnSite: r.workers_on_site,
    scheduledFor: r.scheduled_for,
    archivedAt: r.archived_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const JOB_COLS =
  "id, name, client_name, client_email, client_phone, address, client_id, property_id, sales_stage, delivery_status, estimated_value_cents, assigned_owner, next_action, next_action_due_at, expected_start_date, actual_start_date, expected_completion_date, actual_completion_date, lost_reason, project_type, trades, status, progress, budget_cents, collected_cents, expenses_cents, workers_on_site, scheduled_for, archived_at, created_at, updated_at, clients:client_id(id, name, email, phone), properties:property_id(id, address)";


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
    return { ...refreshed, jobs: (rows ?? []).map((r) => rowToJob(r as unknown as JobRow)) };
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
      job: rowToJob(row as unknown as JobRow),
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
      leadSource: z.string().trim().max(120).optional().nullable(),
      preferredContactMethod: z.string().trim().max(60).optional().nullable(),
      clientId: z.string().uuid().optional().nullable(),
      propertyId: z.string().uuid().optional().nullable(),
      address: z.string().trim().min(1).max(300),
      projectType: z.string().trim().min(1).max(60),
      trades: z.array(z.string().max(60)).max(30),
      status: z.enum(LEDGER_STATUSES),
      salesStage: z.enum(LEDGER_SALES_STAGES).optional(),
      deliveryStatus: z.enum(LEDGER_DELIVERY_STATUSES).optional(),
      estimatedValue: z.number().min(0).max(100_000_000).optional(),
      scheduledFor: z.string().datetime().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const lastName = data.clientName.trim().split(/\s+/).slice(-1)[0];
    const name = `${lastName} ${data.projectType}`;

    // Canonical relations: one client, one property, then the project.
    const clientId =
      data.clientId ??
      (await findOrCreateClient({
        name: data.clientName,
        email: data.clientEmail,
        phone: data.clientPhone,
        leadSource: data.leadSource,
        preferredContactMethod: data.preferredContactMethod,
      }));
    const propertyId =
      data.propertyId ?? (await findOrCreateProperty(clientId, { address: data.address }));

    const mapped = statusToStages(data.status);
    const salesStage = data.salesStage ?? mapped.salesStage;
    const deliveryStatus = data.deliveryStatus ?? mapped.deliveryStatus;

    const { data: created, error } = await supabaseAdmin
      .from("ledger_jobs")
      .insert({
        name,
        // legacy embedded fields kept in sync for rollback safety
        client_name: data.clientName,
        client_email: data.clientEmail ?? null,
        client_phone: data.clientPhone ?? null,
        address: data.address,
        client_id: clientId,
        property_id: propertyId,
        project_type: data.projectType,
        trades: data.trades,
        status: data.status,
        sales_stage: salesStage,
        delivery_status: deliveryStatus,
        estimated_value_cents: dollarsToCents(data.estimatedValue ?? 0),
        scheduled_for: data.scheduledFor ?? null,
      } as never)
      .select(JOB_COLS)
      .single();
    if (error) throw error;
    await supabaseAdmin.from("ledger_job_events").insert([
      { job_id: created.id, kind: "created", title: "Job created" },
      { job_id: created.id, kind: "status", title: `Stage set to ${salesStage} · ${deliveryStatus}` },
    ]);
    return { ...refreshed, job: rowToJob(created as unknown as JobRow) };
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

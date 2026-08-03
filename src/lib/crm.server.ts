import { supabaseAdmin } from "./db.server";
import { daysInStage } from "./crm-math";

export const PIPELINE_COLS =
  "id, name, client_name, address, project_type, sales_stage, delivery_status, status, estimated_value_cents, assigned_owner, next_action, next_action_due_at, next_action_status, next_action_owner, sales_stage_changed_at, archived_at, created_at, updated_at, client_id, property_id, clients:client_id(id, name, phone, email), properties:property_id(id, address)";

export type PipelineCard = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string;
  projectType: string;
  address: string;
  estimatedValue: number;
  assignedOwner: string | null;
  nextAction: string | null;
  nextActionOwner: string | null;
  nextActionDueAt: string | null;
  nextActionStatus: string;
  salesStage: string;
  deliveryStatus: string;
  salesStageChangedAt: string | null;
  daysInStage: number;
  updatedAt: string;
};

type Row = Record<string, any>;

export function rowToCard(r: Row): PipelineCard {
  const client = r.clients ?? null;
  const property = r.properties ?? null;
  return {
    id: r.id,
    name: r.name,
    clientId: r.client_id ?? null,
    clientName: client?.name ?? r.client_name,
    projectType: r.project_type,
    address: property?.address ?? r.address,
    estimatedValue: Number(r.estimated_value_cents ?? 0) / 100,
    assignedOwner: r.assigned_owner ?? null,
    nextAction: r.next_action ?? null,
    nextActionOwner: r.next_action_owner ?? r.assigned_owner ?? null,
    nextActionDueAt: r.next_action_due_at ?? null,
    nextActionStatus: r.next_action_status ?? "open",
    salesStage: r.sales_stage ?? "New Lead",
    deliveryStatus: r.delivery_status ?? "Not Started",
    salesStageChangedAt: r.sales_stage_changed_at ?? null,
    daysInStage: daysInStage(r.sales_stage_changed_at ?? r.updated_at),
    updatedAt: r.updated_at,
  };
}

export async function fetchPipelineCards(): Promise<PipelineCard[]> {
  const { data, error } = await supabaseAdmin
    .from("ledger_jobs")
    .select(PIPELINE_COLS)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(rowToCard);
}

export type DirectoryClient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  leadSource: string | null;
  archivedAt: string | null;
  projectCount: number;
  lastActivityAt: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  nextActionStatus: string | null;
};

export async function fetchDirectory(opts: {
  q: string;
  filter: "active" | "archived";
}): Promise<DirectoryClient[]> {
  const { data: clients, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, phone, email, lead_source, archived_at, created_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw error;

  const { data: jobs, error: jErr } = await supabaseAdmin
    .from("ledger_jobs")
    .select(
      "id, client_id, updated_at, next_action, next_action_due_at, next_action_status, archived_at",
    )
    .is("archived_at", null);
  if (jErr) throw jErr;

  const byClient = new Map<string, Row[]>();
  for (const j of (jobs ?? []) as unknown as Row[]) {
    if (!j.client_id) continue;
    const list = byClient.get(j.client_id) ?? [];
    list.push(j);
    byClient.set(j.client_id, list);
  }

  const needle = opts.q.trim().toLowerCase();
  return ((clients ?? []) as unknown as Row[])
    .filter((c) => (opts.filter === "archived" ? c.archived_at !== null : c.archived_at === null))
    .filter((c) => {
      if (!needle) return true;
      return [c.name, c.phone, c.email]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(needle));
    })
    .map((c) => {
      const list = byClient.get(c.id) ?? [];
      const open = list
        .filter((j) => j.next_action && j.next_action_status !== "done")
        .sort(
          (a, b) =>
            new Date(a.next_action_due_at ?? "2999-01-01").getTime() -
            new Date(b.next_action_due_at ?? "2999-01-01").getTime(),
        )[0];
      const last = list
        .map((j) => j.updated_at as string)
        .sort()
        .slice(-1)[0];
      return {
        id: c.id,
        name: c.name,
        phone: c.phone ?? null,
        email: c.email ?? null,
        leadSource: c.lead_source ?? null,
        archivedAt: c.archived_at ?? null,
        projectCount: list.length,
        lastActivityAt: last ?? c.updated_at ?? null,
        nextAction: open?.next_action ?? null,
        nextActionDueAt: open?.next_action_due_at ?? null,
        nextActionStatus: open?.next_action_status ?? null,
      };
    });
}

export async function fetchClientProfile(clientId: string) {
  const { data: c, error } = await supabaseAdmin
    .from("clients")
    .select(
      "id, name, email, phone, notes, lead_source, preferred_contact_method, archived_at, created_at, updated_at",
    )
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!c) throw new Response("Not found", { status: 404 });
  const row = c as unknown as Row;

  const { data: props, error: pErr } = await supabaseAdmin
    .from("properties")
    .select("id, address, unit, city, province, postal_code, notes, archived_at")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (pErr) throw pErr;

  const { data: jobs, error: jErr } = await supabaseAdmin
    .from("ledger_jobs")
    .select(PIPELINE_COLS)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (jErr) throw jErr;

  const projects = ((jobs ?? []) as unknown as Row[]).map(rowToCard);

  let events: Array<{ id: string; jobId: string; kind: string; title: string; occurredAt: string }> =
    [];
  if (projects.length > 0) {
    const { data: ev, error: eErr } = await supabaseAdmin
      .from("ledger_job_events")
      .select("id, job_id, kind, title, occurred_at")
      .in(
        "job_id",
        projects.map((p) => p.id),
      )
      .order("occurred_at", { ascending: false })
      .limit(12);
    if (eErr) throw eErr;
    events = ((ev ?? []) as unknown as Row[]).map((e) => ({
      id: e.id,
      jobId: e.job_id,
      kind: e.kind,
      title: e.title,
      occurredAt: e.occurred_at,
    }));
  }

  return {
    client: {
      id: row.id,
      name: row.name,
      email: row.email ?? null,
      phone: row.phone ?? null,
      notes: row.notes ?? null,
      leadSource: row.lead_source ?? null,
      preferredContactMethod: row.preferred_contact_method ?? null,
      archivedAt: row.archived_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    properties: ((props ?? []) as unknown as Row[]).map((p) => ({
      id: p.id,
      address: p.address,
      unit: p.unit ?? null,
      city: p.city ?? null,
      province: p.province ?? null,
      postalCode: p.postal_code ?? null,
      notes: p.notes ?? null,
    })),
    projects,
    recentActivity: events,
  };
}

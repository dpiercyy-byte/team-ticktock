import { supabaseAdmin } from "./db.server";
import { logAudit } from "./audit.server";
import { stagesToStatus } from "./ledger-stages";
import { decideActivation, type CandidateSite } from "./activation-math";

export type ActivationInput = {
  projectId: string;
  clientId: string;
  propertyId: string | null;
  contractValue: number; // dollars
  address: string;
  lat: number;
  lng: number;
  radiusM: number;
  expectedStartDate: string | null; // yyyy-mm-dd
  label?: string | null;
};

export type ActivationResult = {
  jobSiteId: string | null;
  created: boolean;
  alreadyActivated: boolean;
};

/**
 * Idempotently connect an accepted project to a Clockwise client job site.
 * Running twice never creates a second site, a second project, or a second event.
 */
export async function activateProject(input: ActivationInput): Promise<ActivationResult> {
  const { data: project, error: pErr } = await supabaseAdmin
    .from("ledger_jobs")
    .select(
      "id, name, sales_stage, delivery_status, status, archived_at, activated_at, budget_cents, client_id, property_id, address, expected_start_date",
    )
    .eq("id", input.projectId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!project) throw new Response("Not found", { status: 404 });

  const row = project as unknown as Record<string, any>;
  if (row.archived_at) throw new Response("Project is archived", { status: 400 });
  if ((row.sales_stage ?? "") !== "Won") {
    throw new Response("Only accepted (Won) projects can be activated", { status: 400 });
  }

  const { data: sites, error: sErr } = await supabaseAdmin
    .from("job_sites")
    .select("id, address, kind, archived_at, project_id")
    .or(`project_id.eq.${input.projectId},project_id.is.null`);
  if (sErr) throw sErr;

  const decision = decideActivation({
    projectId: input.projectId,
    activatedAt: row.activated_at ?? null,
    address: input.address,
    sites: (sites ?? []) as unknown as CandidateSite[],
  });

  if (decision.action === "noop") {
    return { jobSiteId: decision.jobSiteId, created: false, alreadyActivated: true };
  }

  let jobSiteId = decision.jobSiteId;
  let created = false;
  const label = (input.label ?? "").trim() || row.name || input.address.split(",")[0].trim();

  if (decision.action === "create") {
    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("job_sites")
      .insert({
        label,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        radius_m: input.radiusM,
        kind: "client",
        project_id: input.projectId,
      } as never)
      .select("id")
      .single();
    if (iErr) throw iErr;
    jobSiteId = inserted.id;
    created = true;
    await logAudit({
      actor: { kind: "admin" },
      action: "job_site_create",
      entityType: "job_site",
      entityId: jobSiteId,
      after: { label, address: input.address, radius_m: input.radiusM, kind: "client", project_id: input.projectId },
      metadata: { via: "project_activation" },
    });
  } else if (decision.action === "link_existing" && jobSiteId) {
    const { error: uErr } = await supabaseAdmin
      .from("job_sites")
      .update({ project_id: input.projectId, radius_m: input.radiusM } as never)
      .eq("id", jobSiteId);
    if (uErr) throw uErr;
  } else if (decision.action === "reuse_linked" && jobSiteId) {
    const { error: uErr } = await supabaseAdmin
      .from("job_sites")
      .update({ radius_m: input.radiusM } as never)
      .eq("id", jobSiteId);
    if (uErr) throw uErr;
  }

  const before = {
    delivery_status: row.delivery_status ?? null,
    status: row.status,
    budget_cents: Number(row.budget_cents ?? 0),
    activated_at: row.activated_at ?? null,
  };
  const patch = {
    client_id: input.clientId,
    property_id: input.propertyId,
    budget_cents: Math.round(input.contractValue * 100),
    address: input.address,
    expected_start_date: input.expectedStartDate,
    delivery_status: "Preconstruction",
    status: stagesToStatus("Won", "Preconstruction"),
    activated_at: new Date().toISOString(),
  };
  const { error: upErr } = await supabaseAdmin
    .from("ledger_jobs")
    .update(patch as never)
    .eq("id", input.projectId);
  if (upErr) throw upErr;

  await supabaseAdmin.from("ledger_job_events").insert({
    job_id: input.projectId,
    kind: "job_activated",
    title: "Job activated",
    detail: `Connected to Clockwise site “${label}” (${input.radiusM} m geofence).`,
  } as never);

  await logAudit({
    actor: { kind: "admin" },
    action: "project_activate",
    entityType: "ledger_job",
    entityId: input.projectId,
    before,
    after: { ...patch, job_site_id: jobSiteId },
  });

  return { jobSiteId, created, alreadyActivated: false };
}

export async function fetchActivationState(projectId: string) {
  const { data: project, error } = await supabaseAdmin
    .from("ledger_jobs")
    .select(
      "id, name, sales_stage, delivery_status, activated_at, budget_cents, estimated_value_cents, client_id, property_id, address, expected_start_date, clients:client_id(id, name, email, phone), properties:property_id(id, address, latitude, longitude)",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!project) throw new Response("Not found", { status: 404 });
  const row = project as unknown as Record<string, any>;

  const { data: site } = await supabaseAdmin
    .from("job_sites")
    .select("id, label, address, lat, lng, radius_m, kind, archived_at")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .maybeSingle();

  return {
    project: {
      id: row.id,
      name: row.name,
      salesStage: row.sales_stage ?? null,
      deliveryStatus: row.delivery_status ?? null,
      activatedAt: row.activated_at ?? null,
      clientId: row.client_id ?? null,
      clientName: row.clients?.name ?? null,
      propertyId: row.property_id ?? null,
      propertyAddress: row.properties?.address ?? row.address ?? null,
      propertyLat: row.properties?.latitude ?? null,
      propertyLng: row.properties?.longitude ?? null,
      address: row.address ?? null,
      contractValue: Number(row.budget_cents ?? 0) / 100,
      estimatedValue: Number(row.estimated_value_cents ?? 0) / 100,
      expectedStartDate: row.expected_start_date ?? null,
    },
    site: site ?? null,
  };
}

export async function fetchProjectCrew(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("project_crew")
    .select("id, project_id, worker_id, role, assigned_at, removed_at, is_active, workers(name)")
    .eq("project_id", projectId)
    .order("assigned_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, any>>).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    workerId: r.worker_id,
    workerName: r.workers?.name ?? null,
    role: r.role ?? null,
    assignedAt: r.assigned_at,
    removedAt: r.removed_at ?? null,
    isActive: Boolean(r.is_active),
  }));
}

// Job workspace reads. Everything operational is calculated from the tables
// that already own it: Clockwise time entries, reimbursements, job sites.
import { supabaseAdmin } from "./db.server";
import {
  buildCostRows,
  buildLabourRows,
  buildPaymentRows,
  costTotals,
  labourTotals,
  mergeTimeline,
  paymentTotals,
  projectRollup,
  workersOnSite,
  type RawPayment,
  type RawReceipt,
  type RawTimeEntry,
  type RawWorker,
} from "./workspace-math";

const centsToDollars = (n: number | string | null | undefined) => Number(n ?? 0) / 100;

export type ProjectDocument = {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  storagePath: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

export async function loadWorkspace(projectId: string) {
  const { data: project, error: pErr } = await supabaseAdmin
    .from("ledger_jobs")
    .select(
      "id, name, client_name, client_id, address, project_type, trades, status, sales_stage, delivery_status, assigned_owner, next_action, next_action_due_at, expected_start_date, actual_start_date, expected_completion_date, actual_completion_date, budget_cents, activated_at, progress, clients:client_id(id, name, email, phone), properties:property_id(id, address)",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!project) throw new Response("Not found", { status: 404 });
  const p = project as unknown as Record<string, any>;

  const { data: siteRows, error: sErr } = await supabaseAdmin
    .from("job_sites")
    .select("id, label, address, radius_m, archived_at")
    .eq("project_id", projectId);
  if (sErr) throw sErr;
  const sites = (siteRows ?? []) as Array<Record<string, any>>;
  const siteIds = sites.map((s) => s.id as string);

  let entries: RawTimeEntry[] = [];
  let receipts: RawReceipt[] = [];
  let payments: RawPayment[] = [];
  let documents: ProjectDocument[] = [];

  if (siteIds.length > 0) {
    const list = `(${siteIds.join(",")})`;
    const { data: eRows, error: eErr } = await supabaseAdmin
      .from("time_entries")
      .select("id, worker_id, clock_in, clock_out, flagged_review, geo_status, project")
      .or(
        `job_site_id.in.${list},clock_out_job_site_id.in.${list},planned_job_site_id.in.${list},assigned_job_site_ids.ov.{${siteIds.join(",")}}`,
      )
      .order("clock_in", { ascending: false })
      .limit(1000);
    if (eErr) throw eErr;
    entries = (eRows ?? []) as unknown as RawTimeEntry[];

    const { data: rRows, error: rErr } = await supabaseAdmin
      .from("reimbursements")
      .select(
        "id, worker_id, payee_label, description, amount, created_at, receipt_url, receipt_mime, parsed_vendor, parsed_date, parsed_category, parsed_subtotal, parsed_tax, parsed_total, parse_status, material_type, billable_job_site_id",
      )
      .or(`billable_job_site_id.in.${list},parsed_job_site_id.in.${list}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (rErr) throw rErr;
    receipts = (rRows ?? []) as unknown as RawReceipt[];
  }

  const { data: payRows, error: payErr } = await supabaseAdmin
    .from("project_payments")
    .select(
      "id, description, amount_expected_cents, due_date, amount_received_cents, received_date, method, notes",
    )
    .eq("project_id", projectId);
  if (payErr) throw payErr;
  payments = (payRows ?? []) as unknown as RawPayment[];

  const { data: docRows, error: dErr } = await supabaseAdmin
    .from("project_documents")
    .select("id, kind, title, url, storage_path, uploaded_by, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (dErr) throw dErr;

  documents = await Promise.all(
    ((docRows ?? []) as Array<Record<string, any>>).map(async (d) => {
      let url: string | null = d.url ?? null;
      if (!url && d.storage_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("project-docs")
          .createSignedUrl(d.storage_path, 60 * 60);
        url = signed?.signedUrl ?? null;
      }
      return {
        id: d.id,
        kind: d.kind,
        title: d.title,
        url,
        storagePath: d.storage_path ?? null,
        uploadedBy: d.uploaded_by ?? null,
        createdAt: d.created_at,
      };
    }),
  );

  const workerIds = Array.from(
    new Set([
      ...entries.map((e) => e.worker_id),
      ...receipts.map((r) => r.worker_id).filter(Boolean),
    ]),
  ) as string[];
  let workers: RawWorker[] = [];
  if (workerIds.length > 0) {
    const { data: wRows, error: wErr } = await supabaseAdmin
      .from("workers")
      .select("id, name, hourly_rate")
      .in("id", workerIds);
    if (wErr) throw wErr;
    workers = (wRows ?? []) as unknown as RawWorker[];
  }

  const { data: evRows, error: evErr } = await supabaseAdmin
    .from("ledger_job_events")
    .select("id, kind, title, detail, occurred_at")
    .eq("job_id", projectId)
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (evErr) throw evErr;

  const labour = buildLabourRows(entries, workers);
  const costs = buildCostRows(receipts, workers);
  const paymentRows = buildPaymentRows(payments);
  const lTotals = labourTotals(labour);
  const cTotals = costTotals(costs);
  const pTotals = paymentTotals(paymentRows);

  const timeline = mergeTimeline({
    events: ((evRows ?? []) as Array<Record<string, any>>).map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      detail: e.detail ?? null,
      occurredAt: e.occurred_at,
    })),
    labour,
    costs,
    payments: paymentRows,
  });

  const rollup = projectRollup({
    contractValue: centsToDollars(p.budget_cents),
    labourCost: lTotals.cost,
    materialCost: cTotals.total,
    collected: pTotals.received,
  });

  const onSite = workersOnSite(labour);

  return {
    project: {
      id: p.id,
      name: p.name,
      client: p.clients?.name ?? p.client_name,
      clientId: p.client_id ?? null,
      clientPhone: p.clients?.phone ?? null,
      address: p.properties?.address ?? p.address,
      projectType: p.project_type,
      trades: p.trades ?? [],
      status: p.status,
      salesStage: p.sales_stage ?? null,
      deliveryStatus: p.delivery_status ?? null,
      assignedOwner: p.assigned_owner ?? null,
      nextAction: p.next_action ?? null,
      nextActionDueAt: p.next_action_due_at ?? null,
      expectedStartDate: p.expected_start_date ?? null,
      actualStartDate: p.actual_start_date ?? null,
      expectedCompletionDate: p.expected_completion_date ?? null,
      actualCompletionDate: p.actual_completion_date ?? null,
      activatedAt: p.activated_at ?? null,
      progress: p.progress ?? 0,
    },
    sites: sites.map((s) => ({
      id: s.id,
      label: s.label,
      address: s.address,
      radiusM: s.radius_m,
      archived: Boolean(s.archived_at),
    })),
    labour,
    labourTotals: lTotals,
    costs,
    costTotals: cTotals,
    payments: paymentRows,
    paymentTotals: pTotals,
    documents,
    timeline,
    rollup,
    onSite,
    openIssues: {
      flaggedEntries: lTotals.flagged,
      receiptsNeedingReview: cTotals.needsReview,
      overduePayments: pTotals.overdue,
      noJobSite: siteIds.length === 0,
    },
  };
}

export type WorkspacePayload = Awaited<ReturnType<typeof loadWorkspace>>;

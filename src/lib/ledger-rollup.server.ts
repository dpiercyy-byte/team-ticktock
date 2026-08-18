// Live cost rollup for Ledger job lists.
//
// ledger_jobs.expenses_cents is a legacy manual field that nothing writes to
// any more, so the job cards were always showing $0. Real cost lives in the
// source tables: sheet-imported project_costs, Clockwise time entries (labour)
// and receipts/reimbursements. This computes the same numbers the job
// workspace shows, but for many projects in one pass.
import { supabaseAdmin } from "./db.server";
import {
  buildCostRows,
  buildLabourRows,
  type RawReceipt,
  type RawTimeEntry,
  type RawWorker,
} from "./workspace-math";
import type { RawSegment } from "./segment-math";
import { costSummary, type ProjectCostRow, type ProjectCostCategory } from "./finance-math";
import { addressKey } from "./sheet-jobs-parse";

export type JobRollup = {
  labour: number;
  materials: number;
  other: number;
  total: number;
  collected: number;
};

const cents = (n: number | string | null | undefined) => Number(n ?? 0) / 100;

export async function loadJobRollups(
  projects: Array<{ id: string; address: string }>,
): Promise<Map<string, JobRollup>> {
  const out = new Map<string, JobRollup>();
  if (projects.length === 0) return out;
  const projectIds = projects.map((p) => p.id);

  // project -> its Clockwise geofences. Sites are matched on the project link
  // and, as a fallback, on the normalised street address so labour still lands
  // on the right job when the geofence was created outside the sheet sync.
  const byAddress = new Map<string, string>();
  for (const p of projects) {
    const key = addressKey(p.address ?? "");
    if (key && !byAddress.has(key)) byAddress.set(key, p.id);
  }
  const { data: siteRows } = await supabaseAdmin
    .from("job_sites")
    .select("id, project_id, address, kind")
    .is("archived_at", null);
  const siteToProject = new Map<string, string>();
  const sitesByProject = new Map<string, string[]>();
  for (const s of (siteRows ?? []) as Array<Record<string, any>>) {
    const pid: string | undefined =
      (s.project_id && projectIds.includes(s.project_id) ? s.project_id : undefined) ??
      ((s.kind ?? "client") === "client" ? byAddress.get(addressKey(s.address ?? "")) : undefined);
    if (!pid) continue;
    siteToProject.set(s.id, pid);
    sitesByProject.set(pid, [...(sitesByProject.get(pid) ?? []), s.id]);
  }
  const siteIds = [...siteToProject.keys()];

  const entriesByProject = new Map<string, RawTimeEntry[]>();
  const receiptsByProject = new Map<string, RawReceipt[]>();
  let segments: RawSegment[] = [];
  let workers: RawWorker[] = [];

  if (siteIds.length > 0) {
    const list = `(${siteIds.join(",")})`;
    const { data: eRows } = await supabaseAdmin
      .from("time_entries")
      .select(
        "id, worker_id, clock_in, clock_out, flagged_review, geo_status, project, job_site_id, clock_out_job_site_id, planned_job_site_id, assigned_job_site_ids",
      )
      .or(
        `job_site_id.in.${list},clock_out_job_site_id.in.${list},planned_job_site_id.in.${list},assigned_job_site_ids.ov.{${siteIds.join(",")}}`,
      )
      .limit(5000);
    const entries = (eRows ?? []) as Array<Record<string, any>>;

    for (const e of entries) {
      const hits = new Set<string>();
      for (const sid of [
        e.job_site_id,
        e.clock_out_job_site_id,
        e.planned_job_site_id,
        ...((e.assigned_job_site_ids ?? []) as string[]),
      ]) {
        const pid = sid ? siteToProject.get(sid) : undefined;
        if (pid) hits.add(pid);
      }
      for (const pid of hits) {
        entriesByProject.set(pid, [...(entriesByProject.get(pid) ?? []), e as RawTimeEntry]);
      }
    }

    if (entries.length > 0) {
      const { data: segRows } = await (supabaseAdmin.from("time_entry_segments") as any)
        .select("id, entry_id, started_at, ended_at, job_site_id, geo_status, source")
        .in(
          "entry_id",
          entries.map((e) => e.id),
        );
      segments = (segRows ?? []) as RawSegment[];
    }

    const { data: rRows } = await supabaseAdmin
      .from("reimbursements")
      .select(
        "id, worker_id, payee_label, description, amount, created_at, receipt_url, receipt_mime, parsed_vendor, parsed_date, parsed_category, parsed_subtotal, parsed_tax, parsed_total, parse_status, material_type, billable_job_site_id, parsed_job_site_id",
      )
      .or(`billable_job_site_id.in.${list},parsed_job_site_id.in.${list}`)
      .limit(5000);
    for (const r of (rRows ?? []) as Array<Record<string, any>>) {
      const pid =
        (r.billable_job_site_id && siteToProject.get(r.billable_job_site_id)) ||
        (r.parsed_job_site_id && siteToProject.get(r.parsed_job_site_id));
      if (!pid) continue;
      receiptsByProject.set(pid, [...(receiptsByProject.get(pid) ?? []), r as RawReceipt]);
    }

    const workerIds = Array.from(
      new Set([
        ...entries.map((e) => e.worker_id),
        ...[...receiptsByProject.values()].flat().map((r) => r.worker_id),
      ]),
    ).filter(Boolean) as string[];
    if (workerIds.length > 0) {
      const { data: wRows } = await supabaseAdmin
        .from("workers")
        .select("id, name, hourly_rate")
        .in("id", workerIds);
      workers = (wRows ?? []) as unknown as RawWorker[];
    }
  }

  const { data: pcRows } = await supabaseAdmin
    .from("project_costs")
    .select("id, project_id, category, description, vendor, amount_cents, incurred_on, client_billable, notes")
    .in("project_id", projectIds)
    .limit(10000);
  const costsByProject = new Map<string, ProjectCostRow[]>();
  for (const c of (pcRows ?? []) as Array<Record<string, any>>) {
    const row: ProjectCostRow = {
      id: c.id,
      category: (c.category ?? "other") as ProjectCostCategory,
      description: c.description,
      vendor: c.vendor ?? null,
      amount: cents(c.amount_cents),
      incurredOn: c.incurred_on ?? null,
      clientBillable: Boolean(c.client_billable),
      notes: c.notes ?? null,
    };
    costsByProject.set(c.project_id, [...(costsByProject.get(c.project_id) ?? []), row]);
  }

  const { data: payRows } = await supabaseAdmin
    .from("project_payments")
    .select("project_id, amount_received_cents")
    .in("project_id", projectIds)
    .limit(10000);
  const collected = new Map<string, number>();
  for (const p of (payRows ?? []) as Array<Record<string, any>>) {
    collected.set(p.project_id, (collected.get(p.project_id) ?? 0) + cents(p.amount_received_cents));
  }

  const now = Date.now();
  for (const pid of projectIds) {
    const labourRows = buildLabourRows(entriesByProject.get(pid) ?? [], workers, now, {
      segments,
      siteIds: sitesByProject.get(pid) ?? [],
    });
    const receiptRows = buildCostRows(receiptsByProject.get(pid) ?? [], workers);
    const s = costSummary({
      labour: labourRows,
      receipts: receiptRows,
      projectCosts: costsByProject.get(pid) ?? [],
    });
    out.set(pid, {
      labour: s.labourCost,
      materials: s.materials + s.reimbursements,
      other: s.subcontractors + s.permits + s.other,
      total: s.totalCost,
      collected: Math.round((collected.get(pid) ?? 0) * 100) / 100,
    });
  }
  return out;
}

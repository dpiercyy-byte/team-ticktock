// Pure job-workspace math. No database, no server-only imports.
// Everything here is derived from records that already own the data, so the
// workspace can never disagree with Clockwise.

import { hoursBetween } from "./payout-math";
import { segmentHours, type RawSegment } from "./segment-math";


export type RawTimeEntry = {
  id: string;
  worker_id: string;
  clock_in: string;
  clock_out: string | null;
  flagged_review: boolean | null;
  geo_status: string | null;
  project: string | null;
};

export type RawWorker = { id: string; name: string; hourly_rate: number | string };

export type LabourRow = {
  id: string;
  workerId: string;
  worker: string;
  date: string; // ISO of clock-in
  clockIn: string;
  clockOut: string | null;
  hours: number;
  rate: number;
  cost: number;
  open: boolean;
  flagged: boolean;
  geoStatus: string | null;
  /** True when the shift was split across more than one site. */
  partial?: boolean;

};

export type RawReceipt = {
  id: string;
  worker_id: string | null;
  payee_label: string | null;
  description: string | null;
  amount: number | string;
  created_at: string;
  receipt_url: string | null;
  receipt_mime: string | null;
  parsed_vendor: string | null;
  parsed_date: string | null;
  parsed_category: string | null;
  parsed_subtotal: number | string | null;
  parsed_tax: number | string | null;
  parsed_total: number | string | null;
  parse_status: string | null;
  material_type: string | null;
  billable_job_site_id: string | null;
};

export type CostRow = {
  id: string;
  vendor: string;
  date: string;
  category: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number;
  payee: string;
  receiptUrl: string | null;
  receiptMime: string | null;
  billable: boolean;
  /** True when a worker paid out of pocket (a reimbursement) rather than the company. */
  workerPaid: boolean;
  needsReview: boolean;
};

export type RawPayment = {
  id: string;
  description: string;
  amount_expected_cents: number | string;
  due_date: string | null;
  amount_received_cents: number | string;
  received_date: string | null;
  method: string | null;
  notes: string | null;
};

export type PaymentStatus = "paid" | "partial" | "overdue" | "due";

export type PaymentRow = {
  id: string;
  description: string;
  amountExpected: number;
  dueDate: string | null;
  amountReceived: number;
  receivedDate: string | null;
  method: string | null;
  notes: string | null;
  status: PaymentStatus;
};

export type WorkspaceEvent = {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  occurredAt: string;
  source: "project" | "clockwise" | "receipt" | "payment";
};

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

/* ---------------- Labour ---------------- */

export function buildLabourRows(
  entries: RawTimeEntry[],
  workers: RawWorker[],
  now: number = Date.now(),
  opts?: { segments?: RawSegment[]; siteIds?: string[] },
): LabourRow[] {
  const byId = new Map(workers.map((w) => [w.id, w]));
  const siteSet = opts?.siteIds ? new Set(opts.siteIds) : null;
  const segsByEntry = new Map<string, RawSegment[]>();
  for (const s of opts?.segments ?? []) {
    const list = segsByEntry.get(s.entry_id) ?? [];
    list.push(s);
    segsByEntry.set(s.entry_id, list);
  }
  return entries
    .map((e) => {
      const w = byId.get(e.worker_id);
      const rate = num(w?.hourly_rate);
      const end = e.clock_out ?? new Date(now).toISOString();
      let hours = Math.max(0, hoursBetween(e.clock_in, end));
      let partial = false;
      const segs = segsByEntry.get(e.id);
      if (segs && segs.length > 0) {
        // Charge only the time actually spent at this project's sites.
        const scoped = siteSet ? segs.filter((s) => s.job_site_id && siteSet.has(s.job_site_id)) : segs;
        const segHours = scoped.reduce((sum, s) => sum + segmentHours(s, now), 0);
        partial = segs.length > 1;
        hours = segHours;
      }
      return {
        id: e.id,
        workerId: e.worker_id,
        worker: w?.name ?? "Unknown worker",
        date: e.clock_in,
        clockIn: e.clock_in,
        clockOut: e.clock_out,
        hours: Math.round(hours * 100) / 100,
        rate,
        cost: Math.round(hours * rate * 100) / 100,
        open: !e.clock_out,
        flagged: Boolean(e.flagged_review),
        geoStatus: e.geo_status ?? null,
        partial,
      };
    })
    .filter((r) => r.hours > 0 || r.open)
    .sort((a, b) => +new Date(b.clockIn) - +new Date(a.clockIn));
}


export function labourTotals(rows: LabourRow[]) {
  return rows.reduce(
    (acc, r) => ({
      hours: Math.round((acc.hours + r.hours) * 100) / 100,
      cost: Math.round((acc.cost + r.cost) * 100) / 100,
      flagged: acc.flagged + (r.flagged ? 1 : 0),
    }),
    { hours: 0, cost: 0, flagged: 0 },
  );
}

/** Workers on site = distinct workers with an open entry on this project. */
export function workersOnSite(rows: LabourRow[]): LabourRow[] {
  const seen = new Set<string>();
  const out: LabourRow[] = [];
  for (const r of rows) {
    if (!r.open || seen.has(r.workerId)) continue;
    seen.add(r.workerId);
    out.push(r);
  }
  return out;
}

/* ---------------- Costs ---------------- */

export function buildCostRows(receipts: RawReceipt[], workers: RawWorker[]): CostRow[] {
  const byId = new Map(workers.map((w) => [w.id, w.name]));
  return receipts
    .map((r) => {
      const total = r.parsed_total != null ? num(r.parsed_total) : num(r.amount);
      return {
        id: r.id,
        vendor: r.parsed_vendor ?? r.description ?? "Receipt",
        date: r.parsed_date ?? r.created_at,
        category: r.parsed_category ?? null,
        subtotal: r.parsed_subtotal != null ? num(r.parsed_subtotal) : null,
        tax: r.parsed_tax != null ? num(r.parsed_tax) : null,
        total,
        payee: r.payee_label ?? (r.worker_id ? byId.get(r.worker_id) ?? "Worker" : "Admin"),
        receiptUrl: r.receipt_url ?? null,
        receiptMime: r.receipt_mime ?? null,
        billable: (r.material_type ?? "regular") === "client_billable",
        workerPaid: Boolean(r.worker_id),
        needsReview: (r.parse_status ?? "") !== "ok" && (r.parse_status ?? "") !== "manual",
      };
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function costTotals(rows: CostRow[]) {
  return rows.reduce(
    (acc, r) => ({
      total: Math.round((acc.total + r.total) * 100) / 100,
      billable: Math.round((acc.billable + (r.billable ? r.total : 0)) * 100) / 100,
      needsReview: acc.needsReview + (r.needsReview ? 1 : 0),
    }),
    { total: 0, billable: 0, needsReview: 0 },
  );
}

/* ---------------- Payments ---------------- */

export function paymentStatus(p: RawPayment, now: number = Date.now()): PaymentStatus {
  const expected = num(p.amount_expected_cents) / 100;
  const received = num(p.amount_received_cents) / 100;
  if (received > 0 && received >= expected) return "paid";
  if (p.due_date && new Date(p.due_date + "T23:59:59").getTime() < now) return "overdue";
  if (received > 0) return "partial";
  return "due";
}

export function buildPaymentRows(payments: RawPayment[], now: number = Date.now()): PaymentRow[] {
  return payments
    .map((p) => ({
      id: p.id,
      description: p.description,
      amountExpected: num(p.amount_expected_cents) / 100,
      dueDate: p.due_date ?? null,
      amountReceived: num(p.amount_received_cents) / 100,
      receivedDate: p.received_date ?? null,
      method: p.method ?? null,
      notes: p.notes ?? null,
      status: paymentStatus(p, now),
    }))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

export function paymentTotals(rows: PaymentRow[]) {
  return rows.reduce(
    (acc, r) => ({
      expected: Math.round((acc.expected + r.amountExpected) * 100) / 100,
      received: Math.round((acc.received + r.amountReceived) * 100) / 100,
      overdue: acc.overdue + (r.status === "overdue" ? 1 : 0),
    }),
    { expected: 0, received: 0, overdue: 0 },
  );
}

/* ---------------- One timeline ---------------- */

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Merge the canonical project events with operational facts read from the
 * systems that own them. Nothing here is stored a second time.
 */
export function mergeTimeline(input: {
  events: Array<{ id: string; kind: string; title: string; detail: string | null; occurredAt: string }>;
  labour: LabourRow[];
  costs: CostRow[];
  payments: PaymentRow[];
}): WorkspaceEvent[] {
  const out: WorkspaceEvent[] = input.events.map((e) => ({
    id: `event:${e.id}`,
    kind: e.kind,
    title: e.title,
    detail: e.detail,
    occurredAt: e.occurredAt,
    source: "project" as const,
  }));

  for (const l of input.labour) {
    out.push({
      id: `clockin:${l.id}`,
      kind: "clockin",
      title: `${l.worker} clocked in`,
      detail: l.geoStatus === "offsite" ? "Off-site GPS" : null,
      occurredAt: l.clockIn,
      source: "clockwise",
    });
    if (l.clockOut) {
      out.push({
        id: `clockout:${l.id}`,
        kind: "clockout",
        title: `${l.worker} clocked out`,
        detail: `${l.hours.toFixed(2)} h · in ${hhmm(l.clockIn)}`,
        occurredAt: l.clockOut,
        source: "clockwise",
      });
    }
  }

  for (const c of input.costs) {
    out.push({
      id: `receipt:${c.id}`,
      kind: "receipt",
      title: `${c.vendor} — $${c.total.toFixed(2)}`,
      detail: [c.payee, c.billable ? "Client billable" : null].filter(Boolean).join(" · ") || null,
      occurredAt: c.date,
      source: "receipt",
    });
  }

  for (const p of input.payments) {
    if (p.amountReceived > 0 && p.receivedDate) {
      out.push({
        id: `payment:${p.id}`,
        kind: "payment",
        title: `Payment received — $${p.amountReceived.toFixed(2)}`,
        detail: [p.description, p.method].filter(Boolean).join(" · ") || null,
        occurredAt: p.receivedDate,
        source: "payment",
      });
    }
  }

  return out.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
}

/* ---------------- Rollups ---------------- */

export function projectRollup(input: {
  contractValue: number;
  labourCost: number;
  materialCost: number;
  collected: number;
}) {
  const recordedCosts = Math.round((input.labourCost + input.materialCost) * 100) / 100;
  return {
    contractValue: input.contractValue,
    collected: input.collected,
    labourCost: Math.round(input.labourCost * 100) / 100,
    materialCost: Math.round(input.materialCost * 100) / 100,
    recordedCosts,
    preliminaryProfit: Math.round((input.contractValue - recordedCosts) * 100) / 100,
    outstanding: Math.round((input.contractValue - input.collected) * 100) / 100,
  };
}

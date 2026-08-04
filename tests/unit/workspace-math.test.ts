import { describe, expect, it } from "vitest";
import {
  buildCostRows,
  buildLabourRows,
  buildPaymentRows,
  costTotals,
  labourTotals,
  mergeTimeline,
  paymentStatus,
  paymentTotals,
  projectRollup,
  workersOnSite,
  type RawPayment,
  type RawReceipt,
  type RawTimeEntry,
} from "@/lib/workspace-math";

const NOW = new Date("2026-08-10T18:00:00Z").getTime();

const workers = [
  { id: "w1", name: "Ana", hourly_rate: 40 },
  { id: "w2", name: "Bo", hourly_rate: "30" },
];

const entry = (over: Partial<RawTimeEntry>): RawTimeEntry => ({
  id: "e1",
  worker_id: "w1",
  clock_in: "2026-08-10T14:00:00Z",
  clock_out: "2026-08-10T18:00:00Z",
  flagged_review: false,
  geo_status: "verified",
  project: null,
  ...over,
});

describe("labour", () => {
  it("costs hours at the worker's rate", () => {
    const rows = buildLabourRows([entry({})], workers, NOW);
    expect(rows[0]).toMatchObject({ worker: "Ana", hours: 4, rate: 40, cost: 160, open: false });
  });

  it("treats an open entry as running until now", () => {
    const rows = buildLabourRows(
      [entry({ id: "e2", worker_id: "w2", clock_in: "2026-08-10T16:00:00Z", clock_out: null })],
      workers,
      NOW,
    );
    expect(rows[0]).toMatchObject({ hours: 2, cost: 60, open: true });
  });

  it("totals hours, cost and flags", () => {
    const rows = buildLabourRows(
      [entry({}), entry({ id: "e2", worker_id: "w2", flagged_review: true })],
      workers,
      NOW,
    );
    expect(labourTotals(rows)).toEqual({ hours: 8, cost: 280, flagged: 1 });
  });

  it("derives workers on site from open entries only, once per worker", () => {
    const rows = buildLabourRows(
      [
        entry({ id: "a", clock_out: null }),
        entry({ id: "b", clock_out: null }),
        entry({ id: "c", worker_id: "w2" }),
      ],
      workers,
      NOW,
    );
    expect(workersOnSite(rows).map((r) => r.worker)).toEqual(["Ana"]);
  });
});

const receipt = (over: Partial<RawReceipt>): RawReceipt => ({
  id: "r1",
  worker_id: "w1",
  payee_label: null,
  description: "Lumber",
  amount: 100,
  created_at: "2026-08-09T12:00:00Z",
  receipt_url: null,
  receipt_mime: null,
  parsed_vendor: "Home Depot",
  parsed_date: "2026-08-09",
  parsed_category: "Materials",
  parsed_subtotal: 88.5,
  parsed_tax: 11.5,
  parsed_total: 100,
  parse_status: "ok",
  material_type: "regular",
  billable_job_site_id: null,
  ...over,
});

describe("costs", () => {
  it("prefers the parsed total and names the payee", () => {
    const rows = buildCostRows([receipt({})], workers);
    expect(rows[0]).toMatchObject({ vendor: "Home Depot", total: 100, payee: "Ana", billable: false });
  });

  it("separates client-billable spend and flags unparsed receipts", () => {
    const rows = buildCostRows(
      [
        receipt({}),
        receipt({ id: "r2", material_type: "client_billable", parsed_total: 250, parse_status: "pending" }),
      ],
      workers,
    );
    expect(costTotals(rows)).toEqual({ total: 350, billable: 250, needsReview: 1 });
  });
});

const payment = (over: Partial<RawPayment>): RawPayment => ({
  id: "p1",
  description: "Deposit",
  amount_expected_cents: 100000,
  due_date: "2026-08-01",
  amount_received_cents: 0,
  received_date: null,
  method: null,
  notes: null,
  ...over,
});

describe("payments", () => {
  it("marks a fully received payment paid", () => {
    expect(paymentStatus(payment({ amount_received_cents: 100000 }), NOW)).toBe("paid");
  });
  it("marks a past-due unpaid payment overdue", () => {
    expect(paymentStatus(payment({}), NOW)).toBe("overdue");
  });
  it("marks a future unpaid payment due", () => {
    expect(paymentStatus(payment({ due_date: "2026-09-01" }), NOW)).toBe("due");
  });
  it("marks a short payment partial when not past due", () => {
    expect(
      paymentStatus(payment({ due_date: "2026-09-01", amount_received_cents: 50000 }), NOW),
    ).toBe("partial");
  });
  it("totals expected, received and overdue count", () => {
    const rows = buildPaymentRows(
      [payment({}), payment({ id: "p2", due_date: "2026-09-01", amount_received_cents: 25000 })],
      NOW,
    );
    expect(paymentTotals(rows)).toEqual({ expected: 2000, received: 250, overdue: 1 });
  });
});

describe("timeline", () => {
  it("merges project events with clock, receipt and payment facts, newest first", () => {
    const labour = buildLabourRows([entry({})], workers, NOW);
    const costs = buildCostRows([receipt({})], workers);
    const payments = buildPaymentRows(
      [payment({ amount_received_cents: 100000, received_date: "2026-08-08" })],
      NOW,
    );
    const merged = mergeTimeline({
      events: [
        {
          id: "ev1",
          kind: "created",
          title: "Project created",
          detail: null,
          occurredAt: "2026-08-01T00:00:00Z",
        },
      ],
      labour,
      costs,
      payments,
    });
    expect(merged.map((e) => e.id)).toEqual([
      "clockout:e1",
      "clockin:e1",
      "receipt:r1",
      "payment:p1",
      "event:ev1",
    ]);
  });

  it("does not emit a payment event before money is received", () => {
    const merged = mergeTimeline({
      events: [],
      labour: [],
      costs: [],
      payments: buildPaymentRows([payment({})], NOW),
    });
    expect(merged).toEqual([]);
  });
});

describe("rollup", () => {
  it("derives recorded costs and preliminary profit from the parts", () => {
    expect(
      projectRollup({ contractValue: 10000, labourCost: 2000, materialCost: 1500, collected: 4000 }),
    ).toEqual({
      contractValue: 10000,
      collected: 4000,
      labourCost: 2000,
      materialCost: 1500,
      recordedCosts: 3500,
      preliminaryProfit: 6500,
      outstanding: 6000,
    });
  });
});

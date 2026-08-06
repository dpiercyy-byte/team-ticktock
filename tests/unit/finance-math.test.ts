import { describe, expect, it } from "vitest";
import {
  costSummary,
  financeFingerprint,
  forecastCost,
  projectFinancials,
  revenueSummary,
  type ChangeOrderRow,
  type ProjectCostRow,
} from "@/lib/finance-math";
import type { CostRow, LabourRow, PaymentRow } from "@/lib/workspace-math";

const co = (over: Partial<ChangeOrderRow>): ChangeOrderRow => ({
  id: "co",
  description: "Extra tile",
  amount: 1000,
  status: "approved",
  approvedDate: "2026-01-10",
  notes: null,
  ...over,
});

const receipt = (over: Partial<CostRow>): CostRow =>
  ({
    id: "r",
    date: "2026-01-05",
    vendor: "Home Depot",
    description: "Lumber",
    category: "materials",
    worker: "Colin",
    total: 100,
    billable: false,
    workerPaid: false,
    needsReview: false,
  }) as CostRow;

const labour = (cost: number): LabourRow => ({ cost }) as LabourRow;

const payment = (received: number): PaymentRow =>
  ({ amountReceived: received, amountExpected: received }) as PaymentRow;

const cost = (over: Partial<ProjectCostRow>): ProjectCostRow => ({
  id: "c",
  category: "subcontractor",
  description: "Electrical",
  vendor: null,
  amount: 500,
  incurredOn: null,
  clientBillable: false,
  notes: null,
  ...over,
});

describe("revenueSummary", () => {
  it("counts only approved change orders in the revised contract", () => {
    const r = revenueSummary({
      originalContract: 10000,
      changeOrders: [co({}), co({ id: "b", amount: 400, status: "draft" }), co({ id: "c", amount: 900, status: "rejected" })],
      paymentsReceived: 4000,
    });
    expect(r.approvedChangeOrders).toBe(1000);
    expect(r.pendingChangeOrders).toBe(400);
    expect(r.revisedContract).toBe(11000);
    expect(r.outstanding).toBe(7000);
  });
});

describe("costSummary", () => {
  it("separates company cost, reimbursements and client-billable purchases", () => {
    const c = costSummary({
      labour: [labour(1200), labour(300)],
      receipts: [
        receipt({}),
        { ...receipt({}), id: "r2", total: 250, workerPaid: true },
        { ...receipt({}), id: "r3", total: 900, billable: true },
      ],
      projectCosts: [
        cost({}),
        cost({ id: "c2", category: "permit", amount: 150 }),
        cost({ id: "c3", category: "other", amount: 75 }),
        cost({ id: "c4", amount: 600, clientBillable: true }),
      ],
    });
    expect(c.materials).toBe(100);
    expect(c.reimbursements).toBe(250);
    expect(c.clientBillableTotal).toBe(1500);
    expect(c.subcontractors).toBe(500);
    expect(c.permits).toBe(150);
    expect(c.other).toBe(75);
    expect(c.labourCost).toBe(1500);
    // client-billable amounts are excluded from company cost
    expect(c.totalCost).toBe(2575);
  });
});

describe("forecastCost", () => {
  it("extrapolates over progress and refuses to guess too early", () => {
    expect(forecastCost(5000, 50)).toBe(10000);
    expect(forecastCost(5000, 100)).toBe(5000);
    expect(forecastCost(5000, 2)).toBeNull();
  });
});

describe("projectFinancials", () => {
  const f = projectFinancials({
    originalContract: 20000,
    progress: 50,
    changeOrders: [co({})],
    payments: [payment(6000), payment(2000)],
    labour: [labour(4000)],
    receipts: [receipt({}), { ...receipt({}), id: "r2", total: 900, billable: true }],
    projectCosts: [cost({})],
  });

  it("rolls revenue, labour, receipts and payments into one summary", () => {
    expect(f.results.totalRevenue).toBe(21000);
    expect(f.results.totalCost).toBe(4600);
    expect(f.results.grossProfit).toBe(16400);
    expect(f.results.grossMargin).toBeCloseTo(78.1, 1);
    expect(f.results.forecastCost).toBe(9200);
    expect(f.results.forecastProfit).toBe(11800);
    expect(f.results.percentCollected).toBeCloseTo(38.1, 1);
  });

  it("fingerprints change when a source figure changes", () => {
    const other = projectFinancials({
      originalContract: 20000,
      progress: 50,
      changeOrders: [co({})],
      payments: [payment(6000)],
      labour: [labour(4000)],
      receipts: [receipt({})],
      projectCosts: [cost({})],
    });
    expect(financeFingerprint(f)).not.toBe(financeFingerprint(other));
    expect(financeFingerprint(f)).toBe(financeFingerprint({ ...f }));
  });
});

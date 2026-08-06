// Pure project financial reporting math.
// Nothing here is stored: every figure is derived from the records that own it
// (Clockwise time entries, receipts/reimbursements, the payment register,
// change orders and manually recorded project costs).
//
// This is operational job costing, not an accounting or tax ledger.

import type { CostRow, LabourRow, PaymentRow } from "./workspace-math";

export type ChangeOrderStatus = "draft" | "approved" | "rejected";

export type ChangeOrderRow = {
  id: string;
  description: string;
  amount: number;
  status: ChangeOrderStatus;
  approvedDate: string | null;
  notes: string | null;
};

export type ProjectCostCategory =
  | "material"
  | "finish_material"
  | "subcontractor"
  | "permit"
  | "other";

export type ProjectCostRow = {
  id: string;
  category: ProjectCostCategory;
  description: string;
  vendor: string | null;
  amount: number;
  incurredOn: string | null;
  clientBillable: boolean;
  notes: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/* ---------------- Revenue ---------------- */

export function revenueSummary(input: {
  originalContract: number;
  changeOrders: ChangeOrderRow[];
  paymentsReceived: number;
}) {
  const approvedChangeOrders = r2(
    input.changeOrders
      .filter((c) => c.status === "approved")
      .reduce((s, c) => s + c.amount, 0),
  );
  const revisedContract = r2(input.originalContract + approvedChangeOrders);
  return {
    originalContract: r2(input.originalContract),
    approvedChangeOrders,
    pendingChangeOrders: r2(
      input.changeOrders.filter((c) => c.status === "draft").reduce((s, c) => s + c.amount, 0),
    ),
    revisedContract,
    received: r2(input.paymentsReceived),
    outstanding: r2(revisedContract - input.paymentsReceived),
  };
}

/* ---------------- Costs ---------------- */

/**
 * Receipt spend splits three ways:
 *  - client-billable materials (recovered from the client, never a company cost)
 *  - worker reimbursements (a receipt a worker paid out of pocket)
 *  - materials (company-paid receipts)
 */
export function costSummary(input: {
  labour: LabourRow[];
  receipts: CostRow[];
  projectCosts: ProjectCostRow[];
}) {
  let materials = 0;
  let clientBillableMaterials = 0;
  let reimbursements = 0;
  for (const c of input.receipts) {
    if (c.billable) clientBillableMaterials += c.total;
    else if (c.workerPaid) reimbursements += c.total;
    else materials += c.total;
  }

  let subcontractors = 0;
  let permits = 0;
  let other = 0;
  let clientBillableOther = 0;
  for (const c of input.projectCosts) {
    if (c.clientBillable) {
      clientBillableOther += c.amount;
      continue;
    }
    if (c.category === "subcontractor") subcontractors += c.amount;
    else if (c.category === "permit") permits += c.amount;
    else if (c.category === "material" || c.category === "finish_material")
      materials += c.amount;
    else other += c.amount;
  }

  const labourCost = r2(input.labour.reduce((s, l) => s + l.cost, 0));
  const companyCost = r2(
    materials + reimbursements + subcontractors + permits + other + labourCost,
  );

  return {
    materials: r2(materials),
    clientBillableMaterials: r2(clientBillableMaterials),
    clientBillableOther: r2(clientBillableOther),
    clientBillableTotal: r2(clientBillableMaterials + clientBillableOther),
    reimbursements: r2(reimbursements),
    subcontractors: r2(subcontractors),
    permits: r2(permits),
    other: r2(other),
    labourCost,
    /** Company cost only — client-billable purchases are excluded on purpose. */
    totalCost: companyCost,
  };
}

/* ---------------- Forecast ---------------- */

/**
 * Forecast cost extrapolates recorded cost over reported progress. Below the
 * floor there is not enough recorded work to project anything honest, so the
 * forecast is reported as unavailable rather than guessed.
 */
const FORECAST_PROGRESS_FLOOR = 5;

export function forecastCost(recordedCost: number, progress: number): number | null {
  if (progress >= 100) return r2(recordedCost);
  if (progress < FORECAST_PROGRESS_FLOOR) return null;
  return r2(recordedCost / (progress / 100));
}

/* ---------------- One summary ---------------- */

export function projectFinancials(input: {
  originalContract: number;
  progress: number;
  changeOrders: ChangeOrderRow[];
  payments: PaymentRow[];
  labour: LabourRow[];
  receipts: CostRow[];
  projectCosts: ProjectCostRow[];
}) {
  const paymentsReceived = input.payments.reduce((s, p) => s + p.amountReceived, 0);
  const revenue = revenueSummary({
    originalContract: input.originalContract,
    changeOrders: input.changeOrders,
    paymentsReceived,
  });
  const costs = costSummary({
    labour: input.labour,
    receipts: input.receipts,
    projectCosts: input.projectCosts,
  });

  const totalRevenue = revenue.revisedContract;
  const grossProfit = r2(totalRevenue - costs.totalCost);
  const grossMargin = totalRevenue > 0 ? r2((grossProfit / totalRevenue) * 100) : null;

  const fCost = forecastCost(costs.totalCost, input.progress);
  const forecastProfit = fCost == null ? null : r2(totalRevenue - fCost);
  const forecastMargin =
    forecastProfit == null || totalRevenue <= 0
      ? null
      : r2((forecastProfit / totalRevenue) * 100);

  return {
    revenue,
    costs,
    results: {
      totalRevenue,
      totalCost: costs.totalCost,
      grossProfit,
      grossMargin,
      forecastCost: fCost,
      forecastProfit,
      forecastMargin,
      percentCollected:
        totalRevenue > 0 ? r2((revenue.received / totalRevenue) * 100) : null,
    },
  };
}

export type ProjectFinancials = ReturnType<typeof projectFinancials>;

/**
 * A stable fingerprint of everything the Sheets summary export writes, so the
 * app can tell when the exported row no longer matches the source records.
 */
export function financeFingerprint(f: ProjectFinancials): string {
  const parts = [
    f.revenue.originalContract,
    f.revenue.approvedChangeOrders,
    f.revenue.revisedContract,
    f.revenue.received,
    f.revenue.outstanding,
    f.costs.materials,
    f.costs.clientBillableTotal,
    f.costs.reimbursements,
    f.costs.subcontractors,
    f.costs.permits,
    f.costs.other,
    f.costs.labourCost,
    f.results.totalCost,
    f.results.grossProfit,
  ];
  return parts.map((n) => n.toFixed(2)).join("|");
}

export const LEDGER_SALES_STAGES = [
  "New Lead",
  "Contacted",
  "Qualified",
  "Site Visit",
  "Estimating",
  "Estimate Sent",
  "Follow-Up",
  "Won",
  "Lost",
] as const;

export const LEDGER_DELIVERY_STATUSES = [
  "Not Started",
  "Preconstruction",
  "Scheduled",
  "Active",
  "Paused",
  "Completed",
  "Warranty",
] as const;

export type LedgerSalesStage = (typeof LEDGER_SALES_STAGES)[number];
export type LedgerDeliveryStatus = (typeof LEDGER_DELIVERY_STATUSES)[number];

/** Legacy single-axis status -> the two canonical axes. */
export function statusToStages(status: string): {
  salesStage: LedgerSalesStage;
  deliveryStatus: LedgerDeliveryStatus;
} {
  switch (status) {
    case "Site Visit Required":
      return { salesStage: "Site Visit", deliveryStatus: "Not Started" };
    case "Estimate Required":
      return { salesStage: "Estimating", deliveryStatus: "Not Started" };
    case "Waiting For Approval":
      return { salesStage: "Estimate Sent", deliveryStatus: "Not Started" };
    case "Scheduled":
      return { salesStage: "Won", deliveryStatus: "Scheduled" };
    case "Active":
      return { salesStage: "Won", deliveryStatus: "Active" };
    case "Completed":
      return { salesStage: "Won", deliveryStatus: "Completed" };
    case "Lead":
    default:
      return { salesStage: "New Lead", deliveryStatus: "Not Started" };
  }
}

/** The two canonical axes -> legacy single-axis status (kept in sync for rollback). */
export function stagesToStatus(
  salesStage: string,
  deliveryStatus: string,
): string {
  if (deliveryStatus === "Completed" || deliveryStatus === "Warranty") return "Completed";
  if (deliveryStatus === "Active" || deliveryStatus === "Paused") return "Active";
  if (deliveryStatus === "Scheduled" || deliveryStatus === "Preconstruction") return "Scheduled";
  switch (salesStage) {
    case "Site Visit":
      return "Site Visit Required";
    case "Estimating":
      return "Estimate Required";
    case "Estimate Sent":
    case "Follow-Up":
      return "Waiting For Approval";
    case "Won":
      return "Scheduled";
    default:
      return "Lead";
  }
}

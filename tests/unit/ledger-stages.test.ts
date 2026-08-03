import { describe, expect, it } from "vitest";
import {
  LEDGER_DELIVERY_STATUSES,
  LEDGER_SALES_STAGES,
  stagesToStatus,
  statusToStages,
} from "@/lib/ledger-stages";

describe("statusToStages", () => {
  const cases: Array<[string, string, string]> = [
    ["Lead", "New Lead", "Not Started"],
    ["Site Visit Required", "Site Visit", "Not Started"],
    ["Estimate Required", "Estimating", "Not Started"],
    ["Waiting For Approval", "Estimate Sent", "Not Started"],
    ["Scheduled", "Won", "Scheduled"],
    ["Active", "Won", "Active"],
    ["Completed", "Won", "Completed"],
  ];

  it.each(cases)("maps %s -> %s / %s", (status, sales, delivery) => {
    expect(statusToStages(status)).toEqual({ salesStage: sales, deliveryStatus: delivery });
  });

  it("falls back to New Lead / Not Started for unknown statuses", () => {
    expect(statusToStages("Something Else")).toEqual({
      salesStage: "New Lead",
      deliveryStatus: "Not Started",
    });
  });

  it("only ever produces valid canonical values", () => {
    for (const [status] of cases) {
      const { salesStage, deliveryStatus } = statusToStages(status);
      expect(LEDGER_SALES_STAGES).toContain(salesStage);
      expect(LEDGER_DELIVERY_STATUSES).toContain(deliveryStatus);
    }
  });
});

describe("stagesToStatus", () => {
  it("prefers delivery status once construction has begun", () => {
    expect(stagesToStatus("Won", "Active")).toBe("Active");
    expect(stagesToStatus("Won", "Paused")).toBe("Active");
    expect(stagesToStatus("Won", "Warranty")).toBe("Completed");
    expect(stagesToStatus("Won", "Preconstruction")).toBe("Scheduled");
  });

  it("falls back to the sales stage before delivery starts", () => {
    expect(stagesToStatus("New Lead", "Not Started")).toBe("Lead");
    expect(stagesToStatus("Site Visit", "Not Started")).toBe("Site Visit Required");
    expect(stagesToStatus("Estimating", "Not Started")).toBe("Estimate Required");
    expect(stagesToStatus("Follow-Up", "Not Started")).toBe("Waiting For Approval");
    expect(stagesToStatus("Lost", "Not Started")).toBe("Lead");
  });

  it("round-trips every legacy status", () => {
    for (const status of [
      "Lead",
      "Site Visit Required",
      "Estimate Required",
      "Waiting For Approval",
      "Scheduled",
      "Active",
      "Completed",
    ]) {
      const { salesStage, deliveryStatus } = statusToStages(status);
      expect(stagesToStatus(salesStage, deliveryStatus)).toBe(status);
    }
  });
});

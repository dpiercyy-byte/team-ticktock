import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  endOfWeek,
  hoursBetween,
  payoutStatus,
  startOfWeekISO,
  sumAmounts,
  sumHours,
  tipFor,
} from "@/lib/payout-math";

describe("week bucketing", () => {
  it("snaps any day to the preceding Sunday", () => {
    // 2026-03-12 is a Thursday; the week starts Sunday 2026-03-08.
    expect(startOfWeekISO(new Date("2026-03-12T13:05:00"))).toBe("2026-03-08");
    expect(startOfWeekISO(new Date("2026-03-08T00:00:00"))).toBe("2026-03-08");
    expect(startOfWeekISO(new Date("2026-03-14T23:59:00"))).toBe("2026-03-08");
    // Sunday the 15th rolls into the next bucket.
    expect(startOfWeekISO(new Date("2026-03-15T00:01:00"))).toBe("2026-03-15");
  });

  it("computes the inclusive week end and the exclusive boundary", () => {
    expect(addDaysISO("2026-03-08", 6)).toBe("2026-03-14");
    expect(endOfWeek("2026-03-08").toISOString().slice(0, 10)).toBe("2026-03-15");
  });
});

describe("hours and money", () => {
  it("computes hours between two stamps", () => {
    expect(hoursBetween("2026-03-12T13:00:00Z", "2026-03-12T21:30:00Z")).toBe(8.5);
  });

  it("sums only closed entries", () => {
    const hours = sumHours([
      { clock_in: "2026-03-12T13:00:00Z", clock_out: "2026-03-12T21:00:00Z" },
      { clock_in: "2026-03-13T13:00:00Z", clock_out: "2026-03-13T17:00:00Z" },
      { clock_in: "2026-03-14T13:00:00Z", clock_out: null }, // still clocked in
    ]);
    expect(hours).toBe(12);
  });

  it("sums reimbursement amounts from strings or numbers", () => {
    expect(sumAmounts([{ amount: "12.50" }, { amount: 7.25 }])).toBe(19.75);
    expect(sumAmounts([])).toBe(0);
    expect(sumAmounts(null)).toBe(0);
  });

  it("derives wages and total the same way the payout screen does", () => {
    const hours = sumHours([
      { clock_in: "2026-03-12T13:00:00Z", clock_out: "2026-03-12T21:00:00Z" },
    ]);
    const rate = 34;
    const reimb = sumAmounts([{ amount: 19.75 }]);
    expect(hours * rate).toBe(272);
    expect(hours * rate + reimb).toBe(291.75);
  });

  it("computes a tip as the overpayment above the computed amount", () => {
    expect(tipFor(291.75, 300)).toBe(8.25);
    expect(tipFor(291.75, 291.75)).toBe(0);
    expect(tipFor(291.75, 280)).toBe(-11.75);
  });
});

describe("payoutStatus", () => {
  const now = new Date("2026-03-20T12:00:00").getTime();

  it("is paid whenever a payout row exists, regardless of age", () => {
    expect(payoutStatus("2020-01-05", true, now)).toBe("paid");
  });

  it("is unpaid for a recently closed week", () => {
    expect(payoutStatus("2026-03-08", false, now)).toBe("unpaid");
  });

  it("is unpaid on the 13th day after week end and overdue on the 14th", () => {
    const weekStart = "2026-03-01"; // ends 2026-03-07T23:59:59
    const end = new Date("2026-03-07T23:59:59").getTime();
    expect(payoutStatus(weekStart, false, end + 13 * 86_400_000)).toBe("unpaid");
    expect(payoutStatus(weekStart, false, end + 14 * 86_400_000)).toBe("overdue");
  });
});

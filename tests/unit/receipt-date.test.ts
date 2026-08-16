import { describe, expect, it } from "vitest";
import { normalizeReceiptDate } from "@/lib/receipt-date";

const asOf = new Date("2026-08-16T12:00:00Z");

describe("normalizeReceiptDate", () => {
  it("keeps a plausible past date", () => {
    expect(normalizeReceiptDate("2026-08-12", asOf)).toEqual({
      date: "2026-08-12",
      needsReview: false,
      swapped: false,
    });
  });

  it("swaps a day/month flip that lands in the future", () => {
    expect(normalizeReceiptDate("2026-12-08", asOf)).toEqual({
      date: "2026-08-12",
      needsReview: false,
      swapped: true,
    });
  });

  it("flags a date that stays impossible after swapping", () => {
    expect(normalizeReceiptDate("2026-12-25", asOf).needsReview).toBe(true);
    expect(normalizeReceiptDate("2020-07-26", asOf).needsReview).toBe(true);
  });

  it("handles missing or unparseable values", () => {
    expect(normalizeReceiptDate(null, asOf)).toEqual({
      date: null,
      needsReview: false,
      swapped: false,
    });
    expect(normalizeReceiptDate("last tuesday", asOf).needsReview).toBe(true);
  });
});

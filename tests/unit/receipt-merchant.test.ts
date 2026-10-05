import { describe, expect, it } from "vitest";
import { formatReceiptMerchantForExport } from "@/lib/receipt-merchant";

describe("formatReceiptMerchantForExport", () => {
  it("converts uppercase merchant names to title case", () => {
    expect(formatReceiptMerchantForExport("THE HOME DEPOT")).toBe("The Home Depot");
  });

  it("normalizes mixed case and extra spaces", () => {
    expect(formatReceiptMerchantForExport("  hOmE   hArDwArE  ")).toBe("Home Hardware");
  });

  it("capitalizes words after apostrophes and hyphens", () => {
    expect(formatReceiptMerchantForExport("LOWE'S BUILDING-SUPPLIES")).toBe(
      "Lowe'S Building-Supplies",
    );
  });

  it("returns an empty value when no merchant is available", () => {
    expect(formatReceiptMerchantForExport(null)).toBe("");
  });
});
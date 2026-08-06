import { describe, expect, it } from "vitest";
import {
  addressKey,
  parseFileName,
  parseJobSheet,
  parseMoney,
  parseSheetDate,
  parsedTotals,
  reconciliationWarnings,
} from "@/lib/sheet-jobs-parse";

describe("parseFileName", () => {
  it("reads status, start label and address", () => {
    const r = parseFileName("06/15 ongoing *** 44 Raeburn Avenue");
    expect(r.ongoing).toBe(true);
    expect(r.startLabel).toBe("06/15");
    expect(r.address).toBe("44 Raeburn Avenue");
  });

  it("flags copies and finished jobs", () => {
    expect(parseFileName("Copy of 06/15 ongoing *** 44 Raeburn Ave").isCopy).toBe(true);
    expect(parseFileName("06/15 complete *** 44 Raeburn Ave").ongoing).toBe(false);
  });

  it("falls back when the separator is missing", () => {
    expect(parseFileName("07/27 ongoing 50 Cardiff Rd").address).toBe("50 Cardiff Rd");
  });
});

describe("addressKey", () => {
  it("matches across street-type spellings and noise", () => {
    expect(addressKey("44 Raeburn Avenue")).toBe(addressKey("44 raeburn ave"));
    expect(addressKey("3234 Folkway Dr. (Basement)")).toBe(addressKey("3234 Folkway Drive"));
    expect(addressKey("50 Cardiff Rd, Toronto, ON")).toBe(addressKey("50 Cardiff Road"));
  });

  it("keeps different addresses apart", () => {
    expect(addressKey("44 Raeburn Ave")).not.toBe(addressKey("45 Raeburn Ave"));
  });
});

describe("primitives", () => {
  it("parses money", () => {
    expect(parseMoney("$1,234.56")).toBe(1234.56);
    expect(parseMoney("-$800.00")).toBe(-800);
    expect(parseMoney("($100)")).toBe(-100);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("cheque")).toBeNull();
  });

  it("parses dates", () => {
    expect(parseSheetDate("July 27, 2026", 2025)).toBe("2026-07-27");
    expect(parseSheetDate("May 19", 2026)).toBe("2026-05-19");
    expect(parseSheetDate("nonsense", 2026)).toBeNull();
  });
});

const SHEET: string[][] = [
  ["", "Client Name(s):", "Perdeep Bharadwaj"],
  ["", "Start Date:", "July 27, 2026", "", "Payments Owing:", "$13,562.05"],
  ["", "Finish Date:", ""],
  [],
  ["", "Total Revenue", "", "", "Finish Materials", "Bulding Materials:", "Subs:", "Labor:", "", "Net Profit"],
  ["", "$7,350.00", "", "-", "$0.00", "$109.75", "$0.00", "$594.13", "=", "$4,529.37"],
  [],
  ["", "PAYMENTS", "", "", "EXPENSES", "", "", "", "", "", "PRICE"],
  ["", "Payment:", "Method:", "Date:", "Finish Materials:", "Bulding Materials:", "Subs:", "Labor:", "Comments:", "Date:", "Price", "Comments:"],
  ["", "$7,350.00", "cheque", "July 27", "", "", "", "$293.21", "labor - colin", "July 29", "$20,662.05", "with hst"],
  ["", "", "", "", "", "", "", "$300.92", "labor - colin", "July 30", "$250.00", "toilet replacement"],
  ["", "", "", "", "", "$42.00", "", "", "Halton Waste", "July 27"],
  ["", "", "", "", "", "$67.75", "", "", "The Home Depot", "July 29"],
  [],
  [],
  ["", "$7,350.00", "", "", "$0.00", "$109.75", "$0.00", "$594.13", "", "", "$20,912.05"],
];

describe("parseJobSheet", () => {
  const parsed = parseJobSheet(SHEET, 2026);

  it("reads the header block", () => {
    expect(parsed.clientName).toBe("Perdeep Bharadwaj");
    expect(parsed.startDate).toBe("2026-07-27");
    expect(parsed.finishDate).toBeNull();
  });

  it("reads payments once, skipping the totals row", () => {
    expect(parsed.payments).toHaveLength(1);
    expect(parsed.payments[0]).toMatchObject({ amount: 7350, method: "cheque", date: "2026-07-27" });
  });

  it("categorises expenses and keeps their comments", () => {
    const labour = parsed.costs.filter((c) => c.category === "labour");
    const materials = parsed.costs.filter((c) => c.category === "material");
    expect(labour.map((l) => l.amount)).toEqual([293.21, 300.92]);
    expect(materials.map((m) => m.amount)).toEqual([42, 67.75]);
    expect(materials[1].description).toBe("The Home Depot");
    expect(materials[0].date).toBe("2026-07-27");
  });

  it("reads price lines", () => {
    expect(parsed.priceLines.map((p) => p.amount)).toEqual([20662.05, 250]);
    expect(parsed.priceLines[1].description).toBe("toilet replacement");
  });

  it("totals match the sheet's own summary", () => {
    const t = parsedTotals(parsed);
    expect(t.revenue).toBe(7350);
    expect(t.buildingMaterials).toBe(109.75);
    expect(t.labour).toBe(594.13);
    expect(t.contract).toBe(20912.05);
    expect(reconciliationWarnings(parsed)).toEqual([]);
  });

  it("reports a mismatch between the sheet total and the rows", () => {
    const bad = SHEET.map((r) => [...r]);
    bad[5][5] = "$999.00";
    const warnings = reconciliationWarnings(parseJobSheet(bad, 2026));
    expect(warnings.join(" ")).toContain("Building materials");
  });

  it("degrades gracefully when the layout is unrecognised", () => {
    const r = parseJobSheet([["nothing", "useful"]], 2026);
    expect(r.payments).toEqual([]);
    expect(r.warnings[0]).toContain("Could not find");
  });
});

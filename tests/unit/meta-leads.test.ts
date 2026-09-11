import { describe, expect, it } from "vitest";
import { extractSpreadsheetId, parseBudgetCents, parseLeadRow, qualifyLead, suggestMapping } from "@/lib/meta-leads";

describe("Meta lead import", () => {
  it("extracts a spreadsheet id", () => expect(extractSpreadsheetId("https://docs.google.com/spreadsheets/d/abcDEF_12345678901234567890/edit")).toBe("abcDEF_12345678901234567890"));
  it("maps common Meta headers", () => expect(suggestMapping(["lead_id", "full_name", "phone_number", "created_time"])).toEqual({ externalId: "lead_id", name: "full_name", phone: "phone_number", submittedAt: "created_time" }));
  it("uses the upper end of a budget range", () => expect(parseBudgetCents("$25,000 - $50,000")).toBe(5_000_000));
  it("parses and qualifies a complete lead", () => {
    const headers = ["full_name", "email", "address", "project_type", "budget"];
    const lead = parseLeadRow(headers, ["Alex Doe", "a@b.ca", "K1A 0B1", "Kitchen", "$60,000"], suggestMapping(headers));
    expect(qualifyLead(lead, { minimumBudgetCents: 5_000_000, acceptedProjectTypes: ["Kitchen"], acceptedPostalPrefixes: ["K1A"] }).status).toBe("qualified");
  });
  it("holds incomplete rows for review", () => {
    const lead = parseLeadRow(["full_name"], ["Alex Doe"], { name: "full_name" });
    expect(qualifyLead(lead, { minimumBudgetCents: null, acceptedProjectTypes: [], acceptedPostalPrefixes: [] }).status).toBe("needs_review");
  });
});

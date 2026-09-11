export const LEAD_STAGES = ["New", "Contacted", "Quoted", "Won"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export type LeadField = "externalId" | "name" | "phone" | "email" | "address" | "projectType" | "budget" | "campaign" | "formName" | "notes" | "submittedAt";
export type LeadFieldMapping = Partial<Record<LeadField, string>>;
export type QualificationRules = { minimumBudgetCents: number | null; acceptedProjectTypes: string[]; acceptedPostalPrefixes: string[] };
export type ParsedLead = { externalId: string | null; name: string; phone: string | null; email: string | null; address: string | null; projectType: string | null; budgetCents: number | null; campaign: string | null; formName: string | null; notes: string | null; submittedAt: string | null; rawData: Record<string, string> };

export const LEAD_FIELD_LABELS: Record<LeadField, string> = {
  externalId: "Meta lead ID", name: "Name", phone: "Phone", email: "Email", address: "Address",
  projectType: "Project type", budget: "Budget", campaign: "Campaign", formName: "Form name",
  notes: "Notes", submittedAt: "Submission date",
};

const aliases: Record<LeadField, string[]> = {
  externalId: ["lead id", "lead_id", "id"], name: ["full name", "full_name", "name"],
  phone: ["phone number", "phone_number", "phone", "mobile"], email: ["email", "email address"],
  address: ["address", "property address", "project address", "city"],
  projectType: ["project type", "project_type", "service", "what type of project"],
  budget: ["budget", "project budget", "estimated budget"], campaign: ["campaign name", "campaign_name", "campaign"],
  formName: ["form name", "form_name", "form"], notes: ["notes", "message", "description", "project details"],
  submittedAt: ["created time", "created_time", "submission date", "date", "timestamp"],
};
const normalized = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function suggestMapping(headers: string[]): LeadFieldMapping {
  const out: LeadFieldMapping = {};
  for (const field of Object.keys(aliases) as LeadField[]) {
    const match = headers.find((h) => aliases[field].some((a) => normalized(h) === normalized(a)));
    if (match) out[field] = match;
  }
  return out;
}
export function parseBudgetCents(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const range = raw.match(/([\d,.]+)\s*(?:-|–|to)\s*\$?([\d,.]+)/i);
  const candidate = range ? range[2] : raw;
  const number = Number(candidate.replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}
export function parseLeadRow(headers: string[], row: unknown[], mapping: LeadFieldMapping): ParsedLead {
  const rawData = Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? "").trim()]));
  const get = (field: LeadField) => mapping[field] ? rawData[mapping[field] as string]?.trim() || null : null;
  const submitted = get("submittedAt");
  const submittedDate = submitted && !Number.isNaN(Date.parse(submitted)) ? new Date(submitted).toISOString() : null;
  return { externalId: get("externalId"), name: get("name") ?? "Unnamed lead", phone: get("phone"), email: get("email"), address: get("address"), projectType: get("projectType"), budgetCents: parseBudgetCents(get("budget")), campaign: get("campaign"), formName: get("formName"), notes: get("notes"), submittedAt: submittedDate, rawData };
}
export function qualifyLead(lead: ParsedLead, rules: QualificationRules): { status: "qualified" | "needs_review" | "rejected"; reasons: string[] } {
  const missing = [!lead.name || lead.name === "Unnamed lead" ? "name" : null, !lead.phone && !lead.email ? "phone or email" : null, !lead.address ? "address" : null, !lead.projectType ? "project type" : null].filter(Boolean) as string[];
  if (missing.length) return { status: "needs_review", reasons: [`Missing ${missing.join(", ")}`] };
  const rejected: string[] = [];
  if (rules.minimumBudgetCents !== null && (lead.budgetCents === null || lead.budgetCents < rules.minimumBudgetCents)) rejected.push("Budget is below the minimum");
  if (rules.acceptedProjectTypes.length && !rules.acceptedProjectTypes.some((v) => normalized(v) === normalized(lead.projectType))) rejected.push("Project type is not accepted");
  if (rules.acceptedPostalPrefixes.length && !rules.acceptedPostalPrefixes.some((v) => normalized(lead.address).includes(normalized(v)))) rejected.push("Location is outside the accepted area");
  return rejected.length ? { status: "rejected", reasons: rejected } : { status: "qualified", reasons: ["Matched all qualification rules"] };
}
export function extractSpreadsheetId(input: string): string | null {
  const value = input.trim();
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(value) ? value : null;
}

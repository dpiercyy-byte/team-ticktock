export const PROJECT_TYPES = [
  "Bathroom",
  "Kitchen",
  "Basement",
  "Addition",
  "Whole Home",
  "Commercial",
  "Maintenance",
  "Custom",
] as const;

export const TRADES = [
  "Demo",
  "Framing",
  "Drywall",
  "Insulation",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Painting",
  "Flooring",
  "Tile",
  "Millwork",
  "Trim",
  "Cabinetry",
  "Countertops",
  "Glass",
  "Exterior",
  "Roofing",
  "Landscaping",
] as const;

export const STATUSES: Array<{ id: string; label: string; tone: string }> = [
  { id: "lead", label: "Lead", tone: "bg-slate-100 text-slate-700" },
  { id: "site_visit_required", label: "Site Visit Required", tone: "bg-amber-100 text-amber-800" },
  { id: "estimate_required", label: "Estimate Required", tone: "bg-amber-100 text-amber-800" },
  { id: "waiting_for_approval", label: "Waiting For Approval", tone: "bg-blue-100 text-blue-800" },
  { id: "scheduled", label: "Scheduled", tone: "bg-indigo-100 text-indigo-800" },
  { id: "active", label: "Active", tone: "bg-emerald-100 text-emerald-800" },
  { id: "completed", label: "Completed", tone: "bg-slate-900 text-white" },
];

export function statusMeta(id: string) {
  return STATUSES.find((s) => s.id === id) ?? { id, label: id, tone: "bg-slate-100 text-slate-700" };
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

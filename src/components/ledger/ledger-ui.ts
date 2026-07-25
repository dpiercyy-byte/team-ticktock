import type { LedgerStatus } from "@/lib/ledger.functions";

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function statusTone(s: LedgerStatus | string) {
  switch (s) {
    case "Lead":
      return "bg-muted text-muted-foreground";
    case "Site Visit Required":
    case "Estimate Required":
      return "bg-blue-100 text-blue-700";
    case "Waiting For Approval":
      return "bg-amber-100 text-amber-800";
    case "Scheduled":
      return "bg-orange-100 text-orange-700";
    case "Active":
      return "bg-emerald-100 text-emerald-700";
    case "Completed":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function relativeTime(iso: string) {
  const diff = Date.now() - +new Date(iso);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

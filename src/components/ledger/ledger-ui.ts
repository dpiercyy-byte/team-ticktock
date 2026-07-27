import { LEDGER_STATUSES, type LedgerStatus } from "@/lib/ledger.functions";

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Short slug used by the .l-s-* CSS classes in styles.css */
export function statusSlug(s: LedgerStatus | string) {
  switch (s) {
    case "Lead":
      return "lead";
    case "Site Visit Required":
      return "visit";
    case "Estimate Required":
      return "estimate";
    case "Waiting For Approval":
      return "approval";
    case "Scheduled":
      return "scheduled";
    case "Active":
      return "active";
    case "Completed":
      return "completed";
    default:
      return "lead";
  }
}

/** Chip classes for a status pill. */
export function statusTone(s: LedgerStatus | string) {
  return `l-chip l-s-${statusSlug(s)}`;
}

/** Solid background class (for dots / bars) matching a status. */
export function statusDotClass(s: LedgerStatus | string) {
  return `l-dot l-s-${statusSlug(s)}-bg`;
}

/** Short label for tight spaces. */
export function statusShort(s: LedgerStatus | string) {
  switch (s) {
    case "Site Visit Required":
      return "Site Visit";
    case "Estimate Required":
      return "Estimate";
    case "Waiting For Approval":
      return "Approval";
    default:
      return String(s);
  }
}

/* ---------------- Journey ---------------- */

export const JOURNEY = LEDGER_STATUSES;

export const JOURNEY_SHORT: string[] = JOURNEY.map((s) => statusShort(s));

export function journeyIndex(s: LedgerStatus | string) {
  const i = (JOURNEY as readonly string[]).indexOf(String(s));
  return i < 0 ? 0 : i;
}

/* ---------------- Hero gradients ---------------- */

export function heroClass(projectType: string) {
  const p = (projectType || "").toLowerCase();
  if (p.includes("bathroom")) return "l-hero l-hero--bathroom";
  if (p.includes("kitchen")) return "l-hero l-hero--kitchen";
  if (p.includes("basement")) return "l-hero l-hero--basement";
  if (p.includes("addition")) return "l-hero l-hero--addition";
  if (p.includes("whole")) return "l-hero l-hero--whole";
  if (p.includes("commercial")) return "l-hero l-hero--commercial";
  if (p.includes("maintenance")) return "l-hero l-hero--maintenance";
  return "l-hero l-hero--custom";
}

/* ---------------- Time ---------------- */

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

export function shortDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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

/* ---------------- Hero photos ---------------- */

import heroBathroom from "@/assets/ledger/hero-bathroom.jpg";
import heroKitchen from "@/assets/ledger/hero-kitchen.jpg";
import heroBasement from "@/assets/ledger/hero-basement.jpg";
import heroAddition from "@/assets/ledger/hero-addition.jpg";
import heroWhole from "@/assets/ledger/hero-whole.jpg";
import heroCommercial from "@/assets/ledger/hero-commercial.jpg";
import heroMaintenance from "@/assets/ledger/hero-maintenance.jpg";
import heroCustom from "@/assets/ledger/hero-custom.jpg";

/** Photo used for the hero band of a given project type. */
export function heroImage(projectType: string) {
  const p = (projectType || "").toLowerCase();
  if (p.includes("bathroom")) return heroBathroom;
  if (p.includes("kitchen")) return heroKitchen;
  if (p.includes("basement")) return heroBasement;
  if (p.includes("addition")) return heroAddition;
  if (p.includes("whole")) return heroWhole;
  if (p.includes("commercial")) return heroCommercial;
  if (p.includes("maintenance")) return heroMaintenance;
  return heroCustom;
}

/** Base hero band class (photo + scrim applied via style). */
export function heroClass(_projectType?: string) {
  return "l-hero";
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

/**
 * Pure CRM helpers. No IO, no server imports — unit tested directly.
 */

export type NextActionState = "none" | "done" | "overdue" | "today" | "upcoming";

const DAY_MS = 86_400_000;

/** Whole days elapsed since a stage was entered. Null/invalid -> 0. */
export function daysInStage(since: string | null | undefined, now: number = Date.now()): number {
  if (!since) return 0;
  const t = new Date(since).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** Human label for the days-in-stage badge. */
export function daysInStageLabel(since: string | null | undefined, now: number = Date.now()): string {
  const d = daysInStage(since, now);
  if (d === 0) return "today";
  if (d === 1) return "1 day";
  return `${d} days`;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Classify a project's follow-up. Overdue means the due date is before today. */
export function nextActionState(
  input: { action?: string | null; status?: string | null; dueAt?: string | null },
  now: number = Date.now(),
): NextActionState {
  if (!input.action || !input.action.trim()) return "none";
  if (input.status === "done") return "done";
  if (!input.dueAt) return "upcoming";
  const due = new Date(input.dueAt).getTime();
  if (!Number.isFinite(due)) return "upcoming";
  const today = startOfLocalDay(now);
  const dueDay = startOfLocalDay(due);
  if (dueDay < today) return "overdue";
  if (dueDay === today) return "today";
  return "upcoming";
}

/** Case/whitespace-insensitive identity key used to avoid duplicate clients. */
export function normalizeClientKey(name: string, email?: string | null): string {
  return `${name.trim().toLowerCase().replace(/\s+/g, " ")}|${(email ?? "").trim().toLowerCase()}`;
}

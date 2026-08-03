// Pure payout / week-bucketing math — no database, no server-only imports.
// Extracted from payout.functions.ts so it can be unit tested and so the
// server-function module stays a thin wrapper.

export type PayoutStatus = "paid" | "overdue" | "unpaid";

/** Sunday-based week start for a date, as YYYY-MM-DD. */
export function startOfWeekISO(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Exclusive end of the payout week (start + 7 days). */
export function endOfWeek(weekStart: string): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

export function hoursBetween(clockIn: string, clockOut: string): number {
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

export function sumHours(
  entries: Array<{ clock_in: string; clock_out: string | null }> | null | undefined,
): number {
  return (entries ?? []).reduce(
    (s, e) => (e.clock_out ? s + hoursBetween(e.clock_in, e.clock_out) : s),
    0,
  );
}

export function sumAmounts(
  rows: Array<{ amount: number | string }> | null | undefined,
): number {
  return (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
}

/** A week is overdue once it has been closed for 14+ days and is unpaid. */
export function payoutStatus(
  weekStart: string,
  isPaid: boolean,
  now: number = Date.now(),
): PayoutStatus {
  if (isPaid) return "paid";
  const weekEnd = addDaysISO(weekStart, 6);
  const endTs = new Date(weekEnd + "T23:59:59").getTime();
  const ageDays = Math.floor((now - endTs) / 86_400_000);
  return ageDays >= 14 ? "overdue" : "unpaid";
}

/** Tip = whatever was actually paid above the computed amount. */
export function tipFor(amount: number, actualPaid: number): number {
  return Number((actualPaid - amount).toFixed(2));
}

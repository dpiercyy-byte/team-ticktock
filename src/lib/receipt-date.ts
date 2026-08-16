// Sanity guard for AI-extracted receipt dates.
// Receipts here are Canadian and print DD/MM/YY, so a model that assumes US
// MM/DD silently flips every date whose day is 1-12. Anything that lands in the
// future (or absurdly far in the past) is either a swap or a misread year.

export type ReceiptDateCheck = {
  /** Corrected ISO date, or null when it cannot be trusted. */
  date: string | null;
  /** True when a human should confirm the date. */
  needsReview: boolean;
  /** Set when day/month were swapped back. */
  swapped: boolean;
};

const MAX_AGE_MONTHS = 18;

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * @param raw   ISO-ish date string from the parser.
 * @param asOf  Upload time; the date must not be after this day.
 */
export function normalizeReceiptDate(
  raw: string | null | undefined,
  asOf: Date = new Date(),
): ReceiptDateCheck {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return { date: null, needsReview: !!s, swapped: false };

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!valid(year, month, day)) return { date: null, needsReview: true, swapped: false };

  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const floor = new Date(today);
  floor.setUTCMonth(floor.getUTCMonth() - MAX_AGE_MONTHS);

  const inRange = (y: number, mo: number, d: number) => {
    const t = Date.UTC(y, mo - 1, d);
    return t <= today.getTime() && t >= floor.getTime();
  };

  if (inRange(year, month, day)) {
    return { date: toISO(year, month, day), needsReview: false, swapped: false };
  }
  // Out of range: a day/month swap is the usual cause.
  if (valid(year, day, month) && inRange(year, day, month)) {
    return { date: toISO(year, day, month), needsReview: false, swapped: true };
  }
  return { date: null, needsReview: true, swapped: false };
}

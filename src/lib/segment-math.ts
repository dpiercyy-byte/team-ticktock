// Pure math for shift segments — a shift can span more than one job site.
// No database, no server-only imports.

export type SegmentSource = "clock_in" | "switch" | "auto_split" | "admin";

export type RawSegment = {
  id: string;
  entry_id: string;
  started_at: string;
  ended_at: string | null;
  job_site_id: string | null;
  geo_status: string | null;
  source: string;
};

export type SegmentDraft = {
  started_at: string;
  ended_at: string | null;
  job_site_id: string | null;
  geo_status: string | null;
  source: SegmentSource;
};

const ms = (iso: string) => new Date(iso).getTime();

export function segmentHours(seg: { started_at: string; ended_at: string | null }, now = Date.now()) {
  const end = seg.ended_at ? ms(seg.ended_at) : now;
  return Math.max(0, (end - ms(seg.started_at)) / 3600_000);
}

/** Total hours per job site for one shift. Null site id groups under "". */
export function hoursBySite(segments: RawSegment[], now = Date.now()): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of segments) {
    const key = s.job_site_id ?? "";
    out.set(key, (out.get(key) ?? 0) + segmentHours(s, now));
  }
  return out;
}

const CLIENT_STATUSES = new Set(["verified", "callback"]);

/**
 * A shift that never got switched but started and ended at two different client
 * sites gets halved between them and flagged for admin review.
 */
export function fiftyFiftySplit(input: {
  clockIn: string;
  clockOut: string;
  inSiteId: string | null;
  inStatus: string | null;
  outSiteId: string | null;
  outStatus: string | null;
}): SegmentDraft[] | null {
  const { clockIn, clockOut, inSiteId, outSiteId } = input;
  if (!inSiteId || !outSiteId || inSiteId === outSiteId) return null;
  if (!CLIENT_STATUSES.has(input.inStatus ?? "")) return null;
  if (!CLIENT_STATUSES.has(input.outStatus ?? "")) return null;
  const start = ms(clockIn);
  const end = ms(clockOut);
  if (!(end > start)) return null;
  const mid = new Date(start + (end - start) / 2).toISOString();
  return [
    { started_at: clockIn, ended_at: mid, job_site_id: inSiteId, geo_status: input.inStatus, source: "auto_split" },
    { started_at: mid, ended_at: clockOut, job_site_id: outSiteId, geo_status: input.outStatus, source: "auto_split" },
  ];
}

/** Build admin-entered allocations (hours per site) into contiguous segments. */
export function allocationToSegments(
  clockIn: string,
  clockOut: string,
  allocations: Array<{ jobSiteId: string | null; hours: number; geoStatus?: string | null }>,
): SegmentDraft[] {
  const start = ms(clockIn);
  const total = (ms(clockOut) - start) / 3600_000;
  const sum = allocations.reduce((s, a) => s + a.hours, 0);
  if (!(total > 0)) throw new Error("Clock out must be after clock in");
  if (Math.abs(sum - total) > 0.02) {
    throw new Error(`Allocated hours (${sum.toFixed(2)}) must equal shift length (${total.toFixed(2)})`);
  }
  let cursor = start;
  return allocations.map((a, i) => {
    const startISO = new Date(cursor).toISOString();
    cursor = i === allocations.length - 1 ? ms(clockOut) : cursor + a.hours * 3600_000;
    return {
      started_at: startISO,
      ended_at: new Date(cursor).toISOString(),
      job_site_id: a.jobSiteId,
      geo_status: a.geoStatus ?? null,
      source: "admin" as const,
    };
  });
}

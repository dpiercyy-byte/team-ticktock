import { describe, it, expect } from "vitest";
import { segmentHours, hoursBySite, fiftyFiftySplit, allocationToSegments } from "@/lib/segment-math";

const t = (h: number) => new Date(Date.UTC(2026, 0, 5, h, 0, 0)).toISOString();

describe("segment-math", () => {
  it("computes closed segment hours", () => {
    expect(segmentHours({ id: "1", entry_id: "e", started_at: t(8), ended_at: t(12), job_site_id: "a", geo_status: "verified", source: "clock_in" })).toBe(4);
  });

  it("buckets hours by site", () => {
    const segs = [
      { id: "1", entry_id: "e", started_at: t(8), ended_at: t(12), job_site_id: "a", geo_status: "verified", source: "clock_in" },
      { id: "2", entry_id: "e", started_at: t(12), ended_at: t(16), job_site_id: "b", geo_status: "verified", source: "switch" },
    ];
    const m = hoursBySite(segs);
    expect(m.get("a")).toBe(4);
    expect(m.get("b")).toBe(4);
  });

  it("splits a shift 50/50 between start and end sites", () => {
    const drafts = fiftyFiftySplit(t(8), t(16), { jobSiteId: "a", geoStatus: "verified" }, { jobSiteId: "b", geoStatus: "verified" });
    expect(drafts).toHaveLength(2);
    expect(drafts[0].job_site_id).toBe("a");
    expect(drafts[1].job_site_id).toBe("b");
    expect(drafts[0].ended_at).toBe(drafts[1].started_at);
    expect(new Date(drafts[0].ended_at!).getTime()).toBe(new Date(t(12)).getTime());
  });

  it("turns admin allocations into contiguous segments", () => {
    const drafts = allocationToSegments(t(8), t(16), [
      { jobSiteId: "a", hours: 5, geoStatus: "verified" },
      { jobSiteId: "b", hours: 3, geoStatus: "verified" },
    ]);
    expect(drafts).toHaveLength(2);
    expect(drafts[0].started_at).toBe(t(8));
    expect(drafts[1].ended_at).toBe(t(16));
    expect(new Date(drafts[0].ended_at!).getTime()).toBe(new Date(t(13)).getTime());
  });
});

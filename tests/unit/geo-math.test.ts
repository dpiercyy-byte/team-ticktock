import { describe, expect, it } from "vitest";
import { classifyPunch, haversineMeters, type GeoSite } from "@/lib/geo-math";

const SITE: GeoSite = {
  id: "site-a",
  label: "16 Ostick Ave",
  lat: 43.6532,
  lng: -79.3832,
  radius_m: 250,
  kind: "client",
};
const SUPPLIER: GeoSite = {
  id: "site-s",
  label: "50 Red Maple Rd",
  lat: 43.7,
  lng: -79.4,
  radius_m: 250,
  kind: "supplier",
};

describe("haversineMeters", () => {
  it("is zero for the same point", () => {
    expect(haversineMeters(43.65, -79.38, 43.65, -79.38)).toBe(0);
  });
  it("approximates a known short distance", () => {
    // ~111m per 0.001 degree of latitude.
    const d = haversineMeters(43.65, -79.38, 43.651, -79.38);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe("classifyPunch", () => {
  it("returns no_gps when coordinates are missing", () => {
    expect(classifyPunch(null, null, [SITE]).status).toBe("no_gps");
    expect(classifyPunch(43.65, undefined, [SITE]).status).toBe("no_gps");
    expect(classifyPunch(Number.NaN, -79.38, [SITE]).status).toBe("no_gps");
  });

  it("verifies a punch inside a client site radius", () => {
    const m = classifyPunch(43.6533, -79.3833, [SITE]);
    expect(m.status).toBe("verified");
    expect(m.jobSiteId).toBe("site-a");
    expect(m.siteLabel).toBe("16 Ostick Ave");
  });

  it("tags a punch inside a supplier radius as supplier", () => {
    const m = classifyPunch(43.7001, -79.4001, [SITE, SUPPLIER]);
    expect(m.status).toBe("supplier");
    expect(m.jobSiteId).toBe("site-s");
  });

  it("returns off_site when outside every radius", () => {
    const m = classifyPunch(44.5, -79.0, [SITE, SUPPLIER]);
    expect(m).toEqual({ status: "off_site", jobSiteId: null, siteLabel: null });
  });

  it("returns off_site when there are no sites at all", () => {
    expect(classifyPunch(43.65, -79.38, []).status).toBe("off_site");
    expect(classifyPunch(43.65, -79.38, null).status).toBe("off_site");
  });

  it("picks the nearest site when radii overlap", () => {
    const near: GeoSite = { ...SITE, id: "near", label: "Near", lat: 43.6532, lng: -79.3832 };
    const far: GeoSite = { ...SITE, id: "far", label: "Far", lat: 43.6542, lng: -79.3842 };
    expect(classifyPunch(43.6532, -79.3832, [far, near]).jobSiteId).toBe("near");
    expect(classifyPunch(43.6542, -79.3842, [near, far]).jobSiteId).toBe("far");
  });

  it("treats string coordinates and radii from the DB as numbers", () => {
    const s: GeoSite = { ...SITE, lat: "43.6532", lng: "-79.3832", radius_m: "250" };
    expect(classifyPunch(43.6533, -79.3833, [s]).status).toBe("verified");
  });

  it("defaults a site with no kind to a client site", () => {
    const s: GeoSite = { ...SITE, kind: null };
    expect(classifyPunch(43.6532, -79.3832, [s]).status).toBe("verified");
  });
});

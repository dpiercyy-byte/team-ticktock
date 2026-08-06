// Pure geofence math — no database, no server-only imports.
// Kept separate from geo.server.ts so it can be unit tested.

export type GeoStatus = "verified" | "callback" | "supplier" | "off_site" | "no_gps";

export type GeoMatch = {
  status: GeoStatus;
  jobSiteId: string | null;
  siteLabel: string | null;
};

export type GeoSite = {
  id: string;
  label: string;
  lat: number | string;
  lng: number | string;
  radius_m: number | string;
  kind?: string | null;
  /** Completed jobs keep their geofence: a punch there is a callback. */
  completed_at?: string | null;
};

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Classifies a GPS punch against the known job sites.
 * - inside a client site radius  -> verified
 * - inside a supplier site radius -> supplier
 * - inside none                   -> off_site
 * - no/NaN coordinates            -> no_gps
 * When several sites match, the nearest one wins.
 */
export function classifyPunch(
  lat: number | null | undefined,
  lng: number | null | undefined,
  sites: GeoSite[] | null | undefined,
): GeoMatch {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { status: "no_gps", jobSiteId: null, siteLabel: null };
  }
  if (!sites || sites.length === 0) {
    return { status: "off_site", jobSiteId: null, siteLabel: null };
  }
  let best: { id: string; label: string; kind: string; dist: number } | null = null;
  for (const s of sites) {
    const d = haversineMeters(lat, lng, Number(s.lat), Number(s.lng));
    if (d <= Number(s.radius_m) && (!best || d < best.dist)) {
      best = { id: s.id, label: s.label, kind: s.kind ?? "client", dist: d };
    }
  }
  if (best) {
    return {
      status: best.kind === "supplier" ? "supplier" : "verified",
      jobSiteId: best.id,
      siteLabel: best.label,
    };
  }
  return { status: "off_site", jobSiteId: null, siteLabel: null };
}

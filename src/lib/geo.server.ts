import { supabaseAdmin } from "./db.server";

export type GeoStatus = "verified" | "off_site" | "no_gps";

export type GeoMatch = {
  status: GeoStatus;
  jobSiteId: string | null;
  siteLabel: string | null;
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function resolveSite(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<GeoMatch> {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { status: "no_gps", jobSiteId: null, siteLabel: null };
  }
  const { data: sites } = await supabaseAdmin
    .from("job_sites")
    .select("id, label, lat, lng, radius_m");
  if (!sites || sites.length === 0) {
    return { status: "off_site", jobSiteId: null, siteLabel: null };
  }
  let best: { id: string; label: string; dist: number; radius: number } | null = null;
  for (const s of sites) {
    const d = haversineMeters(lat, lng, Number(s.lat), Number(s.lng));
    if (d <= Number(s.radius_m) && (!best || d < best.dist)) {
      best = { id: s.id, label: s.label, dist: d, radius: Number(s.radius_m) };
    }
  }
  if (best) return { status: "verified", jobSiteId: best.id, siteLabel: best.label };
  return { status: "off_site", jobSiteId: null, siteLabel: null };
}

import { supabaseAdmin } from "./db.server";
import { classifyPunch } from "./geo-math";
import type { GeoMatch, GeoStatus } from "./geo-math";

export type { GeoMatch, GeoStatus };

export async function resolveSite(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<GeoMatch> {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { status: "no_gps", jobSiteId: null, siteLabel: null };
  }
  const { data: sites } = await supabaseAdmin
    .from("job_sites")
    .select("id, label, lat, lng, radius_m, kind")
    .is("archived_at", null);
  return classifyPunch(lat, lng, sites ?? []);
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";

const adminBase = z.object({ token: z.string() });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted: string }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GMAPS_KEY) {
    throw new Response("Geocoding not configured", { status: 500 });
  }
  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
    {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAPS_KEY,
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Response(`Geocoding failed (${res.status}): ${body.slice(0, 200)}`, { status: 502 });
  }
  const json: any = await res.json();
  if (json.status !== "OK" || !json.results?.length) {
    throw new Response(`Address not found${json.error_message ? `: ${json.error_message}` : ""}`, { status: 400 });
  }
  const r = json.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address as string,
  };
}

export const adminListJobSites = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("job_sites")
      .select("id, label, address, lat, lng, radius_m, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ...refreshed, sites: rows ?? [] };
  });

export const adminAddJobSite = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      address: z.string().trim().min(3).max(300),
      label: z.string().trim().max(80).optional(),
      radius_m: z.number().int().min(25).max(2000).default(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const geo = await geocodeAddress(data.address);
    const label = data.label?.trim() || geo.formatted;
    const { error } = await supabaseAdmin.from("job_sites").insert({
      label,
      address: geo.formatted,
      lat: geo.lat,
      lng: geo.lng,
      radius_m: data.radius_m,
    });
    if (error) throw error;
    return refreshed;
  });

export const adminUpdateJobSite = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      id: z.string().uuid(),
      label: z.string().trim().max(80),
      radius_m: z.number().int().min(25).max(2000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("job_sites")
      .update({ label: data.label, radius_m: data.radius_m })
      .eq("id", data.id);
    if (error) throw error;
    return refreshed;
  });

export const adminDeleteJobSite = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("job_sites").delete().eq("id", data.id);
    if (error) throw error;
    return refreshed;
  });

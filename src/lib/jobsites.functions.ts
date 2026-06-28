import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";

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
      .select("id, label, address, lat, lng, radius_m, created_at, kind, archived_at")
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
      kind: z.enum(["client", "supplier"]).default("client"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const geo = await geocodeAddress(data.address);
    const label = data.label?.trim() || geo.formatted.split(",")[0].trim();
    const { data: inserted, error } = await supabaseAdmin.from("job_sites").insert({
      label,
      address: geo.formatted,
      lat: geo.lat,
      lng: geo.lng,
      radius_m: data.radius_m,
      kind: data.kind,
    }).select("id").single();
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "job_site_create",
      entityType: "job_site",
      entityId: inserted?.id,
      after: { label, address: geo.formatted, radius_m: data.radius_m, kind: data.kind },
    });
    return refreshed;
  });

export const adminUpdateJobSite = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      id: z.string().uuid(),
      label: z.string().trim().max(80),
      radius_m: z.number().int().min(25).max(2000),
      address: z.string().trim().min(3).max(300).optional(),
      kind: z.enum(["client", "supplier"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: prev } = await supabaseAdmin
      .from("job_sites").select("label, address, radius_m, kind, lat, lng").eq("id", data.id).maybeSingle();
    const patch: { label: string; radius_m: number; kind?: string; address?: string; lat?: number; lng?: number } = { label: data.label, radius_m: data.radius_m };
    if (data.kind) patch.kind = data.kind;
    if (data.address && prev && data.address.trim() !== prev.address) {
      const geo = await geocodeAddress(data.address);
      patch.address = geo.formatted;
      patch.lat = geo.lat;
      patch.lng = geo.lng;
    }
    const { error } = await supabaseAdmin
      .from("job_sites")
      .update(patch)
      .eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "job_site_edit",
      entityType: "job_site",
      entityId: data.id,
      before: prev ?? undefined,
      after: { ...prev, ...patch },
    });
    return refreshed;
  });


export const adminArchiveJobSite = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      id: z.string().uuid(),
      archived: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: prev } = await supabaseAdmin
      .from("job_sites").select("label, archived_at").eq("id", data.id).maybeSingle();
    const archived_at = data.archived ? new Date().toISOString() : null;
    const { error } = await supabaseAdmin
      .from("job_sites")
      .update({ archived_at })
      .eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: data.archived ? "job_site_archive" : "job_site_restore",
      entityType: "job_site",
      entityId: data.id,
      before: { archived_at: prev?.archived_at ?? null, label: prev?.label ?? null },
      after: { archived_at },
    });
    return refreshed;
  });

export const adminDeleteJobSite = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: prev } = await supabaseAdmin
      .from("job_sites").select("label, kind, archived_at").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("job_sites").delete().eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "job_site_delete",
      entityType: "job_site",
      entityId: data.id,
      before: prev ?? undefined,
    });
    return refreshed;
  });

export const adminSearchPlaces = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({ query: z.string().trim().min(2).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GMAPS_KEY) {
      throw new Response("Places not configured", { status: 500 });
    }
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAPS_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({ textQuery: data.query, pageSize: 20 }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Response(`Places search failed (${res.status}): ${body.slice(0, 200)}`, { status: 502 });
    }
    const json: any = await res.json();
    const results = (json.places ?? []).map((p: any) => ({
      placeId: p.id as string,
      name: (p.displayName?.text ?? "") as string,
      address: (p.formattedAddress ?? "") as string,
      lat: Number(p.location?.latitude ?? 0),
      lng: Number(p.location?.longitude ?? 0),
    })).filter((r: any) => r.address && r.lat && r.lng);
    return { ...refreshed, results };
  });

export const adminBulkAddJobSites = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      kind: z.enum(["client", "supplier"]),
      radius_m: z.number().int().min(25).max(2000),
      items: z.array(z.object({
        label: z.string().trim().min(1).max(80),
        address: z.string().trim().min(3).max(300),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })).min(1).max(50),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let added = 0;
    const failed: Array<{ address: string; reason: string }> = [];
    for (const item of data.items) {
      try {
        let lat = item.lat;
        let lng = item.lng;
        let formatted = item.address;
        if (lat == null || lng == null) {
          const geo = await geocodeAddress(item.address);
          lat = geo.lat; lng = geo.lng; formatted = geo.formatted;
        }
        const { data: inserted, error } = await supabaseAdmin.from("job_sites").insert({
          label: item.label,
          address: formatted,
          lat, lng,
          radius_m: data.radius_m,
          kind: data.kind,
        }).select("id").single();
        if (error) throw error;
        added++;
        await logAudit({
          actor: { kind: "admin" },
          action: "job_site_create",
          entityType: "job_site",
          entityId: inserted?.id,
          after: { label: item.label, address: formatted, radius_m: data.radius_m, kind: data.kind },
          metadata: { bulk: true },
        });
      } catch (e: any) {
        const reason = e instanceof Response ? await e.text().catch(() => "Failed") : (e?.message || "Failed");
        failed.push({ address: item.address, reason: String(reason).slice(0, 200) });
      }
    }
    return { ...refreshed, added, failed };
  });

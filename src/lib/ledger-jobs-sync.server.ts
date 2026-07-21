// Server-only helpers that keep Ledger jobs and Clockwise client job_sites in sync,
// and auto-compute Ledger labor cost from clocked time_entries.
import { supabaseAdmin } from "./db.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function tryGeocode(address: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GMAPS_KEY) return null;
  try {
    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
      { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GMAPS_KEY } },
    );
    if (!res.ok) return null;
    const json: any = await res.json();
    if (json.status !== "OK" || !json.results?.length) return null;
    const r = json.results[0];
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, formatted: r.formatted_address as string };
  } catch {
    return null;
  }
}

function normalizeAddr(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");
}

// Ensure the Ledger job has a linked Clockwise client job_site. Idempotent.
export async function ensureJobSiteForLedgerJob(jobId: string): Promise<string | null> {
  const { data: job } = await supabaseAdmin
    .from("ledger_jobs")
    .select("id, address, client_name, linked_job_site_id, finish_date")
    .eq("id", jobId).maybeSingle();
  if (!job) return null;
  if (job.linked_job_site_id) return job.linked_job_site_id;
  if (job.finish_date) return null; // closed jobs don't need a live site

  // Fuzzy match an existing active client site by address.
  const { data: sites } = await supabaseAdmin
    .from("job_sites")
    .select("id, address, label, kind, archived_at")
    .eq("kind", "client")
    .is("archived_at", null);
  const target = normalizeAddr(job.address);
  const match = (sites ?? []).find((s: any) => normalizeAddr(s.address).includes(target) || target.includes(normalizeAddr(s.address)));
  if (match) {
    await supabaseAdmin.from("ledger_jobs").update({ linked_job_site_id: match.id } as never).eq("id", jobId);
    return match.id;
  }

  // Otherwise geocode and create a new site.
  const geo = await tryGeocode(job.address);
  if (!geo) return null;
  const label = (job.client_name?.trim() || geo.formatted.split(",")[0].trim()).slice(0, 80);
  const { data: inserted, error } = await supabaseAdmin.from("job_sites").insert({
    label,
    address: geo.formatted,
    lat: geo.lat,
    lng: geo.lng,
    radius_m: 250,
    kind: "client",
  }).select("id").single();
  if (error || !inserted) return null;
  await supabaseAdmin.from("ledger_jobs").update({ linked_job_site_id: inserted.id } as never).eq("id", jobId);
  return inserted.id;
}

// Ensure a Clockwise client site has a matching Ledger job. Idempotent.
export async function ensureLedgerJobForSite(siteId: string): Promise<string | null> {
  const { data: site } = await supabaseAdmin
    .from("job_sites")
    .select("id, label, address, kind, archived_at")
    .eq("id", siteId).maybeSingle();
  if (!site || site.kind !== "client" || site.archived_at) return null;

  const { data: existing } = await supabaseAdmin
    .from("ledger_jobs").select("id").eq("linked_job_site_id", siteId).maybeSingle();
  if (existing) return existing.id;

  // Try to attach to an unlinked active Ledger job with matching address.
  const { data: candidates } = await supabaseAdmin
    .from("ledger_jobs")
    .select("id, address, linked_job_site_id, finish_date")
    .is("linked_job_site_id", null)
    .is("finish_date", null);
  const target = normalizeAddr(site.address);
  const match = (candidates ?? []).find((j: any) => normalizeAddr(j.address).includes(target) || target.includes(normalizeAddr(j.address)));
  if (match) {
    await supabaseAdmin.from("ledger_jobs").update({ linked_job_site_id: siteId } as never).eq("id", match.id);
    return match.id;
  }

  const { data: inserted, error } = await supabaseAdmin.from("ledger_jobs").insert({
    address: site.address,
    client_name: site.label && site.label !== site.address.split(",")[0].trim() ? site.label : null,
    start_date: new Date().toISOString().slice(0, 10),
    lead_source: "unknown",
    linked_job_site_id: siteId,
  }).select("id").single();
  if (error || !inserted) return null;
  return inserted.id;
}

// When a Ledger job is marked finished, archive the linked Clockwise site.
export async function archiveLinkedSiteForLedgerJob(jobId: string): Promise<void> {
  const { data: job } = await supabaseAdmin
    .from("ledger_jobs").select("linked_job_site_id, finish_date").eq("id", jobId).maybeSingle();
  if (!job?.linked_job_site_id || !job.finish_date) return;
  const { data: site } = await supabaseAdmin
    .from("job_sites").select("archived_at").eq("id", job.linked_job_site_id).maybeSingle();
  if (!site || site.archived_at) return;
  await supabaseAdmin.from("job_sites").update({ archived_at: new Date().toISOString() }).eq("id", job.linked_job_site_id);
}

// When a Clockwise site is archived, mark the linked Ledger job finished (if not already).
export async function finishLinkedLedgerJobForSite(siteId: string): Promise<void> {
  const { data: site } = await supabaseAdmin
    .from("job_sites").select("archived_at").eq("id", siteId).maybeSingle();
  if (!site?.archived_at) return;
  const { data: job } = await supabaseAdmin
    .from("ledger_jobs").select("id, finish_date").eq("linked_job_site_id", siteId).maybeSingle();
  if (!job || job.finish_date) return;
  await supabaseAdmin.from("ledger_jobs").update({ finish_date: new Date().toISOString().slice(0, 10) } as never).eq("id", job.id);
}

// Attribution: for a given time_entry row, which site should it be billed to?
function attributeEntry(e: {
  planned_job_site_id: string | null;
  assigned_job_site_ids: string[] | null;
  job_site_id: string | null;
  geo_status: string | null;
}): string | null {
  if (e.planned_job_site_id) return e.planned_job_site_id;
  if (e.assigned_job_site_ids && e.assigned_job_site_ids.length > 0) return e.assigned_job_site_ids[0];
  if (e.job_site_id && e.geo_status === "verified") return e.job_site_id;
  return null;
}

// Recompute labor for the Ledger job linked to `siteId` (or a specific ledger job id).
// Respects `labor_manual_override` and sheet-linked jobs (sheet is source of truth).
export async function recomputeLedgerLaborForSite(siteId: string): Promise<void> {
  const { data: job } = await supabaseAdmin
    .from("ledger_jobs")
    .select("id, total_price, finish_materials, building_materials, subs, labor, labor_manual_override, sheet_id")
    .eq("linked_job_site_id", siteId).maybeSingle();
  if (!job) return;
  if (job.labor_manual_override || job.sheet_id) return;
  await recomputeLedgerLaborForJob(job.id);
}

export async function recomputeLedgerLaborForJob(jobId: string): Promise<void> {
  const { data: job } = await supabaseAdmin
    .from("ledger_jobs")
    .select("id, total_price, finish_materials, building_materials, subs, labor_manual_override, sheet_id, linked_job_site_id")
    .eq("id", jobId).maybeSingle();
  if (!job || !job.linked_job_site_id) return;
  if (job.labor_manual_override || job.sheet_id) return;

  // Pull all clock_out-closed entries that could match this site.
  const siteId = job.linked_job_site_id;
  const { data: rows } = await supabaseAdmin
    .from("time_entries")
    .select("worker_id, clock_in, clock_out, planned_job_site_id, assigned_job_site_ids, job_site_id, geo_status")
    .not("clock_out", "is", null)
    .or(`planned_job_site_id.eq.${siteId},job_site_id.eq.${siteId},assigned_job_site_ids.cs.{${siteId}}`);

  const workerHours = new Map<string, number>();
  for (const r of rows ?? []) {
    if (attributeEntry(r as any) !== siteId) continue;
    const h = (new Date(r.clock_out!).getTime() - new Date(r.clock_in).getTime()) / 3_600_000;
    if (!Number.isFinite(h) || h <= 0) continue;
    workerHours.set(r.worker_id, (workerHours.get(r.worker_id) ?? 0) + h);
  }

  let labor = 0;
  if (workerHours.size > 0) {
    const { data: workers } = await supabaseAdmin
      .from("workers").select("id, hourly_rate").in("id", Array.from(workerHours.keys()));
    for (const w of workers ?? []) {
      const h = workerHours.get(w.id) ?? 0;
      labor += h * (Number(w.hourly_rate) || 0);
    }
  }
  labor = Math.round(labor * 100) / 100;

  const totalP = Number(job.total_price) || 0;
  const exp = (Number(job.finish_materials) || 0) + (Number(job.building_materials) || 0)
    + (Number(job.subs) || 0) + labor;
  const net = totalP - exp;
  const margin = totalP > 0 ? net / totalP : 0;

  await supabaseAdmin.from("ledger_jobs").update({
    labor,
    net,
    profit_margin: margin,
    labor_synced_at: new Date().toISOString(),
  } as never).eq("id", jobId);
}

// Convenience: recompute for any site touched by a single time_entry (in or out or planned).
export async function recomputeLaborForEntryContext(opts: {
  planned_job_site_id?: string | null;
  assigned_job_site_ids?: string[] | null;
  job_site_id?: string | null;
  clock_out_job_site_id?: string | null;
}): Promise<void> {
  const ids = new Set<string>();
  if (opts.planned_job_site_id) ids.add(opts.planned_job_site_id);
  if (opts.job_site_id) ids.add(opts.job_site_id);
  if (opts.clock_out_job_site_id) ids.add(opts.clock_out_job_site_id);
  for (const id of opts.assigned_job_site_ids ?? []) ids.add(id);
  for (const id of ids) {
    try { await recomputeLedgerLaborForSite(id); } catch { /* ignore individual failures */ }
  }
}

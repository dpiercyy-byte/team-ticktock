import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/auth.server";

const db = supabaseAdmin as any;

export type OsJob = {
  id: string;
  client_id: string | null;
  client_name?: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  project_type: string | null;
  trades: string[];
  status: string;
  budget_cents: number;
  collected_cents: number;
  expenses_cents: number;
  progress: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

const JOB_FIELDS =
  "id, client_id, name, address, lat, lng, project_type, trades, status, budget_cents, collected_cents, expenses_cents, progress, archived_at, created_at, updated_at, clients:client_id(name)";

function shape(row: any): OsJob {
  return { ...row, client_name: row.clients?.name ?? null };
}

export const listJobs = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; status?: string | null }) =>
    z.object({ token: z.string(), status: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    let q = db.from("os_jobs").select(JOB_FIELDS).is("archived_at", null).order("updated_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map(shape) as OsJob[];
  });

export const getJob = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: row, error } = await db.from("os_jobs").select(JOB_FIELDS).eq("id", data.id).single();
    if (error) throw error;
    return shape(row);
  });

const CreateInput = z.object({
  token: z.string(),
  client_id: z.string().uuid().nullable().optional(),
  new_client_name: z.string().optional(),
  address: z.string().min(1),
  project_type: z.string().min(1),
  trades: z.array(z.string()).default([]),
  status: z.string().default("lead"),
});

export const createJob = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);

    let clientId = data.client_id ?? null;
    let clientName: string | null = null;
    if (!clientId && data.new_client_name?.trim()) {
      const { data: c, error: ce } = await db
        .from("clients")
        .insert({ name: data.new_client_name.trim() })
        .select("id, name")
        .single();
      if (ce) throw ce;
      clientId = c.id;
      clientName = c.name;
    } else if (clientId) {
      const { data: c } = await db.from("clients").select("name").eq("id", clientId).single();
      clientName = c?.name ?? null;
    }

    // Derive short job name from address (first line)
    const shortAddr = data.address.split(",")[0].trim();
    const name = clientName ? `${shortAddr} — ${clientName}` : shortAddr;

    const { data: job, error } = await db
      .from("os_jobs")
      .insert({
        client_id: clientId,
        name,
        address: data.address,
        project_type: data.project_type,
        trades: data.trades,
        status: data.status,
      })
      .select("id")
      .single();
    if (error) throw error;

    await db.from("job_events").insert({
      job_id: job.id,
      kind: "created",
      title: "Job created",
      body: `${data.project_type} · ${data.trades.length} trade${data.trades.length === 1 ? "" : "s"}`,
    });

    return { id: job.id as string };
  });

const UpdateInput = z.object({
  token: z.string(),
  id: z.string().uuid(),
  patch: z
    .object({
      name: z.string().min(1).optional(),
      status: z.string().optional(),
      progress: z.number().int().min(0).max(100).optional(),
      budget_cents: z.number().int().nonnegative().optional(),
      collected_cents: z.number().int().nonnegative().optional(),
      expenses_cents: z.number().int().nonnegative().optional(),
      trades: z.array(z.string()).optional(),
      project_type: z.string().optional(),
    })
    .partial(),
});

export const updateJob = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: prev } = await db.from("os_jobs").select("status").eq("id", data.id).single();
    const { error } = await db.from("os_jobs").update(data.patch).eq("id", data.id);
    if (error) throw error;
    if (data.patch.status && prev && prev.status !== data.patch.status) {
      await db.from("job_events").insert({
        job_id: data.id,
        kind: "status",
        title: `Status → ${data.patch.status}`,
      });
    }
    return { ok: true };
  });

export const archiveJob = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { error } = await db.from("os_jobs").update({ archived_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

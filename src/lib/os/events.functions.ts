import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/auth.server";

const db = supabaseAdmin as any;

export type JobEvent = {
  id: string;
  job_id: string;
  kind: string;
  title: string;
  body: string | null;
  meta: Record<string, any>;
  occurred_at: string;
};

export const listJobEvents = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; job_id: string }) =>
    z.object({ token: z.string(), job_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { data: rows, error } = await db
      .from("job_events")
      .select("id, job_id, kind, title, body, meta, occurred_at")
      .eq("job_id", data.job_id)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as JobEvent[];
  });

export const addJobEvent = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; job_id: string; title: string; body?: string; kind?: string }) =>
    z
      .object({
        token: z.string(),
        job_id: z.string().uuid(),
        title: z.string().min(1),
        body: z.string().optional(),
        kind: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.token);
    const { error } = await db.from("job_events").insert({
      job_id: data.job_id,
      kind: data.kind ?? "note",
      title: data.title,
      body: data.body ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

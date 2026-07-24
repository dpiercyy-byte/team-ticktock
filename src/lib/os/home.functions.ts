import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/auth.server";

const db = supabaseAdmin as any;

const FIELDS = "id, name, address, status, progress, client_id, clients:client_id(name)";

function shape(rows: any[]) {
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    address: r.address as string | null,
    status: r.status as string,
    progress: r.progress as number,
    client_name: r.clients?.name ?? null,
  }));
}

export type BriefingJob = ReturnType<typeof shape>[number];

export const getHomeBriefing = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin(data.token);

    const [active, estimates, action, recent] = await Promise.all([
      db.from("os_jobs").select(FIELDS).eq("status", "active").is("archived_at", null).order("updated_at", { ascending: false }).limit(8),
      db.from("os_jobs").select(FIELDS).in("status", ["estimate_required", "waiting_for_approval"]).is("archived_at", null).order("updated_at", { ascending: false }).limit(8),
      db.from("os_jobs").select(FIELDS).in("status", ["site_visit_required", "lead"]).is("archived_at", null).order("updated_at", { ascending: false }).limit(8),
      db.from("os_jobs").select(FIELDS).is("archived_at", null).order("updated_at", { ascending: false }).limit(8),
    ]);

    return {
      today: shape(active.data ?? []),
      estimates: shape(estimates.data ?? []),
      action: shape(action.data ?? []),
      recent: shape(recent.data ?? []),
    };
  });

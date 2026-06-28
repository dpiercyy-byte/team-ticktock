import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";

const base = z.object({ token: z.string() });

export const adminListAuditLog = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    base.extend({
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      actorKind: z.enum(["admin", "worker", "system"]).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let q = supabaseAdmin
      .from("audit_log")
      .select("id, created_at, actor_kind, actor_id, actor_label, action, entity_type, entity_id, before, after, metadata, workers:actor_id(name)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.entityId) q = q.eq("entity_id", data.entityId);
    if (data.actorKind) q = q.eq("actor_kind", data.actorKind);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { ...refreshed, entries: rows ?? [] };
  });

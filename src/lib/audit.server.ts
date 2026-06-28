import { supabaseAdmin } from "./db.server";

export type AuditActor =
  | { kind: "admin"; label?: string }
  | { kind: "worker"; id: string; label?: string }
  | { kind: "system"; label?: string };

export type AuditEntry = {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

export async function logAudit(e: AuditEntry): Promise<void> {
  try {
    let label = e.actor.label ?? null;
    if (!label && e.actor.kind === "worker") {
      const { data } = await supabaseAdmin
        .from("workers").select("name").eq("id", e.actor.id).maybeSingle();
      label = data?.name ?? null;
    }
    if (!label && e.actor.kind === "admin") label = "Admin";
    await supabaseAdmin.from("audit_log").insert({
      actor_kind: e.actor.kind,
      actor_id: e.actor.kind === "worker" ? e.actor.id : null,
      actor_label: label,
      action: e.action,
      entity_type: e.entityType,
      entity_id: e.entityId ?? null,
      before: (e.before ?? null) as never,
      after: (e.after ?? null) as never,
      metadata: (e.metadata ?? null) as never,
    });
  } catch (err) {
    // Never let audit failures break the user's action.
    console.error("[audit] failed to log", err);
  }
}

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
    await supabaseAdmin.from("audit_log").insert({
      actor_kind: e.actor.kind,
      actor_id: e.actor.kind === "worker" ? e.actor.id : null,
      actor_label: e.actor.label ?? null,
      action: e.action,
      entity_type: e.entityType,
      entity_id: e.entityId ?? null,
      before: e.before ?? null,
      after: e.after ?? null,
      metadata: e.metadata ?? null,
    });
  } catch (err) {
    // Never let audit failures break the user's action.
    console.error("[audit] failed to log", err);
  }
}

/**
 * Pure decision logic for the "Activate Job" workflow.
 * Kept free of IO so it can be unit tested.
 */

export type CandidateSite = {
  id: string;
  address: string;
  kind: string | null;
  archived_at: string | null;
  project_id: string | null;
};

export type ActivationDecision =
  | { action: "noop"; jobSiteId: string | null; reason: "already_activated" }
  | { action: "reuse_linked"; jobSiteId: string }
  | { action: "link_existing"; jobSiteId: string }
  | { action: "create"; jobSiteId: null };

const normAddress = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");

/**
 * Decide what the activation should do with job sites.
 * - Already activated -> no-op (idempotent).
 * - A client site already linked to this project -> reuse it.
 * - An unlinked, non-archived *client* site at the same address -> link it.
 * - Otherwise create a new client site.
 * Supplier sites are never matched or reused.
 */
export function decideActivation(args: {
  projectId: string;
  activatedAt: string | null;
  address: string;
  sites: CandidateSite[];
}): ActivationDecision {
  const active = args.sites.filter((s) => !s.archived_at && (s.kind ?? "client") === "client");
  const linked = active.find((s) => s.project_id === args.projectId) ?? null;

  if (args.activatedAt) {
    return { action: "noop", jobSiteId: linked?.id ?? null, reason: "already_activated" };
  }
  if (linked) return { action: "reuse_linked", jobSiteId: linked.id };

  const target = normAddress(args.address);
  const match = target
    ? active.find((s) => !s.project_id && normAddress(s.address) === target)
    : undefined;
  if (match) return { action: "link_existing", jobSiteId: match.id };

  return { action: "create", jobSiteId: null };
}

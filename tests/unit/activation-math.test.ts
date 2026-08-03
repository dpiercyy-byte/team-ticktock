import { describe, expect, it } from "vitest";
import { decideActivation, type CandidateSite } from "@/lib/activation-math";

const PROJECT = "11111111-1111-4111-8111-111111111111";

const site = (over: Partial<CandidateSite>): CandidateSite => ({
  id: "s1",
  address: "16 Ostick Ave, Toronto, ON",
  kind: "client",
  archived_at: null,
  project_id: null,
  ...over,
});

describe("decideActivation", () => {
  it("creates a site when nothing matches", () => {
    expect(
      decideActivation({ projectId: PROJECT, activatedAt: null, address: "1 New St", sites: [] }),
    ).toEqual({ action: "create", jobSiteId: null });
  });

  it("reuses the site already linked to the project", () => {
    const d = decideActivation({
      projectId: PROJECT,
      activatedAt: null,
      address: "somewhere else",
      sites: [site({ id: "linked", project_id: PROJECT })],
    });
    expect(d).toEqual({ action: "reuse_linked", jobSiteId: "linked" });
  });

  it("links an unlinked client site at the same address, ignoring punctuation and case", () => {
    const d = decideActivation({
      projectId: PROJECT,
      activatedAt: null,
      address: "16 ostick ave  toronto ON",
      sites: [site({ id: "match" })],
    });
    expect(d).toEqual({ action: "link_existing", jobSiteId: "match" });
  });

  it("never matches a supplier site at the same address", () => {
    const d = decideActivation({
      projectId: PROJECT,
      activatedAt: null,
      address: "16 Ostick Ave, Toronto, ON",
      sites: [site({ id: "supplier", kind: "supplier" })],
    });
    expect(d).toEqual({ action: "create", jobSiteId: null });
  });

  it("never matches an archived site", () => {
    const d = decideActivation({
      projectId: PROJECT,
      activatedAt: null,
      address: "16 Ostick Ave, Toronto, ON",
      sites: [site({ id: "old", archived_at: "2026-01-01T00:00:00Z" })],
    });
    expect(d.action).toBe("create");
  });

  it("is idempotent once the project is activated", () => {
    const d = decideActivation({
      projectId: PROJECT,
      activatedAt: "2026-08-01T00:00:00Z",
      address: "16 Ostick Ave, Toronto, ON",
      sites: [site({ id: "linked", project_id: PROJECT })],
    });
    expect(d).toEqual({ action: "noop", jobSiteId: "linked", reason: "already_activated" });
  });

  it("no-ops even when no site is linked yet", () => {
    const d = decideActivation({
      projectId: PROJECT,
      activatedAt: "2026-08-01T00:00:00Z",
      address: "16 Ostick Ave",
      sites: [],
    });
    expect(d).toEqual({ action: "noop", jobSiteId: null, reason: "already_activated" });
  });

  it("does not steal a site already linked to another project", () => {
    const d = decideActivation({
      projectId: PROJECT,
      activatedAt: null,
      address: "16 Ostick Ave, Toronto, ON",
      sites: [site({ id: "other", project_id: "22222222-2222-4222-8222-222222222222" })],
    });
    expect(d.action).toBe("create");
  });
});

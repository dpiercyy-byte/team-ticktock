import { describe, expect, it, beforeAll, vi, afterEach } from "vitest";

// auth.server derives its HMAC key from the service-role key. Use a synthetic
// one so tests never depend on real project secrets.
beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-signing-secret";
});

const load = async () => await import("@/lib/auth.server");

afterEach(() => vi.useRealTimers());

describe("token signing", () => {
  it("round-trips a worker token and returns the worker id", async () => {
    const { signToken, requireWorker, WORKER_TTL } = await load();
    const t = signToken({ kind: "worker", wid: "w-1" }, WORKER_TTL);
    expect(requireWorker(t)).toBe("w-1");
  });

  it("rejects a worker token on the admin surface", async () => {
    const { signToken, requireAdmin, WORKER_TTL } = await load();
    const t = signToken({ kind: "worker", wid: "w-1" }, WORKER_TTL);
    expect(() => requireAdmin(t)).toThrow();
  });

  it("rejects an admin token on the worker surface", async () => {
    const { signToken, requireWorker, ADMIN_TTL } = await load();
    const t = signToken({ kind: "admin" }, ADMIN_TTL);
    expect(() => requireWorker(t)).toThrow();
  });

  it("issues a fresh sliding admin token on every verify", async () => {
    const { signToken, requireAdmin, ADMIN_TTL } = await load();
    const t = signToken({ kind: "admin" }, ADMIN_TTL);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);
    const refreshed = requireAdmin(t);
    expect(refreshed.token).toBeTruthy();
    expect(refreshed.token).not.toBe(t);
    // The refreshed token must still verify.
    expect(() => requireAdmin(refreshed.token)).not.toThrow();
  });

  it("rejects an expired token", async () => {
    const { signToken, verifyToken } = await load();
    const t = signToken({ kind: "admin" }, 1);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5_000);
    expect(() => verifyToken(t)).toThrow();
  });

  it("rejects a tampered payload", async () => {
    const { signToken, verifyToken } = await load();
    const t = signToken({ kind: "worker", wid: "w-1" }, 3600);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(
      JSON.stringify({ kind: "admin", exp: Math.floor(Date.now() / 1000) + 3600 }),
    )
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(body).not.toBe(forged);
    expect(() => verifyToken(`${forged}.${sig}`)).toThrow();
  });

  it("rejects a malformed token", async () => {
    const { verifyToken } = await load();
    expect(() => verifyToken("garbage")).toThrow();
    expect(() => verifyToken("")).toThrow();
  });
});

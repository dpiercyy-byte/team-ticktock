import crypto from "node:crypto";

function getSecret() {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!s) throw new Error("Missing signing secret");
  return s;
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(s: string) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signToken(payload: Record<string, unknown>, ttlSec: number) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const json = b64url(Buffer.from(JSON.stringify(body)));
  const sig = b64url(crypto.createHmac("sha256", getSecret()).update(json).digest());
  return `${json}.${sig}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): T & { exp: number } {
  const [json, sig] = token.split(".");
  if (!json || !sig) throw new Response("Unauthorized", { status: 401 });
  const expected = b64url(crypto.createHmac("sha256", getSecret()).update(json).digest());
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const payload = JSON.parse(fromB64url(json).toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Response("Session expired", { status: 401 });
  }
  return payload;
}

export const WORKER_TTL = 60 * 60 * 24 * 365; // 1 year
export const ADMIN_TTL = 60 * 30; // 30 min sliding

export function requireWorker(token: string): string {
  const p = verifyToken<{ kind: string; wid: string }>(token);
  if (p.kind !== "worker" || !p.wid) throw new Response("Unauthorized", { status: 401 });
  return p.wid;
}

export function requireAdmin(token: string): { token: string } {
  const p = verifyToken<{ kind: string }>(token);
  if (p.kind !== "admin") throw new Response("Unauthorized", { status: 401 });
  return { token: signToken({ kind: "admin" }, ADMIN_TTL) };
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, verifyHash, hashPassword } from "./db.server";
import { signToken, verifyToken, WORKER_TTL, ADMIN_TTL } from "./auth.server";

// Public: list workers (id+name only) for login picker
export const listWorkersPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("workers")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data ?? [];
});

// Worker login with PIN
export const workerLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ workerId: z.string().uuid(), pin: z.string().min(4).max(12) }).parse(d))
  .handler(async ({ data }) => {
    const { data: w, error } = await supabaseAdmin
      .from("workers")
      .select("id, name, pin_hash")
      .eq("id", data.workerId)
      .maybeSingle();
    if (error) throw error;
    if (!w) throw new Response("Invalid", { status: 401 });
    const ok = await verifyHash(data.pin, w.pin_hash);
    if (!ok) throw new Response("Invalid PIN", { status: 401 });
    const token = signToken({ kind: "worker", wid: w.id }, WORKER_TTL);
    return { token, worker: { id: w.id, name: w.name } };
  });

export function requireWorker(token: string): string {
  const p = verifyToken<{ kind: string; wid: string }>(token);
  if (p.kind !== "worker" || !p.wid) throw new Response("Unauthorized", { status: 401 });
  return p.wid;
}

export function requireAdmin(token: string): { token: string } {
  const p = verifyToken<{ kind: string }>(token);
  if (p.kind !== "admin") throw new Response("Unauthorized", { status: 401 });
  // sliding refresh
  return { token: signToken({ kind: "admin" }, ADMIN_TTL) };
}

// Admin login
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { data: s, error } = await supabaseAdmin
      .from("app_settings")
      .select("admin_password_hash")
      .eq("id", 1)
      .single();
    if (error) throw error;
    const ok = await verifyHash(data.password, s.admin_password_hash);
    if (!ok) throw new Response("Invalid password", { status: 401 });
    return { token: signToken({ kind: "admin" }, ADMIN_TTL) };
  });

export const adminChangePassword = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string(), newPassword: z.string().min(4).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const hash = await hashPassword(data.newPassword);
    const { error } = await supabaseAdmin.from("app_settings").update({ admin_password_hash: hash }).eq("id", 1);
    if (error) throw error;
    return refreshed;
  });

// expose hashPassword helper through server fn boundary indirectly via worker create
export { hashPassword };

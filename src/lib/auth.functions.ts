import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, verifyHash, hashPassword } from "./db.server";
import { signToken, WORKER_TTL, ADMIN_TTL, requireAdmin } from "./auth.server";

export const listWorkersPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.from("workers").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
});

export const workerLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ workerId: z.string().uuid(), pin: z.string().min(4).max(12) }).parse(d))
  .handler(async ({ data }) => {
    const { data: w, error } = await supabaseAdmin
      .from("workers").select("id, name, pin_hash").eq("id", data.workerId).maybeSingle();
    if (error) throw error;
    if (!w) return { ok: false as const, error: "Invalid PIN" };
    const ok = await verifyHash(data.pin, w.pin_hash);
    if (!ok) return { ok: false as const, error: "Invalid PIN" };
    const token = signToken({ kind: "worker", wid: w.id }, WORKER_TTL);
    return { ok: true as const, token, worker: { id: w.id, name: w.name } };
  });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { data: s, error } = await supabaseAdmin
      .from("app_settings").select("admin_password_hash").eq("id", 1).single();
    if (error) throw error;
    const ok = await verifyHash(data.password, s.admin_password_hash);
    if (!ok) return { ok: false as const, error: "Invalid password" };
    return { ok: true as const, token: signToken({ kind: "admin" }, ADMIN_TTL) };
  });


export const adminVerify = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => requireAdmin(data.token));

export const adminChangePassword = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string(), newPassword: z.string().min(4).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const hash = await hashPassword(data.newPassword);
    const { error } = await supabaseAdmin.from("app_settings").update({ admin_password_hash: hash }).eq("id", 1);
    if (error) throw error;
    return refreshed;
  });

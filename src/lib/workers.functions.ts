import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, hashPassword } from "./db.server";
import { requireAdmin } from "./auth.server";

const adminInput = z.object({ token: z.string() });

export const listWorkersAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => adminInput.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("workers")
      .select("id, name, hourly_rate, created_at, phone, email, address, emergency_contact_name, emergency_contact_phone")
      .order("name");
    if (error) throw error;
    return { ...refreshed, workers: rows ?? [] };
  });

export const createWorker = createServerFn({ method: "POST" })
  .inputValidator((d) => adminInput.extend({
    name: z.string().trim().min(1).max(80),
    pin: z.string().min(4).max(12),
    hourlyRate: z.number().min(0).max(10000),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: existing } = await supabaseAdmin
      .from("workers").select("id").ilike("name", data.name).maybeSingle();
    if (existing) throw new Response("Name already exists", { status: 400 });
    const pin_hash = await hashPassword(data.pin);
    const { error } = await supabaseAdmin.from("workers").insert({
      name: data.name, pin_hash, hourly_rate: data.hourlyRate,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return refreshed;
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .inputValidator((d) => adminInput.extend({ workerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("workers").delete().eq("id", data.workerId);
    if (error) throw error;
    return refreshed;
  });

export const setWorkerRate = createServerFn({ method: "POST" })
  .inputValidator((d) => adminInput.extend({
    workerId: z.string().uuid(), hourlyRate: z.number().min(0).max(10000),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("workers")
      .update({ hourly_rate: data.hourlyRate }).eq("id", data.workerId);
    if (error) throw error;
    return refreshed;
  });

export const setWorkerName = createServerFn({ method: "POST" })
  .inputValidator((d) => adminInput.extend({
    workerId: z.string().uuid(), name: z.string().trim().min(1).max(80),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: existing } = await supabaseAdmin
      .from("workers").select("id").ilike("name", data.name).neq("id", data.workerId).maybeSingle();
    if (existing) throw new Response("Name already exists", { status: 400 });
    const { error } = await supabaseAdmin.from("workers")
      .update({ name: data.name }).eq("id", data.workerId);
    if (error) throw new Response(error.message, { status: 400 });
    return refreshed;
  });

export const resetWorkerPin = createServerFn({ method: "POST" })
  .inputValidator((d) => adminInput.extend({
    workerId: z.string().uuid(), newPin: z.string().min(4).max(12),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const pin_hash = await hashPassword(data.newPin);
    const { error } = await supabaseAdmin.from("workers")
      .update({ pin_hash }).eq("id", data.workerId);
    if (error) throw error;
    return refreshed;
  });


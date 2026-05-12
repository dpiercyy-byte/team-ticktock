import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";

const adminBase = z.object({ token: z.string() });

export const listReimbursements = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    workerId: z.string().uuid(),
    weekStart: z.string(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("reimbursements").select("id, description, amount, week_start, created_at")
      .eq("worker_id", data.workerId).eq("week_start", data.weekStart)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ...refreshed, items: rows ?? [] };
  });

export const addReimbursement = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    workerId: z.string().uuid(),
    weekStart: z.string(),
    description: z.string().trim().min(1).max(200),
    amount: z.number().min(0).max(100000),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("reimbursements").insert({
      worker_id: data.workerId,
      week_start: data.weekStart,
      description: data.description,
      amount: data.amount,
    });
    if (error) throw error;
    return refreshed;
  });

export const deleteReimbursement = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("reimbursements").delete().eq("id", data.id);
    if (error) throw error;
    return refreshed;
  });

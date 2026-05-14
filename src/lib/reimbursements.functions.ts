import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin, requireWorker } from "./auth.server";

const adminBase = z.object({ token: z.string() });
const workerBase = z.object({ token: z.string() });

const ALLOWED_MIMES = ["image/jpeg", "image/png", "application/pdf"] as const;

function currentWeekStartISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString().slice(0, 10);
}

export const listReimbursements = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    workerId: z.string().uuid(),
    weekStart: z.string(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("reimbursements")
      .select("id, description, amount, week_start, created_at, receipt_url, receipt_mime")
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
    receiptUrl: z.string().url().nullable().optional(),
    receiptMime: z.string().max(100).nullable().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("reimbursements").insert({
      worker_id: data.workerId,
      week_start: data.weekStart,
      description: data.description,
      amount: data.amount,
      receipt_url: data.receiptUrl ?? null,
      receipt_mime: data.receiptMime ?? null,
    });
    if (error) throw error;
    return refreshed;
  });

export const deleteReimbursement = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    // Best-effort delete the storage object too
    const { data: row } = await supabaseAdmin
      .from("reimbursements").select("receipt_url").eq("id", data.id).maybeSingle();
    if (row?.receipt_url) {
      const marker = "/object/public/receipts/";
      const idx = row.receipt_url.indexOf(marker);
      if (idx >= 0) {
        const path = row.receipt_url.slice(idx + marker.length);
        await supabaseAdmin.storage.from("receipts").remove([path]);
      }
    }
    const { error } = await supabaseAdmin.from("reimbursements").delete().eq("id", data.id);
    if (error) throw error;
    return refreshed;
  });

export const uploadReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    filename: z.string().min(1).max(200),
    mime: z.enum(ALLOWED_MIMES),
    // base64-encoded file contents (no data: prefix), max ~10MB
    base64: z.string().min(1).max(15_000_000),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");
    const ext = data.mime === "application/pdf" ? "pdf"
              : data.mime === "image/png" ? "png" : "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage.from("receipts").upload(path, bytes, {
      contentType: data.mime,
      upsert: false,
    });
    if (error) throw error;
    const { data: pub } = supabaseAdmin.storage.from("receipts").getPublicUrl(path);
    return { ...refreshed, url: pub.publicUrl, mime: data.mime };
  });

// ===== Worker-facing =====

export const workerUploadReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => workerBase.extend({
    filename: z.string().min(1).max(200),
    mime: z.enum(ALLOWED_MIMES),
    base64: z.string().min(1).max(15_000_000),
  }).parse(d))
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");
    const ext = data.mime === "application/pdf" ? "pdf"
              : data.mime === "image/png" ? "png" : "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage.from("receipts").upload(path, bytes, {
      contentType: data.mime,
      upsert: false,
    });
    if (error) throw error;
    const { data: pub } = supabaseAdmin.storage.from("receipts").getPublicUrl(path);
    return { url: pub.publicUrl, mime: data.mime };
  });

export const workerSubmitReimbursement = createServerFn({ method: "POST" })
  .inputValidator((d) => workerBase.extend({
    description: z.string().trim().min(1).max(200),
    amount: z.number().min(0).max(100000),
    receiptUrl: z.string().url().nullable().optional(),
    receiptMime: z.string().max(100).nullable().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const weekStart = currentWeekStartISO();
    const { error } = await supabaseAdmin.from("reimbursements").insert({
      worker_id: wid,
      week_start: weekStart,
      description: data.description,
      amount: data.amount,
      receipt_url: data.receiptUrl ?? null,
      receipt_mime: data.receiptMime ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const workerListReimbursements = createServerFn({ method: "POST" })
  .inputValidator((d) => workerBase.parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const weekStart = currentWeekStartISO();
    const { data: rows, error } = await supabaseAdmin
      .from("reimbursements")
      .select("id, description, amount, week_start, created_at, receipt_url, receipt_mime")
      .eq("worker_id", wid).eq("week_start", weekStart)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { items: rows ?? [], weekStart };
  });

export const workerDeleteReimbursement = createServerFn({ method: "POST" })
  .inputValidator((d) => workerBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    // Only allow deleting own rows
    const { data: row, error: getErr } = await supabaseAdmin
      .from("reimbursements").select("id, worker_id, receipt_url").eq("id", data.id).maybeSingle();
    if (getErr) throw getErr;
    if (!row || row.worker_id !== wid) throw new Error("Not found");
    if (row.receipt_url) {
      const marker = "/object/public/receipts/";
      const idx = row.receipt_url.indexOf(marker);
      if (idx >= 0) {
        const path = row.receipt_url.slice(idx + marker.length);
        await supabaseAdmin.storage.from("receipts").remove([path]);
      }
    }
    const { error } = await supabaseAdmin.from("reimbursements").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin, requireWorker } from "./auth.server";
import { logAudit } from "./audit.server";

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

export const listAllReceipts = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    workerId: z.string().uuid().optional(),
    weekStart: z.string().optional(),
    withReceiptOnly: z.boolean().optional(),
    limit: z.number().int().positive().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let q = supabaseAdmin
      .from("reimbursements")
      .select("id, worker_id, description, amount, week_start, created_at, receipt_url, receipt_mime, parsed_vendor, parsed_date, parsed_subtotal, parsed_tax, parsed_total, parsed_category, parsed_job_site_id, parse_status, parse_confidence, workers(name), job_sites!reimbursements_parsed_job_site_id_fkey(label)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 500);
    if (data.workerId) q = q.eq("worker_id", data.workerId);
    if (data.weekStart) q = q.eq("week_start", data.weekStart);
    if (data.withReceiptOnly !== false) q = q.not("receipt_url", "is", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    const items = (rows ?? []).map((r: any) => ({
      id: r.id,
      workerId: r.worker_id,
      workerName: r.workers?.name ?? "Unknown",
      description: r.description,
      amount: Number(r.amount),
      weekStart: r.week_start as string,
      createdAt: r.created_at as string,
      receiptUrl: r.receipt_url as string | null,
      receiptMime: r.receipt_mime as string | null,
      parsedVendor: r.parsed_vendor as string | null,
      parsedDate: r.parsed_date as string | null,
      parsedSubtotal: r.parsed_subtotal == null ? null : Number(r.parsed_subtotal),
      parsedTax: r.parsed_tax == null ? null : Number(r.parsed_tax),
      parsedTotal: r.parsed_total == null ? null : Number(r.parsed_total),
      parsedCategory: r.parsed_category as string | null,
      parsedJobSiteId: r.parsed_job_site_id as string | null,
      parsedJobSiteLabel: r.job_sites?.label ?? null,
      parseStatus: r.parse_status as string | null,
      parseConfidence: r.parse_confidence == null ? null : Number(r.parse_confidence),
    }));
    return { ...refreshed, items };
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
    const { data: inserted, error } = await supabaseAdmin.from("reimbursements").insert({
      worker_id: data.workerId,
      week_start: data.weekStart,
      description: data.description,
      amount: data.amount,
      receipt_url: data.receiptUrl ?? null,
      receipt_mime: data.receiptMime ?? null,
    }).select("id").single();
    if (error) throw error;
    if (inserted?.id && data.receiptUrl) {
      const { runParseForReimbursement } = await import("./receipts.functions");
      runParseForReimbursement(inserted.id).catch((e) => console.error("parse trigger", e));
    }
    await logAudit({
      actor: { kind: "admin" },
      action: "reimbursement_create",
      entityType: "reimbursement",
      entityId: inserted?.id,
      after: { worker_id: data.workerId, week_start: data.weekStart, description: data.description, amount: data.amount, has_receipt: !!data.receiptUrl },
    });
    return refreshed;
  });


export const deleteReimbursement = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row } = await supabaseAdmin
      .from("reimbursements").select("id, worker_id, week_start, description, amount, receipt_url").eq("id", data.id).maybeSingle();
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
    await logAudit({
      actor: { kind: "admin" },
      action: "reimbursement_delete",
      entityType: "reimbursement",
      entityId: data.id,
      before: row ?? undefined,
    });
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
    const { data: inserted, error } = await supabaseAdmin.from("reimbursements").insert({
      worker_id: wid,
      week_start: weekStart,
      description: data.description,
      amount: data.amount,
      receipt_url: data.receiptUrl ?? null,
      receipt_mime: data.receiptMime ?? null,
    }).select("id").single();
    if (error) throw error;
    if (inserted?.id && data.receiptUrl) {
      const { runParseForReimbursement } = await import("./receipts.functions");
      runParseForReimbursement(inserted.id).catch((e) => console.error("parse trigger", e));
    }
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "reimbursement_create",
      entityType: "reimbursement",
      entityId: inserted?.id,
      after: { week_start: weekStart, description: data.description, amount: data.amount, has_receipt: !!data.receiptUrl },
    });
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
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "reimbursement_delete",
      entityType: "reimbursement",
      entityId: data.id,
      before: row,
    });
    return { ok: true };
  });

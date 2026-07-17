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
    kind: z.enum(["all", "worker", "admin"]).optional(),
    materialType: z.enum(["all", "regular", "client_billable"]).optional(),
    limit: z.number().int().positive().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let q = supabaseAdmin
      .from("reimbursements")
      .select("id, worker_id, is_admin_receipt, uploaded_by_admin, payee_label, description, amount, week_start, created_at, receipt_url, receipt_mime, parsed_vendor, parsed_date, parsed_subtotal, parsed_tax, parsed_total, parsed_category, parsed_job_site_id, parse_status, parse_confidence, material_type, billable_job_site_id, workers(name), parsed_site:job_sites!reimbursements_parsed_job_site_id_fkey(label), billable_site:job_sites!reimbursements_billable_job_site_id_fkey(label)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 500);
    if (data.workerId) q = q.eq("worker_id", data.workerId);
    if (data.weekStart) q = q.eq("week_start", data.weekStart);
    if (data.withReceiptOnly !== false) q = q.not("receipt_url", "is", null);
    if (data.kind === "worker") q = q.eq("is_admin_receipt", false);
    if (data.kind === "admin") q = q.eq("is_admin_receipt", true);
    if (data.materialType && data.materialType !== "all") q = q.eq("material_type", data.materialType);
    const { data: rows, error } = await q;
    if (error) throw error;
    const items = (rows ?? []).map((r: any) => ({
      id: r.id,
      workerId: r.worker_id,
      workerName: r.is_admin_receipt
        ? (r.payee_label || r.parsed_vendor || "Admin")
        : (r.workers?.name ?? "Unknown"),
      isAdminReceipt: !!r.is_admin_receipt,
      uploadedByAdmin: !!r.uploaded_by_admin,
      payeeLabel: r.payee_label as string | null,
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
      parsedJobSiteLabel: r.parsed_site?.label ?? null,
      parseStatus: r.parse_status as string | null,
      parseConfidence: r.parse_confidence == null ? null : Number(r.parse_confidence),
      materialType: (r.material_type ?? "regular") as "regular" | "client_billable",
      billableJobSiteId: r.billable_job_site_id as string | null,
      billableJobSiteLabel: r.billable_site?.label ?? null,
    }));
    return { ...refreshed, items };
  });


function currentWeekStartFromAdmin(): string {
  return currentWeekStartISO();
}

export const adminAddStandaloneReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    payeeLabel: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(200).optional(),
    amount: z.number().min(0).max(100000).optional(),
    weekStart: z.string().optional(),
    receiptUrl: z.string().url(),
    receiptMime: z.string().max(100),
    jobSiteId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const weekStart = data.weekStart || currentWeekStartFromAdmin();
    const { data: inserted, error } = await supabaseAdmin.from("reimbursements").insert({
      worker_id: null,
      is_admin_receipt: true,
      uploaded_by_admin: true,
      payee_label: data.payeeLabel ?? null,
      week_start: weekStart,
      description: data.description || data.payeeLabel || "Receipt",
      amount: data.amount ?? 0,
      receipt_url: data.receiptUrl,
      receipt_mime: data.receiptMime,
      parsed_job_site_id: data.jobSiteId ?? null,
    }).select("id").single();
    if (error) throw error;
    if (inserted?.id) {
      try {
        const { runParseForReimbursement } = await import("./receipts.functions");
        await runParseForReimbursement(inserted.id);
      } catch (e) {
        console.error("parse trigger", e);
      }
    }
    await logAudit({
      actor: { kind: "admin" },
      action: "admin_receipt_create",
      entityType: "reimbursement",
      entityId: inserted?.id,
      after: { payee: data.payeeLabel, week_start: weekStart, amount: data.amount ?? 0, job_site_id: data.jobSiteId ?? null },
    });
    return { ...refreshed, id: inserted?.id };
  });

export const updateStandaloneReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    id: z.string().uuid(),
    payeeLabel: z.string().trim().min(1).max(100).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const patch: any = {};
    if (data.payeeLabel !== undefined) patch.payee_label = data.payeeLabel;
    if (Object.keys(patch).length === 0) return refreshed;
    const { error } = await supabaseAdmin.from("reimbursements").update(patch).eq("id", data.id).eq("is_admin_receipt", true);
    if (error) throw error;
    try {
      const { syncRowExternal } = await import("./receipts.functions");
      await syncRowExternal(data.id);
    } catch (e) { console.error("sheet sync failed", e); }
    await logAudit({
      actor: { kind: "admin" }, action: "admin_receipt_update",
      entityType: "reimbursement", entityId: data.id, after: patch,
    });
    return refreshed;
  });


export const addReimbursement = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({
    workerId: z.string().uuid(),
    weekStart: z.string(),
    description: z.string().trim().min(1).max(200),
    amount: z.number().min(0).max(100000),
    receiptUrl: z.string().url().nullable().optional(),
    receiptMime: z.string().max(100).nullable().optional(),
    billableJobSiteId: z.string().uuid().nullable().optional(),
    parsedJobSiteId: z.string().uuid().nullable().optional(),
    materialType: z.enum(["regular", "client_billable"]).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    let billableJobSiteId: string | null = null;
    if (data.billableJobSiteId) {
      const { data: site } = await supabaseAdmin
        .from("job_sites").select("id, archived_at, kind").eq("id", data.billableJobSiteId).maybeSingle();
      if (!site || site.archived_at || (site.kind ?? "client") !== "client") {
        throw new Response("Invalid job site", { status: 400 });
      }
      billableJobSiteId = site.id;
    }
    let parsedJobSiteId: string | null = null;
    if (data.parsedJobSiteId) {
      const { data: site } = await supabaseAdmin
        .from("job_sites").select("id").eq("id", data.parsedJobSiteId).maybeSingle();
      if (site) parsedJobSiteId = site.id;
    }
    const materialType =
      data.materialType ?? (billableJobSiteId ? "client_billable" : "regular");
    const { data: inserted, error } = await supabaseAdmin.from("reimbursements").insert({
      worker_id: data.workerId,
      uploaded_by_admin: true,
      week_start: data.weekStart,
      description: data.description,
      amount: data.amount,
      receipt_url: data.receiptUrl ?? null,
      receipt_mime: data.receiptMime ?? null,
      material_type: materialType,
      billable_job_site_id: materialType === "client_billable" ? billableJobSiteId : null,
      parsed_job_site_id: parsedJobSiteId,
    }).select("id").single();
    if (error) throw error;
    if (inserted?.id && data.receiptUrl) {
      try {
        const { runParseForReimbursement } = await import("./receipts.functions");
        await runParseForReimbursement(inserted.id);
      } catch (e) {
        console.error("parse trigger", e);
      }
    }
    await logAudit({
      actor: { kind: "admin" },
      action: "reimbursement_create",
      entityType: "reimbursement",
      entityId: inserted?.id,
      after: { worker_id: data.workerId, week_start: data.weekStart, description: data.description, amount: data.amount, has_receipt: !!data.receiptUrl, billable_job_site_id: billableJobSiteId, parsed_job_site_id: parsedJobSiteId, material_type: materialType },
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
    try {
      const { deleteSheetRowExternal } = await import("./receipts.functions");
      await deleteSheetRowExternal(data.id);
    } catch (e) { console.error("sheet row delete failed", e); }

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

export const workerListActiveSites = createServerFn({ method: "POST" })
  .inputValidator((d) => workerBase.parse(d))
  .handler(async ({ data }) => {
    requireWorker(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("job_sites")
      .select("id, label, kind")
      .is("archived_at", null)
      .order("label", { ascending: true });
    if (error) throw error;
    return { sites: rows ?? [] };
  });

export const workerSubmitReimbursement = createServerFn({ method: "POST" })
  .inputValidator((d) => workerBase.extend({
    description: z.string().trim().max(200).optional(),
    amount: z.number().min(0.01).max(100000),
    receiptUrl: z.string().url().nullable().optional(),
    receiptMime: z.string().max(100).nullable().optional(),
    jobSiteId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data }) => {
    const wid = requireWorker(data.token);
    const weekStart = currentWeekStartISO();
    const { data: inserted, error } = await supabaseAdmin.from("reimbursements").insert({
      worker_id: wid,
      week_start: weekStart,
      description: data.description?.trim() || "Receipt",
      amount: data.amount,
      receipt_url: data.receiptUrl ?? null,
      receipt_mime: data.receiptMime ?? null,
      parsed_job_site_id: data.jobSiteId,
    }).select("id").single();
    if (error) throw error;
    if (inserted?.id && data.receiptUrl) {
      try {
        const { runParseForReimbursement } = await import("./receipts.functions");
        await runParseForReimbursement(inserted.id);
      } catch (e) {
        console.error("parse trigger", e);
      }
    }
    await logAudit({
      actor: { kind: "worker", id: wid },
      action: "reimbursement_create",
      entityType: "reimbursement",
      entityId: inserted?.id,
      after: { week_start: weekStart, description: data.description, amount: data.amount, has_receipt: !!data.receiptUrl, job_site_id: data.jobSiteId ?? null },
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

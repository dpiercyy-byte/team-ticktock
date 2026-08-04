import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";
import { loadWorkspace } from "./workspace.server";

const adminBase = z.object({ token: z.string() });

const DOC_KINDS = [
  "estimate",
  "agreement",
  "drawings",
  "photo",
  "change_order",
  "selections",
  "inspection",
  "warranty",
  "other",
] as const;

const ALLOWED_DOC_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export const getProjectWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const workspace = await loadWorkspace(data.projectId);
    return { ...refreshed, ...workspace };
  });

/* ---------------- Payments ---------------- */

export const saveProjectPayment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        id: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid(),
        description: z.string().trim().min(1).max(160),
        amountExpected: z.number().min(0),
        dueDate: z.string().nullable(),
        amountReceived: z.number().min(0),
        receivedDate: z.string().nullable(),
        method: z.string().trim().max(60).nullable(),
        notes: z.string().trim().max(500).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const row = {
      project_id: data.projectId,
      description: data.description,
      amount_expected_cents: Math.round(data.amountExpected * 100),
      due_date: data.dueDate || null,
      amount_received_cents: Math.round(data.amountReceived * 100),
      received_date: data.receivedDate || null,
      method: data.method || null,
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("project_payments")
        .update(row)
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("project_payments").insert(row);
      if (error) throw error;
    }
    await logAudit({
      actor: { kind: "admin" },
      action: data.id ? "project_payment_update" : "project_payment_create",
      entityType: "project_payment",
      entityId: data.id ?? data.projectId,
      after: row,
    });
    return refreshed;
  });

export const deleteProjectPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("project_payments").delete().eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "project_payment_delete",
      entityType: "project_payment",
      entityId: data.id,
    });
    return refreshed;
  });

/* ---------------- Documents ---------------- */

export const addProjectDocumentLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        projectId: z.string().uuid(),
        kind: z.enum(DOC_KINDS),
        title: z.string().trim().min(1).max(160),
        url: z.string().trim().url().max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("project_documents").insert({
      project_id: data.projectId,
      kind: data.kind,
      title: data.title,
      url: data.url,
      uploaded_by: "admin",
    });
    if (error) throw error;
    return refreshed;
  });

export const uploadProjectDocument = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        projectId: z.string().uuid(),
        kind: z.enum(DOC_KINDS),
        title: z.string().trim().min(1).max(160),
        mime: z.enum(ALLOWED_DOC_MIMES),
        base64: z.string().min(1).max(20_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 12 * 1024 * 1024) throw new Error("File too large (max 12MB)");
    const ext =
      data.mime === "application/pdf"
        ? "pdf"
        : data.mime === "image/png"
          ? "png"
          : data.mime === "image/webp"
            ? "webp"
            : data.mime === "image/heic"
              ? "heic"
              : "jpg";
    const path = `${data.projectId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("project-docs")
      .upload(path, bytes, { contentType: data.mime, upsert: false });
    if (upErr) throw upErr;
    const { error } = await supabaseAdmin.from("project_documents").insert({
      project_id: data.projectId,
      kind: data.kind,
      title: data.title,
      storage_path: path,
      uploaded_by: "admin",
    });
    if (error) throw error;
    return refreshed;
  });

export const deleteProjectDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row } = await supabaseAdmin
      .from("project_documents")
      .select("id, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.storage_path) {
      await supabaseAdmin.storage.from("project-docs").remove([row.storage_path]);
    }
    const { error } = await supabaseAdmin.from("project_documents").delete().eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "project_document_delete",
      entityType: "project_document",
      entityId: data.id,
    });
    return refreshed;
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin, verifyToken } from "./auth.server";
import { parseLedgerJobXlsx } from "./ledger-xlsx";

// Accepts either an admin token or a worker token — Ledger is available to any signed-in user.
function requireAnySession(token: string): "admin" | "worker" {
  const p = verifyToken<{ kind: string }>(token);
  if (p.kind !== "admin" && p.kind !== "worker") {
    throw new Response("Unauthorized", { status: 401 });
  }
  return p.kind as "admin" | "worker";
}

// Only admins may mutate.
function requireAdminOnly(token: string) {
  return requireAdmin(token);
}

const TokenSchema = z.object({ token: z.string() });

export const listLedgerJobs = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    requireAnySession(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("ledger_jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

const JobPatch = z.object({
  lead_source: z.string().optional(),
  payments_received: z.number().optional(),
  finish_date: z.string().nullable().optional(),
  linked_job_site_id: z.string().uuid().nullable().optional(),
});

export const updateLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string(), id: z.string().uuid(), patch: JobPatch }).parse(d))
  .handler(async ({ data }) => {
    requireAdminOnly(data.token);
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.patch)) {
      if (v !== undefined) clean[k] = v;
    }
    if (Object.keys(clean).length === 0) throw new Response("No fields", { status: 400 });
    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs").update(clean).eq("id", data.id).select("*").single();
    if (error) throw error;
    return row;
  });

export const deleteLedgerJob = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    requireAdminOnly(data.token);
    const { error } = await supabaseAdmin.from("ledger_jobs").delete().eq("id", data.id);
    if (error) throw error;
    return { deleted: 1 };
  });

export const resetLedgerJobs = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenSchema.parse(d))
  .handler(async ({ data }) => {
    requireAdminOnly(data.token);
    const { data: rows, error } = await supabaseAdmin.from("ledger_jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    if (error) throw error;
    return { reset: true, deleted: rows?.length ?? 0 };
  });

export const uploadLedgerJobXlsx = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    filename: z.string().min(1).max(200),
    base64: z.string().min(1),
  }).parse(d))
  .handler(async ({ data }) => {
    requireAdminOnly(data.token);
    if (!/\.(xlsx|xlsm)$/i.test(data.filename)) {
      throw new Response("Only .xlsx / .xlsm files are supported", { status: 400 });
    }
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    let parsed;
    try {
      parsed = parseLedgerJobXlsx(bytes, data.filename);
    } catch (e) {
      throw new Response(`Failed to parse xlsx: ${(e as Error).message}`, { status: 400 });
    }

    // Try to auto-link to a Clockwise job_site by address prefix match
    let linked_job_site_id: string | null = null;
    const firstPart = parsed.address.split("(")[0].trim().split(",")[0].trim();
    if (firstPart.length > 4) {
      const { data: sites } = await supabaseAdmin
        .from("job_sites").select("id, label").ilike("label", `%${firstPart}%`).limit(1);
      if (sites && sites.length) linked_job_site_id = sites[0].id;
    }

    // Upsert by address (case-insensitive)
    const { data: existing } = await supabaseAdmin
      .from("ledger_jobs").select("id, linked_job_site_id").ilike("address", parsed.address).maybeSingle();

    const record = { ...parsed, linked_job_site_id: existing?.linked_job_site_id ?? linked_job_site_id };

    if (existing) {
      const { data: row, error } = await supabaseAdmin
        .from("ledger_jobs").update(record).eq("id", existing.id).select("*").single();
      if (error) throw error;
      return { created: false, job: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs").insert(record).select("*").single();
    if (error) throw error;
    return { created: true, job: row };
  });

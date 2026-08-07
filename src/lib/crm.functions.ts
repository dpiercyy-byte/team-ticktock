import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";
import { findOrCreateClient, findOrCreateProperty } from "./ledger-crm.server";
import { LEDGER_SALES_STAGES } from "./ledger-stages";
import { stagesToStatus } from "./ledger-stages";
import { fetchClientProfile, fetchDirectory, fetchPipelineCards, PIPELINE_COLS, rowToCard } from "./crm.server";

export type { PipelineCard, DirectoryClient } from "./crm.server";

const adminBase = z.object({ token: z.string() });

export const listPipeline = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    return { ...refreshed, cards: await fetchPipelineCards() };
  });

export const listTodayItems = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const cards = await fetchPipelineCards();
    const followUps = cards
      .filter((c) => c.nextAction && c.nextActionStatus !== "done")
      .sort(
        (a, b) =>
          new Date(a.nextActionDueAt ?? "2999-01-01").getTime() -
          new Date(b.nextActionDueAt ?? "2999-01-01").getTime(),
      );
    return { ...refreshed, cards, followUps };
  });

export const moveProjectStage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({ id: z.string().uuid(), salesStage: z.enum(LEDGER_SALES_STAGES) }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: prev, error: pErr } = await supabaseAdmin
      .from("ledger_jobs")
      .select("id, sales_stage, delivery_status, status, sales_stage_changed_at")
      .eq("id", data.id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prev) throw new Response("Not found", { status: 404 });

    const before = prev as unknown as Record<string, any>;
    const prevStage = before.sales_stage ?? "New Lead";
    if (prevStage === data.salesStage) {
      const { data: same, error: sErr } = await supabaseAdmin
        .from("ledger_jobs")
        .select(PIPELINE_COLS)
        .eq("id", data.id)
        .single();
      if (sErr) throw sErr;
      return { ...refreshed, card: rowToCard(same as unknown as Record<string, any>) };
    }

    const delivery = before.delivery_status ?? "Not Started";
    const changedAt = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs")
      .update({
        sales_stage: data.salesStage,
        sales_stage_changed_at: changedAt,
        status: stagesToStatus(data.salesStage, delivery),
        updated_at: changedAt,
      } as never)
      .eq("id", data.id)
      .select(PIPELINE_COLS)
      .single();
    if (error) throw error;

    await supabaseAdmin.from("ledger_job_events").insert({
      job_id: data.id,
      kind: "stage",
      title: `Stage moved to ${data.salesStage}`,
      detail: `From ${prevStage}`,
      occurred_at: changedAt,
    });
    await logAudit({
      actor: { kind: "admin" },
      action: "project.stage_change",
      entityType: "ledger_job",
      entityId: data.id,
      before: { sales_stage: prevStage, status: before.status },
      after: { sales_stage: data.salesStage, status: stagesToStatus(data.salesStage, delivery) },
    });

    return { ...refreshed, card: rowToCard(row as unknown as Record<string, any>) };
  });

export const setNextAction = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        id: z.string().uuid(),
        nextAction: z.string().trim().min(1).max(300),
        owner: z.string().trim().max(120).nullable().optional(),
        dueAt: z.string().trim().max(40).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const dueAt = data.dueAt ? new Date(data.dueAt).toISOString() : null;
    const now = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs")
      .update({
        next_action: data.nextAction,
        next_action_owner: data.owner ?? null,
        next_action_due_at: dueAt,
        next_action_status: "open",
        updated_at: now,
      } as never)
      .eq("id", data.id)
      .select(PIPELINE_COLS)
      .single();
    if (error) throw error;
    await supabaseAdmin.from("ledger_job_events").insert({
      job_id: data.id,
      kind: "note",
      title: `Next action: ${data.nextAction}`,
      detail: dueAt ? `Due ${new Date(dueAt).toLocaleDateString()}` : null,
      occurred_at: now,
    });
    return { ...refreshed, card: rowToCard(row as unknown as Record<string, any>) };
  });

export const completeNextAction = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const now = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("ledger_jobs")
      .update({ next_action_status: "done", updated_at: now } as never)
      .eq("id", data.id)
      .select(PIPELINE_COLS)
      .single();
    if (error) throw error;
    const card = rowToCard(row as unknown as Record<string, any>);
    await supabaseAdmin.from("ledger_job_events").insert({
      job_id: data.id,
      kind: "note",
      title: `Follow-up completed${card.nextAction ? `: ${card.nextAction}` : ""}`,
      occurred_at: now,
    });
    return { ...refreshed, card };
  });

export const createLead = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        clientName: z.string().trim().min(1).max(120),
        clientPhone: z.string().trim().max(60).nullable().optional(),
        clientEmail: z.string().trim().max(200).nullable().optional(),
        preferredContactMethod: z.string().trim().max(60).nullable().optional(),
        address: z.string().trim().min(1).max(300),
        projectType: z.string().trim().min(1).max(60),
        leadSource: z.string().trim().max(120).nullable().optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
        assignedOwner: z.string().trim().max(120).nullable().optional(),
        nextAction: z.string().trim().max(300).nullable().optional(),
        nextActionDueAt: z.string().trim().max(40).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const clientId = await findOrCreateClient({
      name: data.clientName,
      email: data.clientEmail,
      phone: data.clientPhone,
      leadSource: data.leadSource,
      preferredContactMethod: data.preferredContactMethod,
    });
    const propertyId = await findOrCreateProperty(clientId, { address: data.address });

    const lastName = data.clientName.trim().split(/\s+/).slice(-1)[0];
    const now = new Date().toISOString();
    const dueAt = data.nextActionDueAt ? new Date(data.nextActionDueAt).toISOString() : null;

    const { data: created, error } = await supabaseAdmin
      .from("ledger_jobs")
      .insert({
        name: `${lastName} ${data.projectType}`,
        client_name: data.clientName,
        client_email: data.clientEmail ?? null,
        client_phone: data.clientPhone ?? null,
        address: data.address,
        client_id: clientId,
        property_id: propertyId,
        project_type: data.projectType,
        trades: [],
        status: "Lead",
        sales_stage: "New Lead",
        delivery_status: "Not Started",
        sales_stage_changed_at: now,
        assigned_owner: data.assignedOwner ?? null,
        next_action: data.nextAction ?? null,
        next_action_owner: data.assignedOwner ?? null,
        next_action_due_at: dueAt,
        next_action_status: "open",
      } as never)
      .select(PIPELINE_COLS)
      .single();
    if (error) throw error;

    const events: Array<Record<string, unknown>> = [
      { job_id: created.id, kind: "created", title: "Lead created", occurred_at: now },
    ];
    if (data.notes) {
      events.push({ job_id: created.id, kind: "note", title: data.notes, occurred_at: now });
    }
    if (data.nextAction) {
      events.push({
        job_id: created.id,
        kind: "note",
        title: `Next action: ${data.nextAction}`,
        occurred_at: now,
      });
    }
    await supabaseAdmin.from("ledger_job_events").insert(events as never);
    await logAudit({
      actor: { kind: "admin" },
      action: "lead.create",
      entityType: "ledger_job",
      entityId: created.id,
      after: { clientId, propertyId, salesStage: "New Lead" },
    });

    return {
      ...refreshed,
      clientId,
      propertyId,
      card: rowToCard(created as unknown as Record<string, any>),
    };
  });

export const listClientsDirectory = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        q: z.string().trim().max(120).optional(),
        filter: z.enum(["active", "archived"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const clients = await fetchDirectory({ q: data.q ?? "", filter: data.filter ?? "active" });
    return { ...refreshed, clients };
  });

export const getClientProfile = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    return { ...refreshed, ...(await fetchClientProfile(data.id)) };
  });

export const setClientArchived = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("clients")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id)
      .select("id, name, archived_at")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Response("Not found", { status: 404 });
    await logAudit({
      action: data.archived ? "client.archive" : "client.restore",
      entityType: "client",
      entityId: data.id,
      after: row as unknown as Record<string, any>,
    });
    return { ...refreshed, client: row as unknown as Record<string, any> };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: before, error: bErr } = await supabaseAdmin
      .from("clients")
      .select("id, name, email, phone")
      .eq("id", data.id)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!before) throw new Response("Not found", { status: 404 });

    const { count, error: cErr } = await supabaseAdmin
      .from("ledger_jobs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", data.id);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      throw new Response(
        `This person still has ${count} project${count === 1 ? "" : "s"}. Archive them instead, or move/delete the projects first.`,
        { status: 409 },
      );
    }

    const { error: pErr } = await supabaseAdmin.from("properties").delete().eq("client_id", data.id);
    if (pErr) throw pErr;
    const { error } = await supabaseAdmin.from("clients").delete().eq("id", data.id);
    if (error) throw error;

    await logAudit({
      action: "client.delete",
      entityType: "client",
      entityId: data.id,
      before: before as unknown as Record<string, any>,
    });
    return { ...refreshed, deleted: true };
  });

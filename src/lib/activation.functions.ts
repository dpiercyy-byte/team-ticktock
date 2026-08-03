import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";
import { activateProject, fetchActivationState, fetchProjectCrew } from "./activation.server";
import { geocodeAddress } from "./geocode.server";

const adminBase = z.object({ token: z.string() });

export const getActivationPreview = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const state = await fetchActivationState(data.projectId);
    const crew = await fetchProjectCrew(data.projectId);
    return { ...refreshed, ...state, crew };
  });

export const geocodeForActivation = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({ address: z.string().trim().min(3).max(300) }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const geo = await geocodeAddress(data.address);
    return { ...refreshed, ...geo };
  });

export const activateProjectFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      projectId: z.string().uuid(),
      clientId: z.string().uuid(),
      propertyId: z.string().uuid().nullable(),
      contractValue: z.number().min(0),
      address: z.string().trim().min(3).max(300),
      lat: z.number(),
      lng: z.number(),
      radiusM: z.number().int().min(25).max(2000),
      expectedStartDate: z.string().nullable(),
      label: z.string().trim().max(80).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const result = await activateProject({
      projectId: data.projectId,
      clientId: data.clientId,
      propertyId: data.propertyId,
      contractValue: data.contractValue,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      radiusM: data.radiusM,
      expectedStartDate: data.expectedStartDate,
      label: data.label ?? null,
    });
    return { ...refreshed, ...result };
  });

export const listProjectCrew = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    return { ...refreshed, crew: await fetchProjectCrew(data.projectId) };
  });

export const assignProjectCrew = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({
      projectId: z.string().uuid(),
      workerId: z.string().uuid(),
      role: z.string().trim().max(60).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { data: existing } = await supabaseAdmin
      .from("project_crew")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("worker_id", data.workerId)
      .is("removed_at", null)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("project_crew")
        .update({ role: data.role ?? null } as never)
        .eq("id", existing.id);
    } else {
      const { error } = await supabaseAdmin.from("project_crew").insert({
        project_id: data.projectId,
        worker_id: data.workerId,
        role: data.role ?? null,
      } as never);
      if (error) throw error;
      await logAudit({
        actor: { kind: "admin" },
        action: "project_crew_assign",
        entityType: "ledger_job",
        entityId: data.projectId,
        after: { worker_id: data.workerId, role: data.role ?? null },
      });
    }
    return { ...refreshed, crew: await fetchProjectCrew(data.projectId) };
  });

export const removeProjectCrew = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase.extend({ projectId: z.string().uuid(), workerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("project_crew")
      .update({ removed_at: new Date().toISOString() } as never)
      .eq("project_id", data.projectId)
      .eq("worker_id", data.workerId)
      .is("removed_at", null);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "project_crew_remove",
      entityType: "ledger_job",
      entityId: data.projectId,
      before: { worker_id: data.workerId },
    });
    return { ...refreshed, crew: await fetchProjectCrew(data.projectId) };
  });

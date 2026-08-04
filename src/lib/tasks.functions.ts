import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "./db.server";
import { requireAdmin } from "./auth.server";
import { logAudit } from "./audit.server";
import { fetchCalendarRecords, fetchOverdueTasks, fetchProjectTasks } from "./tasks.server";
import { isMeaningfulCompletion } from "./task-math";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEMPLATE_KEYS,
  getTemplate,
  planTemplateTasks,
} from "./task-templates";

const adminBase = z.object({ token: z.string() });

export const listProjectTasks = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const tasks = await fetchProjectTasks(data.projectId);
    return { ...refreshed, tasks };
  });

export const listOverdueTasks = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const tasks = await fetchOverdueTasks();
    return { ...refreshed, tasks };
  });

export const listCalendarRecords = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const records = await fetchCalendarRecords();
    return { ...refreshed, records };
  });

export const saveProjectTask = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        id: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid(),
        title: z.string().trim().min(1).max(180),
        description: z.string().trim().max(2000).nullable().optional(),
        assignedTo: z.string().trim().max(120).nullable().optional(),
        dueAt: z.string().nullable().optional(),
        status: z.enum(TASK_STATUSES),
        priority: z.enum(TASK_PRIORITIES),
        trade: z.string().trim().max(80).nullable().optional(),
        taskType: z.string().trim().max(40).default("general"),
        dependencyTaskId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const completing = data.status === "Completed";

    let previous: Record<string, any> | null = null;
    if (data.id) {
      const { data: prev } = await supabaseAdmin
        .from("project_tasks")
        .select("id, status, priority, task_type, template_key, title, completed_at")
        .eq("id", data.id)
        .maybeSingle();
      previous = (prev as Record<string, any>) ?? null;
    }

    const row = {
      project_id: data.projectId,
      title: data.title,
      description: data.description || null,
      assigned_to: data.assignedTo || null,
      due_at: data.dueAt || null,
      status: data.status,
      priority: data.priority,
      trade: data.trade || null,
      task_type: data.taskType || "general",
      dependency_task_id: data.dependencyTaskId || null,
      completed_at: completing ? (previous?.completed_at ?? new Date().toISOString()) : null,
    };

    let taskId = data.id ?? null;
    if (data.id) {
      const { error } = await supabaseAdmin.from("project_tasks").update(row).eq("id", data.id);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("project_tasks")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      taskId = (inserted as { id: string }).id;
    }

    const newlyCompleted = completing && previous?.status !== "Completed";
    if (
      newlyCompleted &&
      isMeaningfulCompletion({
        priority: data.priority,
        templateKey: previous?.template_key ?? null,
        taskType: row.task_type,
      })
    ) {
      await supabaseAdmin.from("ledger_job_events").insert({
        job_id: data.projectId,
        kind: "task",
        title: `Task completed — ${data.title}`,
        detail: data.assignedTo ? `Completed by ${data.assignedTo}` : null,
      });
    }

    await logAudit({
      actor: { kind: "admin" },
      action: data.id ? "project_task_update" : "project_task_create",
      entityType: "project_task",
      entityId: taskId,
      before: previous,
      after: row,
    });

    return { ...refreshed, id: taskId };
  });

export const deleteProjectTask = createServerFn({ method: "POST" })
  .inputValidator((d) => adminBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("project_tasks").delete().eq("id", data.id);
    if (error) throw error;
    await logAudit({
      actor: { kind: "admin" },
      action: "project_task_delete",
      entityType: "project_task",
      entityId: data.id,
    });
    return refreshed;
  });

export const applyChecklistTemplate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    adminBase
      .extend({
        projectId: z.string().uuid(),
        templateKey: z.enum(TEMPLATE_KEYS),
        assignedTo: z.string().trim().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const refreshed = requireAdmin(data.token);
    const template = getTemplate(data.templateKey);
    if (!template) throw new Error("Unknown template");

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("project_tasks")
      .select("template_item_key")
      .eq("project_id", data.projectId)
      .eq("template_key", data.templateKey);
    if (exErr) throw exErr;

    const have = ((existing ?? []) as Array<{ template_item_key: string | null }>)
      .map((r) => r.template_item_key)
      .filter(Boolean) as string[];

    const planned = planTemplateTasks(template, have, new Date().toISOString());
    if (planned.length > 0) {
      const { error } = await supabaseAdmin.from("project_tasks").insert(
        planned.map((p) => ({
          project_id: data.projectId,
          title: p.title,
          task_type: p.taskType,
          priority: p.priority,
          due_at: p.dueAt,
          status: "Not Started",
          assigned_to: data.assignedTo || null,
          template_key: p.templateKey,
          template_item_key: p.templateItemKey,
          sort_order: p.sortOrder,
        })),
      );
      if (error) throw error;

      await supabaseAdmin.from("ledger_job_events").insert({
        job_id: data.projectId,
        kind: "task",
        title: `${template.label} generated`,
        detail: `${planned.length} task${planned.length === 1 ? "" : "s"} added`,
      });
    }

    await logAudit({
      actor: { kind: "admin" },
      action: "project_checklist_apply",
      entityType: "project",
      entityId: data.projectId,
      metadata: { templateKey: data.templateKey, added: planned.length },
    });

    return { ...refreshed, added: planned.length };
  });

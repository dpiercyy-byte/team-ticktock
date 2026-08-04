// Task reads. Admin-only: every caller goes through tasks.functions.ts.
import { supabaseAdmin } from "./db.server";
import { toTaskRow, type RawTask, type TaskRow } from "./task-math";
import {
  buildCalendarRecords,
  type CalPayment,
  type CalProject,
  type CalTask,
  type CalendarRecord,
} from "./calendar-math";

export const TASK_COLS =
  "id, project_id, title, description, assigned_to, due_at, completed_at, status, priority, trade, task_type, dependency_task_id, template_key, template_item_key, sort_order, created_at, updated_at";

export async function fetchProjectTasks(projectId: string): Promise<TaskRow[]> {
  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .select(TASK_COLS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawTask[]).map((r) => toTaskRow(r));
}

export type OverdueTask = TaskRow & { projectName: string; projectAddress: string | null };

export async function fetchOverdueTasks(limit = 20): Promise<OverdueTask[]> {
  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .select(TASK_COLS)
    .lt("due_at", new Date().toISOString())
    .not("due_at", "is", null)
    .in("status", ["Not Started", "In Progress", "Blocked"])
    .order("due_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as RawTask[]).map((r) => toTaskRow(r));
  if (rows.length === 0) return [];

  const { data: jobs, error: jErr } = await supabaseAdmin
    .from("ledger_jobs")
    .select("id, name, address")
    .in("id", Array.from(new Set(rows.map((r) => r.projectId))));
  if (jErr) throw jErr;
  const byId = new Map(
    ((jobs ?? []) as Array<Record<string, any>>).map((j) => [j.id as string, j] as const),
  );
  return rows.map((r) => ({
    ...r,
    projectName: byId.get(r.projectId)?.name ?? "Project",
    projectAddress: byId.get(r.projectId)?.address ?? null,
  }));
}

export async function fetchCalendarRecords(): Promise<CalendarRecord[]> {
  const { data: jobs, error: jErr } = await supabaseAdmin
    .from("ledger_jobs")
    .select(
      "id, name, address, status, sales_stage, scheduled_for, expected_start_date, actual_start_date, expected_completion_date, actual_completion_date, archived_at",
    )
    .is("archived_at", null);
  if (jErr) throw jErr;

  const projects: CalProject[] = ((jobs ?? []) as Array<Record<string, any>>).map((j) => ({
    id: j.id,
    name: j.name,
    address: j.address ?? null,
    status: j.status,
    salesStage: j.sales_stage ?? null,
    scheduledFor: j.scheduled_for ?? null,
    expectedStartDate: j.expected_start_date ?? null,
    actualStartDate: j.actual_start_date ?? null,
    expectedCompletionDate: j.expected_completion_date ?? null,
    actualCompletionDate: j.actual_completion_date ?? null,
  }));

  const ids = projects.map((p) => p.id);
  let tasks: CalTask[] = [];
  let payments: CalPayment[] = [];

  if (ids.length > 0) {
    const { data: tRows, error: tErr } = await supabaseAdmin
      .from("project_tasks")
      .select("id, project_id, title, due_at, status, task_type, assigned_to")
      .in("project_id", ids)
      .not("due_at", "is", null);
    if (tErr) throw tErr;
    tasks = ((tRows ?? []) as Array<Record<string, any>>).map((t) => ({
      id: t.id,
      projectId: t.project_id,
      title: t.title,
      dueAt: t.due_at ?? null,
      status: t.status,
      taskType: t.task_type,
      assignedTo: t.assigned_to ?? null,
    }));

    const { data: pRows, error: pErr } = await supabaseAdmin
      .from("project_payments")
      .select("id, project_id, description, due_date, amount_expected_cents, amount_received_cents")
      .in("project_id", ids)
      .not("due_date", "is", null);
    if (pErr) throw pErr;
    payments = ((pRows ?? []) as Array<Record<string, any>>).map((p) => ({
      id: p.id,
      projectId: p.project_id,
      description: p.description,
      dueDate: p.due_date ?? null,
      amountExpected: Number(p.amount_expected_cents ?? 0) / 100,
      amountReceived: Number(p.amount_received_cents ?? 0) / 100,
    }));
  }

  return buildCalendarRecords({ projects, tasks, payments });
}

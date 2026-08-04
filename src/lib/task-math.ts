// Pure task derivation: shaping rows, overdue logic, ordering, grouping.
import type { TaskPriority, TaskStatus } from "./task-templates";

export type RawTask = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  status: string;
  priority: string;
  trade: string | null;
  task_type: string;
  dependency_task_id: string | null;
  template_key: string | null;
  template_item_key: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  dueAt: string | null;
  completedAt: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  trade: string | null;
  taskType: string;
  dependencyTaskId: string | null;
  templateKey: string | null;
  templateItemKey: string | null;
  sortOrder: number;
  overdue: boolean;
  daysOverdue: number;
  createdAt: string;
  updatedAt: string;
};

const DAY = 86_400_000;

export const isClosed = (status: string) => status === "Completed" || status === "Cancelled";

export function isOverdue(t: { dueAt: string | null; status: string }, now = Date.now()): boolean {
  if (!t.dueAt || isClosed(t.status)) return false;
  return new Date(t.dueAt).getTime() < now;
}

export function daysOverdue(t: { dueAt: string | null; status: string }, now = Date.now()): number {
  if (!isOverdue(t, now)) return 0;
  return Math.floor((now - new Date(t.dueAt as string).getTime()) / DAY);
}

export function toTaskRow(r: RawTask, now = Date.now()): TaskRow {
  const base = { dueAt: r.due_at ?? null, status: r.status };
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description ?? null,
    assignedTo: r.assigned_to ?? null,
    dueAt: r.due_at ?? null,
    completedAt: r.completed_at ?? null,
    status: r.status as TaskStatus,
    priority: r.priority as TaskPriority,
    trade: r.trade ?? null,
    taskType: r.task_type,
    dependencyTaskId: r.dependency_task_id ?? null,
    templateKey: r.template_key ?? null,
    templateItemKey: r.template_item_key ?? null,
    sortOrder: r.sort_order ?? 0,
    overdue: isOverdue(base, now),
    daysOverdue: daysOverdue(base, now),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };

/** Due date first (undated last), then priority, then template order. */
export function sortTasks(rows: TaskRow[]): TaskRow[] {
  return [...rows].sort((a, b) => {
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    const ap = PRIORITY_RANK[a.priority] ?? 9;
    const bp = PRIORITY_RANK[b.priority] ?? 9;
    if (ap !== bp) return ap - bp;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}

export type TaskGroups = { overdue: TaskRow[]; open: TaskRow[]; done: TaskRow[] };

export function groupTasks(rows: TaskRow[]): TaskGroups {
  const sorted = sortTasks(rows);
  return {
    overdue: sorted.filter((t) => t.overdue),
    open: sorted.filter((t) => !t.overdue && !isClosed(t.status)),
    done: sorted
      .filter((t) => isClosed(t.status))
      .sort(
        (a, b) =>
          +new Date(b.completedAt ?? b.updatedAt) - +new Date(a.completedAt ?? a.updatedAt),
      ),
  };
}

export function taskTotals(rows: TaskRow[]) {
  return {
    total: rows.length,
    open: rows.filter((t) => !isClosed(t.status)).length,
    overdue: rows.filter((t) => t.overdue).length,
    completed: rows.filter((t) => t.status === "Completed").length,
  };
}

/** Completing these is worth a project timeline event. */
export function isMeaningfulCompletion(t: {
  priority: string;
  templateKey: string | null;
  taskType: string;
}): boolean {
  if (t.templateKey) return true;
  if (t.priority === "High" || t.priority === "Urgent") return true;
  return ["inspection", "payment", "site_visit", "warranty", "closeout"].includes(t.taskType);
}

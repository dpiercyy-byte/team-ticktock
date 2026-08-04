// Pure calendar derivation. Turns real project records into dated entries.

export const CALENDAR_TYPES = [
  "site_visit",
  "start",
  "completion",
  "task",
  "payment",
  "inspection",
  "warranty",
] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];

export const CALENDAR_TYPE_LABEL: Record<CalendarType, string> = {
  site_visit: "Site visits",
  start: "Start dates",
  completion: "Completion",
  task: "Tasks",
  payment: "Payments",
  inspection: "Inspections",
  warranty: "Warranty",
};

export type CalendarRecord = {
  id: string;
  type: CalendarType;
  /** Local calendar day key, YYYY-MM-DD */
  day: string;
  date: string; // original ISO
  title: string;
  subtitle: string | null;
  projectId: string;
  projectName: string;
  done: boolean;
};

export type CalProject = {
  id: string;
  name: string;
  address: string | null;
  status: string;
  salesStage: string | null;
  scheduledFor: string | null;
  expectedStartDate: string | null;
  actualStartDate: string | null;
  expectedCompletionDate: string | null;
  actualCompletionDate: string | null;
};

export type CalTask = {
  id: string;
  projectId: string;
  title: string;
  dueAt: string | null;
  status: string;
  taskType: string;
  assignedTo: string | null;
};

export type CalPayment = {
  id: string;
  projectId: string;
  description: string;
  dueDate: string | null;
  amountExpected: number;
  amountReceived: number;
};

export function dayKey(value: string): string {
  // Date-only strings stay as-is; timestamps become their local day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function buildCalendarRecords(input: {
  projects: CalProject[];
  tasks: CalTask[];
  payments: CalPayment[];
}): CalendarRecord[] {
  const out: CalendarRecord[] = [];
  const nameById = new Map(input.projects.map((p) => [p.id, p.name] as const));

  for (const p of input.projects) {
    if (p.scheduledFor) {
      out.push({
        id: `visit:${p.id}`,
        type: "site_visit",
        day: dayKey(p.scheduledFor),
        date: p.scheduledFor,
        title: "Site visit",
        subtitle: p.address,
        projectId: p.id,
        projectName: p.name,
        done: false,
      });
    }
    const start = p.actualStartDate ?? p.expectedStartDate;
    if (start) {
      out.push({
        id: `start:${p.id}`,
        type: "start",
        day: dayKey(start),
        date: start,
        title: p.actualStartDate ? "Started" : "Expected start",
        subtitle: p.address,
        projectId: p.id,
        projectName: p.name,
        done: Boolean(p.actualStartDate),
      });
    }
    const done = p.actualCompletionDate ?? p.expectedCompletionDate;
    if (done) {
      out.push({
        id: `completion:${p.id}`,
        type: "completion",
        day: dayKey(done),
        date: done,
        title: p.actualCompletionDate ? "Completed" : "Expected completion",
        subtitle: p.address,
        projectId: p.id,
        projectName: p.name,
        done: Boolean(p.actualCompletionDate),
      });
    }
  }

  for (const t of input.tasks) {
    if (!t.dueAt) continue;
    const type: CalendarType =
      t.taskType === "inspection" ? "inspection" : t.taskType === "warranty" ? "warranty" : "task";
    out.push({
      id: `task:${t.id}`,
      type,
      day: dayKey(t.dueAt),
      date: t.dueAt,
      title: t.title,
      subtitle: t.assignedTo,
      projectId: t.projectId,
      projectName: nameById.get(t.projectId) ?? "Project",
      done: t.status === "Completed" || t.status === "Cancelled",
    });
  }

  for (const p of input.payments) {
    if (!p.dueDate) continue;
    out.push({
      id: `payment:${p.id}`,
      type: "payment",
      day: dayKey(p.dueDate),
      date: p.dueDate,
      title: p.description,
      subtitle: `$${p.amountExpected.toFixed(2)} due`,
      projectId: p.projectId,
      projectName: nameById.get(p.projectId) ?? "Project",
      done: p.amountReceived >= p.amountExpected && p.amountExpected > 0,
    });
  }

  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.title.localeCompare(b.title)));
}

export function groupByDay(records: CalendarRecord[]): Map<string, CalendarRecord[]> {
  const map = new Map<string, CalendarRecord[]>();
  for (const r of records) {
    const list = map.get(r.day) ?? [];
    list.push(r);
    map.set(r.day, list);
  }
  return map;
}

export function upcomingRecords(
  records: CalendarRecord[],
  fromDay: string,
  limit = 8,
): CalendarRecord[] {
  return records.filter((r) => r.day >= fromDay && !r.done).slice(0, limit);
}

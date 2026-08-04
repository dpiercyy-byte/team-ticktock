import { describe, expect, it } from "vitest";
import {
  daysOverdue,
  groupTasks,
  isMeaningfulCompletion,
  isOverdue,
  sortTasks,
  taskTotals,
  toTaskRow,
  type RawTask,
} from "@/lib/task-math";
import {
  ACCEPTED_JOB_TEMPLATE,
  CLOSEOUT_TEMPLATE,
  getTemplate,
  planTemplateTasks,
} from "@/lib/task-templates";
import { buildCalendarRecords, dayKey, groupByDay, upcomingRecords } from "@/lib/calendar-math";

const NOW = new Date("2026-08-10T18:00:00Z").getTime();

const raw = (over: Partial<RawTask>): RawTask => ({
  id: "t1",
  project_id: "p1",
  title: "Confirm deposit",
  description: null,
  assigned_to: "Ana",
  due_at: "2026-08-05T17:00:00Z",
  completed_at: null,
  status: "Not Started",
  priority: "Normal",
  trade: null,
  task_type: "general",
  dependency_task_id: null,
  template_key: null,
  template_item_key: null,
  sort_order: 0,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  ...over,
});

describe("task rows", () => {
  it("flags a past-due open task overdue with whole days", () => {
    const row = toTaskRow(raw({}), NOW);
    expect(row.overdue).toBe(true);
    expect(row.daysOverdue).toBe(5);
  });

  it("never marks completed or cancelled tasks overdue", () => {
    expect(isOverdue({ dueAt: "2026-08-01T00:00:00Z", status: "Completed" }, NOW)).toBe(false);
    expect(isOverdue({ dueAt: "2026-08-01T00:00:00Z", status: "Cancelled" }, NOW)).toBe(false);
    expect(daysOverdue({ dueAt: "2026-08-01T00:00:00Z", status: "Completed" }, NOW)).toBe(0);
  });

  it("never marks an undated task overdue", () => {
    expect(isOverdue({ dueAt: null, status: "Not Started" }, NOW)).toBe(false);
  });
});

describe("ordering and grouping", () => {
  it("orders by due date, then priority, then template order", () => {
    const rows = [
      toTaskRow(raw({ id: "c", due_at: null, title: "Someday" }), NOW),
      toTaskRow(raw({ id: "b", due_at: "2026-09-01T00:00:00Z", priority: "Low" }), NOW),
      toTaskRow(raw({ id: "a", due_at: "2026-09-01T00:00:00Z", priority: "Urgent" }), NOW),
    ];
    expect(sortTasks(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("splits overdue, open and done", () => {
    const rows = [
      toTaskRow(raw({ id: "late" }), NOW),
      toTaskRow(raw({ id: "open", due_at: "2026-09-01T00:00:00Z" }), NOW),
      toTaskRow(raw({ id: "done", status: "Completed", completed_at: "2026-08-09T00:00:00Z" }), NOW),
    ];
    const g = groupTasks(rows);
    expect(g.overdue.map((t) => t.id)).toEqual(["late"]);
    expect(g.open.map((t) => t.id)).toEqual(["open"]);
    expect(g.done.map((t) => t.id)).toEqual(["done"]);
    expect(taskTotals(rows)).toEqual({ total: 3, open: 2, overdue: 1, completed: 1 });
  });
});

describe("meaningful completion", () => {
  it("counts template, high-priority and milestone task types", () => {
    expect(isMeaningfulCompletion({ priority: "Low", templateKey: "closeout", taskType: "general" })).toBe(true);
    expect(isMeaningfulCompletion({ priority: "High", templateKey: null, taskType: "general" })).toBe(true);
    expect(isMeaningfulCompletion({ priority: "Low", templateKey: null, taskType: "inspection" })).toBe(true);
  });
  it("ignores ordinary low-priority chores", () => {
    expect(isMeaningfulCompletion({ priority: "Normal", templateKey: null, taskType: "general" })).toBe(false);
  });
});

describe("checklist templates", () => {
  it("ships the accepted-job and closeout checklists", () => {
    expect(ACCEPTED_JOB_TEMPLATE.items).toHaveLength(10);
    expect(CLOSEOUT_TEMPLATE.items).toHaveLength(8);
    expect(getTemplate("nope")).toBeNull();
  });

  it("plans every item on first apply with offset due dates", () => {
    const planned = planTemplateTasks(ACCEPTED_JOB_TEMPLATE, [], "2026-08-10T00:00:00.000Z");
    expect(planned).toHaveLength(10);
    expect(planned[0]?.dueAt?.slice(0, 10)).toBe("2026-08-11");
    expect(planned[0]?.sortOrder).toBe(0);
  });

  it("tops up only missing items instead of duplicating", () => {
    const planned = planTemplateTasks(
      CLOSEOUT_TEMPLATE,
      CLOSEOUT_TEMPLATE.items.slice(0, 6).map((i) => i.key),
      "2026-08-10T00:00:00.000Z",
    );
    expect(planned.map((p) => p.templateItemKey)).toEqual(["client_review", "warranty_followup"]);
  });
});

describe("calendar records", () => {
  const project = {
    id: "p1",
    name: "16 Ostick",
    address: "16 Ostick Ave",
    status: "Active",
    salesStage: null,
    scheduledFor: "2026-08-12T15:00:00Z",
    expectedStartDate: "2026-08-14",
    actualStartDate: null,
    expectedCompletionDate: "2026-09-30",
    actualCompletionDate: null,
  };

  it("derives visits, start and completion from the project", () => {
    const recs = buildCalendarRecords({ projects: [project], tasks: [], payments: [] });
    expect(recs.map((r) => r.type)).toEqual(["site_visit", "start", "completion"]);
    expect(recs[1]).toMatchObject({ title: "Expected start", day: "2026-08-14", done: false });
  });

  it("maps inspection and warranty tasks to their own types and skips undated ones", () => {
    const recs = buildCalendarRecords({
      projects: [project],
      tasks: [
        { id: "t1", projectId: "p1", title: "Framing inspection", dueAt: "2026-08-20T17:00:00Z", status: "Not Started", taskType: "inspection", assignedTo: "Ana" },
        { id: "t2", projectId: "p1", title: "No date", dueAt: null, status: "Not Started", taskType: "general", assignedTo: null },
      ],
      payments: [],
    });
    const tasks = recs.filter((r) => r.id.startsWith("task:"));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: "inspection", projectName: "16 Ostick" });
  });

  it("marks a fully received payment done and groups by day", () => {
    const recs = buildCalendarRecords({
      projects: [project],
      tasks: [],
      payments: [
        { id: "pay1", projectId: "p1", description: "Deposit", dueDate: "2026-08-14", amountExpected: 1000, amountReceived: 1000 },
      ],
    });
    const pay = recs.find((r) => r.id === "payment:pay1");
    expect(pay?.done).toBe(true);
    expect(groupByDay(recs).get("2026-08-14")).toHaveLength(2);
  });

  it("lists only future, unfinished records as upcoming", () => {
    const recs = buildCalendarRecords({ projects: [project], tasks: [], payments: [] });
    expect(upcomingRecords(recs, "2026-08-13").map((r) => r.type)).toEqual(["start", "completion"]);
  });

  it("keeps date-only strings on their own calendar day", () => {
    expect(dayKey("2026-08-14")).toBe("2026-08-14");
  });
});

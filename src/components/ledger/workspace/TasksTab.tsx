import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getAdminToken } from "@/lib/session";
import { projectTasksQuery } from "@/lib/tasks-client";
import {
  applyChecklistTemplate,
  deleteProjectTask,
  saveProjectTask,
} from "@/lib/tasks.functions";
import { groupTasks, taskTotals, type TaskRow } from "@/lib/task-math";
import {
  ACCEPTED_JOB_TEMPLATE,
  CLOSEOUT_TEMPLATE,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from "@/lib/task-templates";
import { Empty, SectionTitle, fmtDate } from "./ui";

type Draft = {
  id: string | null;
  title: string;
  description: string;
  assignedTo: string;
  dueAt: string;
  status: (typeof TASK_STATUSES)[number];
  priority: (typeof TASK_PRIORITIES)[number];
  trade: string;
  taskType: string;
};

const emptyDraft: Draft = {
  id: null,
  title: "",
  description: "",
  assignedTo: "",
  dueAt: "",
  status: "Not Started",
  priority: "Normal",
  trade: "",
  taskType: "general",
};

const toInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export function TasksTab({
  projectId,
  crew,
  defaultOwner,
}: {
  projectId: string;
  crew: string[];
  defaultOwner: string | null;
}) {
  const { data: tasks } = useSuspenseQuery(projectTasksQuery(projectId));
  const qc = useQueryClient();
  const save = useServerFn(saveProjectTask);
  const remove = useServerFn(deleteProjectTask);
  const applyTemplate = useServerFn(applyChecklistTemplate);
  const [draft, setDraft] = useState<Draft | null>(null);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["ledger", "tasks"] });
    await qc.invalidateQueries({ queryKey: ["ledger", "workspace", projectId] });
    await qc.invalidateQueries({ queryKey: ["ledger", "jobs", projectId] });
    await qc.invalidateQueries({ queryKey: ["ledger", "calendar"] });
  };

  const token = () => {
    const t = getAdminToken();
    if (!t) throw new Error("Not signed in");
    return t;
  };

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) =>
      save({
        data: {
          token: token(),
          id: d.id,
          projectId,
          title: d.title.trim(),
          description: d.description.trim() || null,
          assignedTo: d.assignedTo.trim() || null,
          dueAt: d.dueAt ? new Date(`${d.dueAt}T17:00:00`).toISOString() : null,
          status: d.status,
          priority: d.priority,
          trade: d.trade.trim() || null,
          taskType: d.taskType,
        },
      }),
    onSuccess: async () => {
      setDraft(null);
      await invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (t: TaskRow) =>
      save({
        data: {
          token: token(),
          id: t.id,
          projectId,
          title: t.title,
          description: t.description,
          assignedTo: t.assignedTo,
          dueAt: t.dueAt,
          status: t.status === "Completed" ? "Not Started" : "Completed",
          priority: t.priority,
          trade: t.trade,
          taskType: t.taskType,
        },
      }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { token: token(), id } }),
    onSuccess: invalidate,
  });

  const templateMutation = useMutation({
    mutationFn: async (templateKey: "accepted_job" | "closeout") =>
      applyTemplate({
        data: { token: token(), projectId, templateKey, assignedTo: defaultOwner || null },
      }),
    onSuccess: invalidate,
  });

  const totals = taskTotals(tasks);
  const groups = groupTasks(tasks);

  return (
    <div>
      <section className="l-card p-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Open" value={String(totals.open)} />
          <Stat label="Overdue" value={String(totals.overdue)} tone={totals.overdue > 0} />
          <Stat label="Completed" value={String(totals.completed)} />
        </div>
      </section>

      <div className="mt-4 grid gap-2">
        {[ACCEPTED_JOB_TEMPLATE, CLOSEOUT_TEMPLATE].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => templateMutation.mutate(t.key as "accepted_job" | "closeout")}
            disabled={templateMutation.isPending}
            className="l-card flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
          >
            <ListChecks className="h-4 w-4 shrink-0 l-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">Generate {t.label}</span>
              <span className="block truncate text-[12px] l-muted">{t.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      {groups.overdue.length > 0 && (
        <div className="mt-5">
          <SectionTitle hint={`${groups.overdue.length}`}>Overdue</SectionTitle>
          <ul className="grid gap-2">
            {groups.overdue.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={() => toggleMutation.mutate(t)}
                onEdit={() => setDraft(taskToDraft(t))}
                onDelete={() => deleteMutation.mutate(t.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <SectionTitle hint={`${groups.open.length} open`}>Tasks</SectionTitle>
        {groups.open.length === 0 ? (
          <Empty>No open tasks. Generate a checklist or add one below.</Empty>
        ) : (
          <ul className="grid gap-2">
            {groups.open.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={() => toggleMutation.mutate(t)}
                onEdit={() => setDraft(taskToDraft(t))}
                onDelete={() => deleteMutation.mutate(t.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {groups.done.length > 0 && (
        <div className="mt-5">
          <SectionTitle hint={`${groups.done.length}`}>Done</SectionTitle>
          <ul className="grid gap-2">
            {groups.done.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={() => toggleMutation.mutate(t)}
                onEdit={() => setDraft(taskToDraft(t))}
                onDelete={() => deleteMutation.mutate(t.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {draft ? (
        <form
          className="l-card mt-4 grid gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.title.trim()) saveMutation.mutate(draft);
          }}
        >
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="What needs doing?"
            className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              list="ledger-task-owners"
              value={draft.assignedTo}
              onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })}
              placeholder="Owner"
              className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
            />
            <datalist id="ledger-task-owners">
              {crew.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              type="date"
              value={draft.dueAt}
              onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
            />
            <Select
              value={draft.status}
              onChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}
              options={[...TASK_STATUSES]}
            />
            <Select
              value={draft.priority}
              onChange={(v) => setDraft({ ...draft, priority: v as Draft["priority"] })}
              options={[...TASK_PRIORITIES]}
            />
            <Select
              value={draft.taskType}
              onChange={(v) => setDraft({ ...draft, taskType: v })}
              options={[...TASK_TYPES]}
            />
            <input
              value={draft.trade}
              onChange={(e) => setDraft({ ...draft, trade: e.target.value })}
              placeholder="Trade"
              className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
            />
          </div>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Notes"
            rows={2}
            className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-full px-4 py-2 text-[12px] font-semibold l-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!draft.title.trim() || saveMutation.isPending}
              className="rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-50"
              style={{ background: "var(--l-accent)", color: "var(--l-on-ink)" }}
            >
              {saveMutation.isPending ? "Saving…" : "Save task"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setDraft({ ...emptyDraft, assignedTo: defaultOwner ?? "" })}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full text-[13px] font-bold"
          style={{ background: "var(--l-ink)", color: "var(--l-on-ink)" }}
        >
          <Plus className="h-4 w-4" /> Add task
        </button>
      )}
    </div>
  );
}

function taskToDraft(t: TaskRow): Draft {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    assignedTo: t.assignedTo ?? "",
    dueAt: toInput(t.dueAt),
    status: t.status,
    priority: t.priority,
    trade: t.trade ?? "",
    taskType: t.taskType,
  };
}

function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: TaskRow;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "Completed";
  return (
    <li className="l-card px-4 py-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? "Mark not started" : "Mark completed"}
          className="mt-0.5 shrink-0"
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 l-green" />
          ) : (
            <Circle className="h-5 w-5 l-muted" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className={"truncate text-[14px] font-semibold " + (done ? "line-through l-muted" : "")}>
            {task.title}
          </p>
          <p className="mt-0.5 text-[12px] l-muted">
            {task.assignedTo ?? "Unassigned"}
            {task.dueAt ? ` · due ${fmtDate(task.dueAt)}` : " · no due date"}
            {task.trade ? ` · ${task.trade}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="l-pill text-[10px]">{task.status}</span>
            <span className="l-pill text-[10px]">{task.priority}</span>
            {task.overdue && (
              <span className="l-pill text-[10px] l-red">
                {task.daysOverdue === 0 ? "Overdue" : `${task.daysOverdue}d overdue`}
              </span>
            )}
          </div>
          {task.description && <p className="mt-1.5 text-[12px] l-muted">{task.description}</p>}
          <div className="mt-2 flex gap-3">
            <button type="button" className="text-[12px] font-semibold l-accent" onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px] font-semibold l-red"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-[14px] outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] l-muted">{label}</p>
      <p className={"mt-1 truncate text-[18px] font-bold tabular-nums " + (tone ? "l-red" : "")}>
        {value}
      </p>
    </div>
  );
}

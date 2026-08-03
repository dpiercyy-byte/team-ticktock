import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ComponentType } from "react";
import {
  ArrowLeft, Calendar, CheckCircle2, Clock, DollarSign,
  FileText, Hammer, MapPin, Package, PenSquare, Phone, Plus, Receipt,
  ShieldCheck, Sparkles, Trash2, Users, X,
} from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobHero, heroClass } from "@/components/ledger/JobHero";

import { JobJourney } from "@/components/ledger/JobJourney";
import { ActivateJobPanel } from "@/components/ledger/ActivateJobPanel";
import { LedgerFab } from "@/components/ledger/LedgerFab";
import { formatCurrency, shortDateTime, heroImage } from "@/components/ledger/ledger-ui";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ledgerJobQuery } from "@/lib/ledger-client";
import { addLedgerJobEvent, deleteLedgerJob, type LedgerJob, type LedgerTimelineEvent } from "@/lib/ledger.functions";
import { completeNextAction, setNextAction } from "@/lib/crm.functions";
import { getAdminToken } from "@/lib/session";
import { useState } from "react";

export const Route = createFileRoute("/ledger/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Job — Ledger" },
      { name: "description", content: "Every event, worker, and dollar in one place." },
      { property: "og:title", content: "Job — Ledger" },
      { property: "og:description", content: "One object. Everything connected." },
    ],
  }),
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(ledgerJobQuery(params.jobId));
  },
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const { data } = useSuspenseQuery(ledgerJobQuery(jobId));
  const { job, timeline } = data;
  const profit = job.collected - job.expenses;
  const qc = useQueryClient();
  const router = useRouter();
  const addEvent = useServerFn(addLedgerJobEvent);
  const removeJob = useServerFn(deleteLedgerJob);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const noteMutation = useMutation({
    mutationFn: async (title: string) => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return addEvent({ data: { token, id: jobId, kind: "note", title } });
    },
    onSuccess: () => {
      setNote("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ledger", "jobs", jobId] });
      qc.invalidateQueries({ queryKey: ["ledger", "jobs"] });
      router.invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return removeJob({ data: { token, id: jobId } });
    },
    onSuccess: async () => {
      setConfirmDelete(false);
      qc.removeQueries({ queryKey: ["ledger", "jobs", jobId] });
      await qc.invalidateQueries({ queryKey: ["ledger", "jobs"] });
      await router.navigate({ to: "/ledger/jobs", replace: true });
    },
  });

  return (
    <>
      <LedgerShell
        heroClassName={heroClass(job.projectType)}
        heroImage={heroImage(job.projectType)}
        hero={
          <>
            <Link
              to="/ledger/jobs"
              className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold l-hero-ink-soft"
            >
              <ArrowLeft className="h-4 w-4" /> All jobs
            </Link>
            <JobHero
              projectType={job.projectType}
              status={job.status}
              name={job.name}
              client={job.client.name}
              address={job.address}
            />
          </>
        }
      >
        {/* Financial snapshot sheet, overlapping the hero */}
        <section className="l-sheet p-5 md:p-7">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
            <h2 className="l-eyebrow truncate">Financial snapshot</h2>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums l-muted">
              {job.progress}% complete
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
            <Money label="Budget" value={formatCurrency(job.budget)} />
            <Money label="Collected" value={formatCurrency(job.collected)} tone="green" />
            <Money label="Expenses" value={formatCurrency(job.expenses)} />
            <Money
              label="Profit"
              value={formatCurrency(profit)}
              tone={profit >= 0 ? "green" : "red"}
            />
          </div>

          <div className="mt-5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--l-surface-2)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${job.progress}%`, background: "var(--l-accent)" }}
            />
          </div>
        </section>

        {/* Worker status banner */}
        <div
          className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] px-4 py-3.5"
          style={{
            background: job.workersOnSite > 0 ? "hsl(152 46% 94%)" : "var(--l-surface-2)",
          }}
        >
          <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {job.workersOnSite === 0
                ? "No workers on site"
                : `${job.workersOnSite} worker${job.workersOnSite === 1 ? "" : "s"} on site`}
            </span>
          </span>
          {job.client.phone && (
            <a
              href={`tel:${job.client.phone}`}
              className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold l-accent"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          )}
        </div>

        {/* Journey */}
        <section className="l-card mt-3 p-5">
          <JobJourney status={job.status} onLight />
        </section>

        {job.clientId && (
          <Link
            to="/ledger/people/$clientId"
            params={{ clientId: job.clientId }}
            className="l-card mt-3 flex items-center justify-between px-4 py-3"
          >
            <span className="min-w-0 truncate text-[13px] font-semibold">
              View {job.client.name}'s profile
            </span>
            <span className="shrink-0 text-[12px] l-muted">All projects</span>
          </Link>
        )}

        <FollowUp jobId={jobId} job={job} />

        <ActivateJobPanel jobId={jobId} />



        {job.trades.length > 0 && (
          <section className="mt-6">
            <h2 className="l-eyebrow mb-3 px-1">Trades</h2>
            <div className="flex flex-wrap gap-2">
              {job.trades.map((t) => (
                <span key={t} className="l-pill l-pill--raised">
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}


        <section className="mt-8">
          <h2 className="l-eyebrow mb-1 px-1">Activity</h2>
          <p className="mb-4 px-1 text-[12px] l-muted">Everything that has happened on this job</p>
          <div className="relative">
            <div
              className="absolute left-[19px] bottom-3 top-3 w-px"
              style={{ background: "var(--l-line)" }}
              aria-hidden
            />
            <ol className="grid gap-3">
              {timeline.map((e) => (
                <TimelineRow key={e.id} event={e} />
              ))}
            </ol>
          </div>

          {open && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = note.trim();
                if (t) noteMutation.mutate(t);
              }}
              className="l-card mt-4 p-4"
            >
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="l-eyebrow truncate">New note</p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => {
                    setOpen(false);
                    setNote("");
                  }}
                  className="shrink-0 l-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this job…"
                rows={3}
                className="w-full resize-none bg-transparent text-[14px] outline-none placeholder:opacity-60"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={!note.trim() || noteMutation.isPending}
                  className="rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-50"
                  style={{ background: "var(--l-accent)", color: "var(--l-on-ink)" }}
                >
                  {noteMutation.isPending ? "Saving…" : "Save note"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Danger zone */}
        <section className="mt-10">
          <h2 className="l-eyebrow mb-3 px-1">Danger zone</h2>
          <div className="l-card p-4">
            <p className="text-[12px] l-muted">
              Deleting this job permanently removes it and its entire activity timeline. This
              cannot be undone.
            </p>
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold l-red"
                  style={{ background: "hsl(6 78% 96%)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete job
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{job.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the job and all of its timeline events. This cannot
                    be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      deleteMutation.mutate();
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete job"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      </LedgerShell>


      {!open && (
        <LedgerFab label="Add a note" onClick={() => setOpen(true)}>
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </LedgerFab>
      )}
    </>
  );
}

function Money({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] l-muted">{label}</p>
      <p
        className={
          "mt-1 truncate text-[22px] font-bold tabular-nums md:text-2xl " +
          (tone === "green" ? "l-green" : tone === "red" ? "l-red" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}

const TIMELINE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  created: PenSquare, status: Hammer, stage: Hammer, note: FileText, call: Phone, visit: MapPin,
  estimate: FileText, approval: CheckCircle2, payment: DollarSign, clockin: Clock,
  receipt: Receipt, material: Package, change_order: PenSquare, inspection: ShieldCheck,
  completed: Sparkles,
};

function TimelineRow({ event }: { event: LedgerTimelineEvent }) {
  const Icon = TIMELINE_ICON[event.kind] ?? Calendar;
  return (
    <li className="relative flex items-start gap-4">
      <div
        className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full"
        style={{ background: "var(--l-surface)", boxShadow: "var(--shadow-card)" }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="l-card min-w-0 flex-1 px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
          <p className="truncate text-[14px] font-semibold">{event.title}</p>
          <p className="shrink-0 text-[11px] tabular-nums l-muted">
            {shortDateTime(event.occurredAt)}
          </p>
        </div>
        {event.detail && <p className="mt-0.5 text-[12px] l-muted">{event.detail}</p>}
      </div>
    </li>
  );
}

function FollowUp({ jobId, job }: { jobId: string; job: LedgerJob }) {
  const qc = useQueryClient();
  const save = useServerFn(setNextAction);
  const complete = useServerFn(completeNextAction);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState(job.nextAction ?? "");
  const [owner, setOwner] = useState(job.assignedOwner ?? "");
  const [due, setDue] = useState(job.nextActionDueAt ? job.nextActionDueAt.slice(0, 10) : "");

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["ledger", "job", jobId] });
    await qc.invalidateQueries({ queryKey: ["crm"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return save({
        data: { token, id: jobId, nextAction: action.trim(), owner: owner.trim() || null, dueAt: due || null },
      });
    },
    onSuccess: async () => {
      setEditing(false);
      await invalidate();
    },
  });

  const doneMutation = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return complete({ data: { token, id: jobId } });
    },
    onSuccess: async () => {
      setAction("");
      await invalidate();
    },
  });

  return (
    <section className="mt-6">
      <h2 className="l-eyebrow mb-3 px-1">Next step</h2>
      <div className="l-card p-4">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (action.trim()) saveMutation.mutate();
            }}
            className="grid gap-3"
          >
            <input
              autoFocus
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Call to book a site visit"
              className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Owner"
                className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
              />
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full px-4 py-2 text-[12px] font-semibold l-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!action.trim() || saveMutation.isPending}
                className="rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-50"
                style={{ background: "var(--l-accent)", color: "var(--l-on-ink)" }}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-3">
            {job.nextAction ? (
              <div>
                <p className="text-[14px] font-semibold">{job.nextAction}</p>
                <p className="mt-0.5 text-[12px] l-muted">
                  {job.assignedOwner ? `${job.assignedOwner} · ` : ""}
                  {job.nextActionDueAt
                    ? `due ${new Date(job.nextActionDueAt).toLocaleDateString()}`
                    : "no due date"}
                </p>
              </div>
            ) : (
              <p className="text-[13px] l-muted">No follow-up set for this project.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex min-h-[40px] items-center rounded-full px-4 text-[12px] font-bold"
                style={{ background: "var(--l-ink)", color: "var(--l-on-ink)" }}
              >
                {job.nextAction ? "Change" : "Set next step"}
              </button>
              {job.nextAction && (
                <button
                  type="button"
                  onClick={() => doneMutation.mutate()}
                  disabled={doneMutation.isPending}
                  className="l-pill min-h-[40px] disabled:opacity-50"
                >
                  {doneMutation.isPending ? "Marking…" : "Mark done"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Phone, Plus, Trash2, X } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobHero, heroClass } from "@/components/ledger/JobHero";

import { JobJourney } from "@/components/ledger/JobJourney";
import { ActivateJobPanel } from "@/components/ledger/ActivateJobPanel";
import { LedgerFab } from "@/components/ledger/LedgerFab";
import { heroImage } from "@/components/ledger/ledger-ui";
import { OverviewTab } from "@/components/ledger/workspace/OverviewTab";
import { ActivityTab } from "@/components/ledger/workspace/ActivityTab";
import { LabourTab } from "@/components/ledger/workspace/LabourTab";
import { CostsTab } from "@/components/ledger/workspace/CostsTab";
import { PaymentsTab } from "@/components/ledger/workspace/PaymentsTab";
import { FinancialsTab } from "@/components/ledger/workspace/FinancialsTab";
import { DocumentsTab } from "@/components/ledger/workspace/DocumentsTab";
import { TasksTab } from "@/components/ledger/workspace/TasksTab";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ledgerJobQuery } from "@/lib/ledger-client";
import { workspaceQuery } from "@/lib/workspace-client";
import { addLedgerJobEvent, deleteLedgerJob, type LedgerJob } from "@/lib/ledger.functions";
import { completeNextAction, setNextAction } from "@/lib/crm.functions";
import { getAdminToken } from "@/lib/session";
import { useState } from "react";

export const Route = createFileRoute("/ledger/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Job workspace — Ledger" },
      { name: "description", content: "Every event, worker, and dollar in one place." },
      { property: "og:title", content: "Job workspace — Ledger" },
      { property: "og:description", content: "One object. Everything connected." },
    ],
  }),
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(ledgerJobQuery(params.jobId));
  },
  component: JobDetail,
});

const TABS = [
  "Overview",
  "Activity",
  "Tasks",
  "Labour",
  "Costs",
  "Payments",
  "Financials",
  "Documents",
] as const;

type Tab = (typeof TABS)[number];

function JobDetail() {
  const { jobId } = Route.useParams();
  const { data } = useSuspenseQuery(ledgerJobQuery(jobId));
  const { job } = data;
  const { data: ws } = useSuspenseQuery(workspaceQuery(jobId));
  const qc = useQueryClient();
  const router = useRouter();
  const addEvent = useServerFn(addLedgerJobEvent);
  const removeJob = useServerFn(deleteLedgerJob);
  const [tab, setTab] = useState<Tab>("Overview");
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
      qc.invalidateQueries({ queryKey: ["ledger", "workspace", jobId] });
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
      qc.removeQueries({ queryKey: ["ledger", "workspace", jobId] });
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
        <nav className="l-sheet flex gap-1 overflow-x-auto p-2" aria-label="Job workspace sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={
                "min-h-[44px] shrink-0 rounded-full px-4 text-[13px] font-bold transition-colors " +
                (tab === t ? "" : "l-muted")
              }
              style={
                tab === t
                  ? { background: "var(--l-ink)", color: "var(--l-on-ink)" }
                  : undefined
              }
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="mt-3">
          {tab === "Overview" && (
            <>
              <OverviewTab
                project={ws.project}
                rollup={ws.rollup}
                onSite={ws.onSite}
                openIssues={ws.openIssues}
              />

              <section className="l-card mt-3 p-5">
                <JobJourney status={job.status} onLight />
              </section>

              <FollowUp jobId={jobId} job={job} />

              <ActivateJobPanel jobId={jobId} />

              <section className="l-card mt-3 p-5">
                <h2 className="l-eyebrow mb-2">Delivery status</h2>
                <p className="text-[12px] l-muted">
                  {isCompleted
                    ? "This job is marked complete. Its site stays geofenced so callback visits still get tagged."
                    : "Mark the job complete when work is finished. The site keeps its geofence for callbacks."}
                </p>
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(isCompleted ? "Active" : "Completed")}
                  className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-60"
                  style={
                    isCompleted
                      ? { background: "var(--l-sheet-2, hsl(40 20% 94%))" }
                      : { background: "var(--l-ink)", color: "var(--l-on-ink)" }
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {statusMutation.isPending
                    ? "Saving…"
                    : isCompleted
                      ? "Reopen job"
                      : "Mark job complete"}
                </button>
              </section>


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
                          This permanently deletes the job and all of its timeline events. This
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>
                          Cancel
                        </AlertDialogCancel>
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
            </>
          )}

          {tab === "Activity" && (
            <>
              <ActivityTab timeline={ws.timeline} />
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
            </>
          )}

          {tab === "Tasks" && (
            <TasksTab
              projectId={jobId}
              crew={Array.from(new Set(ws.labour.map((l) => l.worker)))}
              defaultOwner={job.assignedOwner ?? null}
            />
          )}
          {tab === "Labour" && <LabourTab rows={ws.labour} totals={ws.labourTotals} />}
          {tab === "Costs" && <CostsTab rows={ws.costs} totals={ws.costTotals} />}
          {tab === "Payments" && (
            <PaymentsTab projectId={jobId} rows={ws.payments} totals={ws.paymentTotals} />
          )}
          {tab === "Financials" && (
            <FinancialsTab
              projectId={jobId}
              financials={ws.financials}
              changeOrders={ws.changeOrders}
              projectCosts={ws.projectCosts}
              exportState={ws.exportState}
              counts={{
                labourEntries: ws.labour.length,
                receipts: ws.costs.length,
                payments: ws.payments.length,
              }}
            />
          )}
          {tab === "Documents" && <DocumentsTab projectId={jobId} documents={ws.documents} />}
        </div>
      </LedgerShell>

      {tab === "Activity" && !open && (
        <LedgerFab label="Add a note" onClick={() => setOpen(true)}>
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </LedgerFab>
      )}
    </>
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
    await qc.invalidateQueries({ queryKey: ["ledger", "workspace", jobId] });
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

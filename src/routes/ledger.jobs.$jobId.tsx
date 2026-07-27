import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ComponentType } from "react";
import {
  ArrowLeft, Calendar, CheckCircle2, Clock, DollarSign,
  FileText, Hammer, MapPin, Package, PenSquare, Phone, Plus, Receipt,
  ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobHero, heroClass } from "@/components/ledger/JobHero";
import { heroImage } from "@/components/ledger/ledger-ui";
import { JobJourney } from "@/components/ledger/JobJourney";
import { LedgerFab } from "@/components/ledger/LedgerFab";
import { formatCurrency, shortDateTime } from "@/components/ledger/ledger-ui";
import { ledgerJobQuery } from "@/lib/ledger-client";
import { addLedgerJobEvent, type LedgerTimelineEvent } from "@/lib/ledger.functions";
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
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

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
                  style={{ background: "var(--l-accent)", color: "#fff" }}
                >
                  {noteMutation.isPending ? "Saving…" : "Save note"}
                </button>
              </div>
            </form>
          )}
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
  created: PenSquare, status: Hammer, note: FileText, visit: MapPin,
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

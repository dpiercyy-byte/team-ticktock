import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ComponentType } from "react";
import {
  ArrowLeft, Calendar, CheckCircle2, ClipboardList, Clock, DollarSign,
  FileText, Hammer, MapPin, Package, PenSquare, Phone, Plus, Receipt,
  ShieldCheck, Sparkles, Users,
} from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { formatCurrency, statusTone } from "@/components/ledger/ledger-ui";
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
    <LedgerShell>
      <Link
        to="/ledger/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All jobs
      </Link>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {job.projectType}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{job.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{job.client.name}</p>
          </div>
          <span className={"rounded-full px-3 py-1 text-xs font-medium " + statusTone(job.status)}>
            {job.status}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {job.address}
          </span>
          {job.client.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> {job.client.phone}
            </span>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="tabular-nums">{job.progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${job.progress}%` }} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <BigStat icon={DollarSign} label="Budget" value={formatCurrency(job.budget)} />
          <BigStat icon={ClipboardList} label="Collected" value={formatCurrency(job.collected)} />
          <BigStat icon={Receipt} label="Expenses" value={formatCurrency(job.expenses)} />
          <BigStat icon={Sparkles} label="Profit" value={formatCurrency(profit)} tone={profit >= 0 ? "positive" : "negative"} />
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {job.workersOnSite === 0
              ? "No workers on site"
              : `${job.workersOnSite} worker${job.workersOnSite === 1 ? "" : "s"} on site`}
          </span>
        </div>
      </section>

      {job.trades.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Trades" />
          <div className="flex flex-wrap gap-2">
            {job.trades.map((t) => (
              <span key={t} className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium">
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionHeader title="Activity" hint="Everything that has happened on this job" />
        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" aria-hidden />
          <ol className="grid gap-3">
            {timeline.map((e) => <TimelineRow key={e.id} event={e} />)}
          </ol>
        </div>

        {open ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = note.trim();
              if (t) noteMutation.mutate(t);
            }}
            className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this job…"
              rows={3}
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setOpen(false); setNote(""); }}
                className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!note.trim() || noteMutation.isPending}
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {noteMutation.isPending ? "Saving…" : "Save note"}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-transparent px-4 py-4 text-sm font-medium text-muted-foreground hover:bg-secondary/60"
          >
            <Plus className="h-4 w-4" /> Add a note
          </button>
        )}
      </section>
    </LedgerShell>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 px-1">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function BigStat({
  icon: Icon, label, value, tone,
}: { icon: ComponentType<{ className?: string }>; label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={"mt-1.5 text-lg font-semibold tabular-nums " + (tone === "negative" ? "text-destructive" : "")}>
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
  const when = new Date(event.occurredAt);
  const label = when.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  return (
    <li className="relative flex items-start gap-4">
      <div className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card shadow-[var(--shadow-card)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{event.title}</p>
          <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{label}</p>
        </div>
        {event.detail && <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>}
      </div>
    </li>
  );
}

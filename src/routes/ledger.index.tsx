import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobCard } from "@/components/ledger/JobCard";
import { StatStrip } from "@/components/ledger/StatStrip";
import {
  formatCurrency,
  JOURNEY,
  relativeTime,
  statusDotClass,
  statusShort,
  statusTone,
} from "@/components/ledger/ledger-ui";
import { ledgerJobsQuery } from "@/lib/ledger-client";
import type { LedgerJob } from "@/lib/ledger.functions";
import type { ReactNode } from "react";

export const Route = createFileRoute("/ledger/")({
  head: () => ({
    meta: [
      { title: "Today — Ledger" },
      { name: "description", content: "Your daily briefing across every job." },
      { property: "og:title", content: "Today — Ledger" },
      { property: "og:description", content: "Your daily briefing across every job." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerJobsQuery());
  },
  component: LedgerHome,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const ACTION_STATUSES = ["Lead", "Site Visit Required", "Estimate Required", "Waiting For Approval"];

function LedgerHome() {
  const { data: jobs } = useSuspenseQuery(ledgerJobsQuery());
  const active = jobs.filter((j) => j.status === "Active" || j.status === "Scheduled");
  const onSite = jobs.filter((j) => j.workersOnSite > 0);
  const needAction = jobs.filter((j) => ACTION_STATUSES.includes(j.status));
  const owing = jobs.reduce((s, j) => s + Math.max(0, j.budget - j.collected), 0);
  const recent = [...jobs]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 3);
  const date = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <LedgerShell>
      <header className="mb-6">
        <p className="text-[13px] font-medium l-muted">{date}</p>
        <h1 className="mt-1 display text-[40px] leading-[1.02] md:text-5xl">{greeting()}</h1>
      </header>

      <Link
        to="/ledger/jobs/new"
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-[16px] font-bold"
        style={{ background: "var(--l-ink)", color: "#fff" }}
      >
        <Plus className="h-5 w-5" /> New Job
      </Link>

      <StatStrip
        items={[
          { label: "Active", value: active.length, tone: "green" },
          { label: "Needs action", value: needAction.length, tone: "accent" },
          { label: "Total", value: jobs.length },
        ]}
      />

      <section className="mt-8">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-1">
          <h2 className="l-eyebrow truncate">Follow-ups</h2>
          <Link to="/ledger/pipeline" className="shrink-0 text-[12px] font-semibold l-muted">
            Pipeline
          </Link>
        </div>
        {followUps.length === 0 ? (
          <EmptyLine text="No follow-ups due. Nice." />
        ) : (
          <div className="grid gap-3">
            {followUps.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to="/ledger/jobs/$jobId"
                params={{ jobId: c.id }}
                className="l-card block px-4 py-3.5"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <p className="truncate text-[14px] font-bold">{c.clientName}</p>
                  <span className="shrink-0 text-[12px] font-semibold l-muted">
                    {c.salesStage}
                  </span>
                </div>
                <NextActionLine card={c} className="mt-1.5" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-1">
          <h2 className="l-eyebrow truncate">Pipeline</h2>
          <Link to="/ledger/jobs" className="shrink-0 text-[12px] font-semibold l-muted">
            See all
          </Link>
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 tab-scroll md:-mx-8 md:px-8">
          {JOURNEY.map((s) => {
            const n = jobs.filter((j) => j.status === s).length;
            return (
              <Link
                key={s}
                to="/ledger/jobs"
                search={{ stage: s }}
                className="l-card flex shrink-0 items-center gap-2 px-3.5 py-2.5"
              >
                <span className={statusDotClass(s)} />
                <span className="text-[12px] font-semibold">{statusShort(s)}</span>
                <span className="text-[12px] font-bold tabular-nums l-muted">{n}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {onSite.length > 0 && (
        <Section title="On site now">
          <div className="grid gap-3">
            {onSite.map((j) => (
              <LiveRow key={j.id} job={j} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Active jobs" action={{ to: "/ledger/jobs", label: "See all" }}>
        {active.length === 0 ? (
          <EmptyLine text="Nothing moving today." />
        ) : (
          <div className="grid gap-3">
            {active.slice(0, 3).map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Requires action">
        {needAction.length === 0 ? (
          <EmptyLine text="You're all caught up." />
        ) : (
          <div className="grid gap-3">
            {needAction.map((j) => (
              <MiniRow key={j.id} job={j} right={<span className={statusTone(j.status)}>{statusShort(j.status)}</span>} />
            ))}
          </div>
        )}
      </Section>

      <Section title={`Outstanding · ${formatCurrency(owing)}`}>
        <div className="grid gap-3">
          {recent.map((j) => (
            <MiniRow
              key={j.id}
              job={j}
              right={
                <span className="text-[12px] font-semibold tabular-nums l-muted">
                  {relativeTime(j.updatedAt)}
                </span>
              }
            />
          ))}
        </div>
      </Section>
    </LedgerShell>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { to: "/ledger/jobs"; label: string };
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-1">
        <h2 className="l-eyebrow truncate">{title}</h2>
        {action && (
          <Link to={action.to} className="shrink-0 text-[12px] font-semibold l-muted">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function LiveRow({ job }: { job: LedgerJob }) {
  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: job.id }}
      className="l-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5"
      style={{ background: "hsl(152 46% 96%)" }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="l-dot l-s-active-bg" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold">{job.name}</p>
          <p className="truncate text-[12px] l-muted">
            {job.workersOnSite} worker{job.workersOnSite === 1 ? "" : "s"} on the clock
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 l-muted" />
    </Link>
  );
}

function MiniRow({ job, right }: { job: LedgerJob; right: ReactNode }) {
  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: job.id }}
      className="l-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5"
    >
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold">{job.name}</p>
        <p className="truncate text-[12px] l-muted">{job.client.name}</p>
      </div>
      <span className="shrink-0">{right}</span>
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="l-card px-4 py-8 text-center text-[13px] l-muted">{text}</div>
  );
}

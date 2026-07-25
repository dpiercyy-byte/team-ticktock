import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobCard } from "@/components/ledger/JobCard";
import { formatCurrency, relativeTime } from "@/components/ledger/ledger-ui";
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

function LedgerHome() {
  const { data: jobs } = useSuspenseQuery(ledgerJobsQuery());
  const today = jobs.filter((j) => j.status === "Active" || j.status === "Scheduled");
  const estimates = jobs.filter(
    (j) => j.status === "Waiting For Approval" || j.status === "Estimate Required",
  );
  const needAction = jobs.filter(
    (j) => j.status === "Site Visit Required" || j.status === "Lead",
  );
  const clockedIn = jobs.filter((j) => j.workersOnSite > 0);
  const paymentsWaiting = jobs.filter((j) => j.budget > 0 && j.collected < j.budget);
  const recent = [...jobs]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 3);
  const date = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <LedgerShell>
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">{date}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          {greeting()}.
        </h1>
        <p className="mt-2 text-base text-muted-foreground md:text-lg">
          {today.length > 0
            ? `${today.length} job${today.length === 1 ? "" : "s"} moving today.`
            : "No jobs on the board today. A quiet start."}
        </p>
      </header>

      <Link
        to="/ledger/jobs/new"
        className="mb-8 flex items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
            <Plus className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-[15px] font-medium">Start a new job</span>
            <span className="block text-xs text-primary-foreground/70">
              Client, address, trades — in under a minute
            </span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5" />
      </Link>

      <Section title="Today's Jobs" count={today.length} to="/ledger/jobs">
        {today.length === 0 ? (
          <EmptyLine text="Nothing scheduled." />
        ) : (
          <div className="grid gap-3">
            {today.slice(0, 3).map((j) => <JobCard key={j.id} job={j} compact />)}
          </div>
        )}
      </Section>

      <Section title="Estimates Waiting" count={estimates.length}>
        {estimates.length === 0 ? (
          <EmptyLine text="No estimates in the queue." />
        ) : (
          <div className="grid gap-3">
            {estimates.map((j) => (
              <MiniRow key={j.id} job={j} rightLabel={j.budget > 0 ? formatCurrency(j.budget) : "Draft"} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Jobs Requiring Action" count={needAction.length}>
        {needAction.length === 0 ? (
          <EmptyLine text="You're all caught up." />
        ) : (
          <div className="grid gap-3">
            {needAction.map((j) => <MiniRow key={j.id} job={j} rightLabel={j.status} />)}
          </div>
        )}
      </Section>

      <Section title="Workers Currently Clocked In" count={clockedIn.reduce((s, j) => s + j.workersOnSite, 0)}>
        {clockedIn.length === 0 ? (
          <EmptyLine text="No one is on site." />
        ) : (
          <div className="grid gap-3">
            {clockedIn.map((j) => <MiniRow key={j.id} job={j} rightLabel={`${j.workersOnSite} on site`} />)}
          </div>
        )}
      </Section>

      <Section title="Payments Waiting" count={paymentsWaiting.length}>
        {paymentsWaiting.length === 0 ? (
          <EmptyLine text="No outstanding payments." />
        ) : (
          <div className="grid gap-3">
            {paymentsWaiting.map((j) => (
              <MiniRow key={j.id} job={j} rightLabel={formatCurrency(j.budget - j.collected)} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recently Updated" count={recent.length}>
        <div className="grid gap-3">
          {recent.map((j) => <MiniRow key={j.id} job={j} rightLabel={relativeTime(j.updatedAt)} />)}
        </div>
      </Section>
    </LedgerShell>
  );
}

function Section({ title, count, to, children }: { title: string; count: number; to?: "/ledger/jobs"; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">
          {title}
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">{count}</span>
        </h2>
        {to && (
          <Link to={to} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            See all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function MiniRow({ job, rightLabel }: { job: LedgerJob; rightLabel: string }) {
  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: job.id }}
      className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-[var(--shadow-card)] transition-colors hover:bg-secondary/60"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{job.name}</p>
        <p className="truncate text-xs text-muted-foreground">{job.client.name}</p>
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
        {rightLabel}
      </span>
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

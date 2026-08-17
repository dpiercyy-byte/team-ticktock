import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobCard } from "@/components/ledger/JobCard";
import { FinanceSummary } from "@/components/ledger/FinanceSummary";
import { ledgerJobsQuery } from "@/lib/ledger-client";
import { portfolioTotals } from "@/lib/job-costs";
import type { LedgerStatus } from "@/lib/ledger.functions";

/** Only stages with real dollars attached live in the Ledger. */
const MONEY_STAGES = ["Scheduled", "Active", "Completed"] as const;
type MoneyStage = (typeof MONEY_STAGES)[number];

const isMoneyStage = (s: string): s is MoneyStage =>
  (MONEY_STAGES as readonly string[]).includes(s);

export const Route = createFileRoute("/ledger/jobs/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ledger — Job financials" },
      {
        name: "description",
        content: "Budgets, costs and margin across every scheduled, active and completed job.",
      },
      { property: "og:title", content: "Ledger — Job financials" },
      {
        property: "og:description",
        content: "Budgets, costs and margin across every scheduled, active and completed job.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { stage?: MoneyStage } => {
    const stage = typeof search.stage === "string" ? search.stage : undefined;
    return stage && isMoneyStage(stage) ? { stage } : {};
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerJobsQuery());
  },
  component: JobsPage,
});

function JobsPage() {
  const { data: allJobs } = useSuspenseQuery(ledgerJobsQuery());
  const { stage } = Route.useSearch();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<MoneyStage | "All">(stage ?? "All");

  const jobs = useMemo(
    () => allJobs.filter((j) => isMoneyStage(String(j.status) as LedgerStatus)),
    [allJobs],
  );

  const totals = useMemo(
    () => portfolioTotals(jobs.filter((j) => j.status === "Active")),
    [jobs],
  );

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    return jobs.filter((j) => {
      if (filter !== "All" && j.status !== filter) return false;
      if (!query) return true;
      return (
        j.name.toLowerCase().includes(query) ||
        j.client.name.toLowerCase().includes(query) ||
        j.address.toLowerCase().includes(query)
      );
    });
  }, [jobs, q, filter]);

  return (
    <LedgerShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="display text-[26px] leading-none md:text-[30px]">Ledger</h1>
        <Link
          to="/ledger/jobs/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold"
          style={{ background: "var(--l-ink)", color: "#fff" }}
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </div>

      <div className="mb-4">
        <FinanceSummary
          budgets={totals.budgets}
          costs={totals.costs}
          expectedProfit={totals.expectedProfit}
        />
      </div>

      <div className="l-input mb-4 flex items-center gap-3 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 l-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search job, client, or address"
          className="w-full bg-transparent text-[14px] outline-none placeholder:opacity-60"
        />
      </div>

      <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-2 tab-scroll md:-mx-8 md:px-8">
        {(["All", ...MONEY_STAGES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              "l-seg shrink-0 px-3.5 py-2 text-[12px] font-semibold transition-colors " +
              (filter === s ? "l-seg--active" : "")
            }
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="l-card px-6 py-16 text-center text-[13px] l-muted">No jobs match.</div>
      ) : (
        <div className="grid gap-3.5">
          {filtered.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </LedgerShell>
  );
}


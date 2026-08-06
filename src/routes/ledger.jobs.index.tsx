import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobCard } from "@/components/ledger/JobCard";
import { statusShort } from "@/components/ledger/ledger-ui";
import { ledgerJobsQuery } from "@/lib/ledger-client";
import { LEDGER_STATUSES, type LedgerStatus } from "@/lib/ledger.functions";

export const Route = createFileRoute("/ledger/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs — Ledger" },
      { name: "description", content: "Every job in one calm, searchable list." },
      { property: "og:title", content: "Jobs — Ledger" },
      { property: "og:description", content: "Every job in one calm, searchable list." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { stage?: LedgerStatus } => {
    const stage = typeof search.stage === "string" ? search.stage : undefined;
    return stage && (LEDGER_STATUSES as readonly string[]).includes(stage)
      ? { stage: stage as LedgerStatus }
      : {};
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerJobsQuery());
  },
  component: JobsPage,
});

function JobsPage() {
  const { data: jobs } = useSuspenseQuery(ledgerJobsQuery());
  const { stage } = Route.useSearch();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<LedgerStatus | "All">(stage ?? "All");

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
      <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <h1 className="display text-[34px] leading-none md:text-4xl">Jobs</h1>
          <p className="mt-1.5 text-[13px] l-muted">
            {jobs.length} total · {jobs.filter((j) => j.status === "Active").length} active
          </p>
        </div>
        <Link
          to="/ledger/jobs/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold"
          style={{ background: "var(--l-ink)", color: "#fff" }}
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </header>

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
        {(["All", ...LEDGER_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              "l-seg shrink-0 px-3.5 py-2 text-[12px] font-semibold transition-colors " +
              (filter === s ? "l-seg--active" : "")
            }
          >
            {s === "All" ? "All" : statusShort(s)}
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

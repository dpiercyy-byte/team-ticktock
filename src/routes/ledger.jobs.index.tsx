import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobCard } from "@/components/ledger/JobCard";
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
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerJobsQuery());
  },
  component: JobsPage,
});

function JobsPage() {
  const { data: jobs } = useSuspenseQuery(ledgerJobsQuery());
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<LedgerStatus | "All">("All");

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
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {jobs.length} total · {jobs.filter((j) => j.status === "Active").length} active
          </p>
        </div>
        <Link
          to="/ledger/jobs/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </header>

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by job, client, or address"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 tab-scroll">
        {(["All", ...LEDGER_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors " +
              (filter === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground")
            }
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">No jobs match.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((j) => <JobCard key={j.id} job={j} />)}
        </div>
      )}
    </LedgerShell>
  );
}

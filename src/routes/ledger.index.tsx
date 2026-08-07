import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { JobCard } from "@/components/ledger/JobCard";
import { ledgerJobsQuery } from "@/lib/ledger-client";

export const Route = createFileRoute("/ledger/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Jobs — Ledger" },
      { name: "description", content: "Search every job by name or address." },
      { property: "og:title", content: "Jobs — Ledger" },
      { property: "og:description", content: "Search every job by name or address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Admin token lives in sessionStorage, so only prefetch in the browser.
  loader: ({ context }) => {
    if (typeof window === "undefined") return;
    void context.queryClient.ensureQueryData(ledgerJobsQuery()).catch(() => {});
  },
  component: LedgerHome,
});

const ACTIVE_STATUSES = ["active", "scheduled"];

function LedgerHome() {
  const { data: jobs } = useSuspenseQuery(ledgerJobsQuery());
  const [q, setQ] = useState("");

  const { activeJobs, pastJobs } = useMemo(() => {
    const query = q.trim().toLowerCase();
    const matches = (j: (typeof jobs)[number]) =>
      !query ||
      j.name.toLowerCase().includes(query) ||
      j.client.name.toLowerCase().includes(query) ||
      j.address.toLowerCase().includes(query);

    const isActive = (j: (typeof jobs)[number]) =>
      ACTIVE_STATUSES.includes((j.status ?? "").toLowerCase());

    const active = jobs.filter((j) => isActive(j) && matches(j));
    const past = query ? jobs.filter((j) => !isActive(j) && matches(j)) : [];
    return { activeJobs: active, pastJobs: past };
  }, [jobs, q]);

  const empty = activeJobs.length === 0 && pastJobs.length === 0;

  return (
    <LedgerShell>
      <div className="l-sticky-search sticky top-0 z-30 -mx-5 mb-5 px-5 pb-3 pt-1 md:-mx-8 md:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
          <div className="l-input flex items-center gap-3 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 l-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search job or address"
              className="w-full bg-transparent text-[15px] outline-none placeholder:opacity-60"
              aria-label="Search jobs"
            />
          </div>
          <Link
            to="/ledger/jobs/new"
            aria-label="New job"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
            style={{ background: "var(--l-ink)", color: "var(--l-on-ink)" }}
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <h1 className="sr-only">Jobs</h1>

      {empty ? (
        <div className="l-card px-6 py-16 text-center text-[13px] l-muted">
          {q.trim() ? "No jobs match." : "No active jobs yet."}
        </div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {activeJobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}

      {pastJobs.length > 0 && (
        <section className="mt-8">
          <h2 className="l-eyebrow mb-3 px-1">Past jobs</h2>
          <div className="grid gap-3.5 md:grid-cols-2">
            {pastJobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}
    </LedgerShell>
  );
}

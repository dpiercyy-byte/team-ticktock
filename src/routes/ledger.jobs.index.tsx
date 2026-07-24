import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { listJobs } from "@/lib/os/jobs.functions";
import { getAdminToken } from "@/lib/session";
import { JobCard } from "@/components/os/JobCard";
import { STATUSES } from "@/lib/os/constants";

export const Route = createFileRoute("/ledger/jobs/")({
  head: () => ({
    meta: [
      { title: "All Jobs — Clockwise OS" },
      { name: "description", content: "Every job in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JobsIndex,
});

function JobsIndex() {
  const token = getAdminToken();
  const [status, setStatus] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["os-jobs", status],
    queryFn: () => listJobs({ data: { token: token!, status } }),
    enabled: !!token,
  });

  if (!token) return <div className="mt-16 text-center text-sm text-slate-500">Sign in as admin from Clockwise.</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between pt-6">
        <h1
          className="text-[32px] font-semibold text-slate-900"
          style={{ fontFamily: '"Bricolage Grotesque", serif', letterSpacing: "-0.035em" }}
        >
          Jobs
        </h1>
        <Link
          to="/ledger/jobs/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 tab-scroll">
        <FilterChip label="All" active={status === null} onClick={() => setStatus(null)} />
        {STATUSES.map((s) => (
          <FilterChip key={s.id} label={s.label} active={status === s.id} onClick={() => setStatus(s.id)} />
        ))}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 px-4 py-16 text-center">
          <p className="text-sm text-slate-500">No jobs {status ? "in this status" : "yet"}.</p>
          <Link to="/ledger/jobs/new" className="mt-3 inline-block text-sm font-semibold text-slate-900 underline">
            Create the first one →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((j) => (
            <JobCard key={j.id} {...j} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

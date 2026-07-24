import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { getHomeBriefing, type BriefingJob } from "@/lib/os/home.functions";
import { getAdminToken } from "@/lib/session";
import { JobCard } from "@/components/os/JobCard";
import { BriefingRow } from "@/components/os/BriefingRow";

export const Route = createFileRoute("/ledger/")({
  head: () => ({
    meta: [
      { title: "Today — Clockwise OS" },
      { name: "description", content: "Your daily briefing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LedgerHome,
});

function LedgerHome() {
  const token = getAdminToken();
  const { data, isLoading } = useQuery({
    queryKey: ["os-briefing"],
    queryFn: () => getHomeBriefing({ data: { token: token! } }),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="mt-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in as admin</h1>
        <p className="mt-2 text-sm text-slate-500">Head to the Clockwise tab to sign in.</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-8">
      <header className="pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{today}</p>
        <h1
          className="mt-1 text-[34px] leading-tight font-semibold text-slate-900"
          style={{ fontFamily: '"Bricolage Grotesque", serif', letterSpacing: "-0.035em" }}
        >
          Good morning.
        </h1>
        <p className="mt-1 text-[15px] text-slate-500">Here's what's happening across your jobs.</p>
      </header>

      <Link
        to="/ledger/jobs/new"
        className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm transition-transform hover:scale-[0.995] active:scale-[0.99]"
      >
        <div>
          <p className="text-sm font-semibold">Start a new job</p>
          <p className="text-xs text-slate-300">One decision per screen.</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <Plus className="h-5 w-5" />
        </div>
      </Link>

      {isLoading && <div className="py-12 text-center text-sm text-slate-400">Loading…</div>}

      {data && (
        <>
          <Section title="Today's Jobs" jobs={data.today} empty="No active jobs yet." />
          <Section title="Estimates Waiting" jobs={data.estimates} empty="No estimates in the pipeline." />
          <Section title="Jobs Requiring Action" jobs={data.action} empty="Nothing needs your attention." />

          <BriefingRow title="Workers Currently Clocked In" empty="Live worker data connects in Phase 2.">
            <div />
          </BriefingRow>

          <BriefingRow title="Payments Waiting" empty="No outstanding invoices this phase.">
            <div />
          </BriefingRow>

          <Section title="Recently Updated" jobs={data.recent} empty="Create your first job to see it here." />
        </>
      )}
    </div>
  );
}

function Section({ title, jobs, empty }: { title: string; jobs: BriefingJob[]; empty: string }) {
  return (
    <BriefingRow title={title} count={jobs.length} empty={empty}>
      <div className="grid gap-3 sm:grid-cols-2">
        {jobs.map((j) => (
          <JobCard key={j.id} {...j} />
        ))}
      </div>
    </BriefingRow>
  );
}

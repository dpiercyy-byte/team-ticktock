import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLedgerJobs } from "@/lib/ledger-client";
import { JobCard } from "@/components/ledger/JobCard";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Briefcase } from "lucide-react";

export const Route = createFileRoute("/ledger/active")({
  component: LedgerActive,
});

function LedgerActive() {
  const { data, isLoading } = useLedgerJobs();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const active = (data ?? []).filter((j) => !j.finish_date);
    if (!q.trim()) return active;
    const s = q.toLowerCase();
    return active.filter((j) => j.address.toLowerCase().includes(s) || (j.client_name || "").toLowerCase().includes(s));
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl md:text-3xl text-slate-900">Active Jobs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Projects still in progress</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search address or client" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 pill-card border-0 shadow-none" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="pill-card p-10 text-center text-slate-500 flex flex-col items-center gap-3">
          <Briefcase className="w-8 h-8 text-slate-300" />
          <div>No active jobs. Upload one from the Sync tab.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((j) => <JobCard key={j.id} job={j} />)}
        </div>
      )}
    </div>
  );
}

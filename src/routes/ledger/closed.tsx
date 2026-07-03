import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLedgerJobs } from "@/lib/ledger-client";
import { JobCard } from "@/components/ledger/JobCard";
import { Input } from "@/components/ui/input";
import { Loader2, Search, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/ledger/closed")({
  component: LedgerClosed,
});

function LedgerClosed() {
  const { data, isLoading } = useLedgerJobs();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const closed = (data ?? []).filter((j) => !!j.finish_date);
    if (!q.trim()) return closed;
    const s = q.toLowerCase();
    return closed.filter((j) => j.address.toLowerCase().includes(s) || (j.client_name || "").toLowerCase().includes(s));
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl md:text-3xl text-slate-900">Closed Jobs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Completed projects, sorted newest first</p>
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
          <CheckCircle2 className="w-8 h-8 text-slate-300" />
          <div>No closed jobs yet.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((j) => <JobCard key={j.id} job={j} />)}
        </div>
      )}
    </div>
  );
}

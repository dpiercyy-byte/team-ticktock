import { Link } from "@tanstack/react-router";
import { MapPin, Users } from "lucide-react";
import type { LedgerJob } from "@/lib/ledger.functions";
import { formatCurrency, statusTone } from "./ledger-ui";

export function JobCard({ job, compact = false }: { job: LedgerJob; compact?: boolean }) {
  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: job.id }}
      className="block rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{job.projectType}</p>
          <h3 className="mt-1 truncate text-lg font-semibold tracking-tight md:text-xl">
            {job.name}
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">{job.client.name}</p>
        </div>
        <span className={"shrink-0 rounded-full px-3 py-1 text-[11px] font-medium " + statusTone(job.status)}>
          {job.status}
        </span>
      </div>

      {!compact && (
        <>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{job.address}</span>
          </div>

          <div className="mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{job.progress}% complete</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {job.workersOnSite} on site
              </span>
            </div>
          </div>

          {job.budget > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
              <Stat label="Budget" value={formatCurrency(job.budget)} />
              <Stat label="Collected" value={formatCurrency(job.collected)} />
              <Stat label="Profit" value={formatCurrency(job.collected - job.expenses)} />
            </div>
          )}
        </>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { MapPin, Users } from "lucide-react";
import type { LedgerJob } from "@/lib/ledger.functions";
import { formatCurrency, statusTone } from "./ledger-ui";
import { JobJourney } from "./JobJourney";

export function JobCard({ job, compact = false }: { job: LedgerJob; compact?: boolean }) {
  const remaining = job.budget - job.collected;
  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: job.id }}
      className="l-card block p-4 md:p-5"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <span className={statusTone(job.status)}>{job.status}</span>
        {job.budget > 0 && (
          <span className="shrink-0 text-right text-[15px] font-bold tabular-nums">
            {formatCurrency(job.budget)}
          </span>
        )}
      </div>

      <h3 className="mt-2.5 truncate text-[17px] font-bold tracking-tight md:text-lg">
        {job.name}
      </h3>
      <p className="mt-0.5 truncate text-[13px] l-muted">{job.client.name}</p>
      <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[12px] l-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{job.address}</span>
      </p>

      {!compact && job.trades.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.trades.slice(0, 4).map((t) => (
            <span key={t} className="l-pill l-pill--sm">
              {t}
            </span>
          ))}
          {job.trades.length > 4 && (
            <span className="l-pill l-pill--sm">+{job.trades.length - 4}</span>
          )}
        </div>
      )}


      <div className="mt-4">
        <JobJourney status={job.status} compact />
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[12px] l-muted">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {job.workersOnSite === 0 ? "No one on site" : `${job.workersOnSite} on site`}
          </span>
        </span>
        {job.budget > 0 && (
          <span className={"shrink-0 tabular-nums font-semibold " + (remaining > 0 ? "l-accent" : "l-green")}>
            {remaining > 0 ? `${formatCurrency(remaining)} owing` : "Paid in full"}
          </span>
        )}
      </div>
    </Link>
  );
}

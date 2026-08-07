import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { LedgerJob } from "@/lib/ledger.functions";
import { formatCurrency, statusTone } from "./ledger-ui";

/** Street number + street name, i.e. everything before the first comma. */
function streetLine(job: LedgerJob) {
  const first = (job.address || "").split(",")[0]?.trim();
  return first || job.name;
}

export function JobCard({ job, compact = false }: { job: LedgerJob; compact?: boolean }) {
  const isActive = (job.status ?? "").toLowerCase() === "active";
  const tone = isActive
    ? "border-l-4 border-l-[var(--success)] bg-[color-mix(in_oklab,var(--success)_4%,transparent)]"
    : "border-l-4 border-l-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_4%,transparent)]";

  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: job.id }}
      className={`l-card block p-5 md:p-6 ${tone}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <span className={statusTone(job.status)}>{job.status}</span>
        {job.budget > 0 && (
          <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums">
            {formatCurrency(job.budget)}
          </span>
        )}
      </div>

      <h3 className="mt-3.5 truncate text-[18px] font-semibold tracking-[-0.02em] md:text-[19px]">
        {streetLine(job)}
      </h3>
      <p className="mt-1.5 truncate text-[13px] l-muted">{job.client.name}</p>
      <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-[12.5px] l-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{job.address}</span>
      </p>

      {!compact && job.trades.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
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
    </Link>
  );
}

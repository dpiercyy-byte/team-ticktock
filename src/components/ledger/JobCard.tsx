import { Link } from "@tanstack/react-router";
import type { LedgerJob } from "@/lib/ledger.functions";
import { formatCurrency } from "./ledger-ui";
import { jobCosts, marginOf } from "@/lib/job-costs";
import { JobProfitBar } from "./JobProfitBar";

/** Street number + street name, i.e. everything before the first comma. */
function streetLine(job: LedgerJob) {
  const first = (job.address || "").split(",")[0]?.trim();
  return first || job.name;
}

function Figure({
  label,
  value,
  tone,
  align = "left",
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
  align?: "left" | "right";
}) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] l-muted">
        {label}
      </p>
      <p
        className="mt-1 truncate text-[15px] font-bold tabular-nums"
        style={{
          color:
            tone === "green"
              ? "var(--success)"
              : tone === "red"
                ? "var(--destructive)"
                : undefined,
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function JobCard({ job }: { job: LedgerJob; compact?: boolean }) {
  const isActive = (job.status ?? "").toLowerCase() === "active";
  const title = streetLine(job);
  const costs = jobCosts(job);
  const margin = marginOf(job);

  const accent = isActive
    ? "border-l-4 border-l-[var(--success)]"
    : "border-l-4 border-l-[var(--warning)]";
  const pill = isActive
    ? "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]"
    : "bg-[color-mix(in_oklab,var(--warning)_22%,transparent)] text-[var(--warning-foreground)]";

  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: job.id }}
      className={`l-card-cw block overflow-hidden ${accent}`}
    >
      <div className="px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold tracking-[-0.02em]">{title}</p>
            <p className="mt-0.5 truncate text-[12px] l-muted">{job.client.name}</p>
            {job.address && <p className="truncate text-[12px] l-muted">{job.address}</p>}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill}`}
          >
            {job.status}
          </span>
        </div>
      </div>

      <div className="px-5 pb-4 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <Figure label="Total budget" value={formatCurrency(job.budget)} />
          <Figure label="Actual costs" value={formatCurrency(costs.total)} />
          <Figure
            label="Remaining margin"
            value={formatCurrency(margin)}
            tone={margin < 0 ? "red" : "green"}
            align="right"
          />
        </div>
        <JobProfitBar budget={job.budget} cost={costs.total} />
      </div>
    </Link>
  );
}

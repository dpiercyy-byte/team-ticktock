import { Link } from "@tanstack/react-router";
import type { LedgerJob } from "@/lib/ledger.functions";
import { formatCurrency } from "./ledger-ui";

/** Street number + street name, i.e. everything before the first comma. */
function streetLine(job: LedgerJob) {
  const first = (job.address || "").split(",")[0]?.trim();
  return first || job.name;
}

function initialsOf(label: string) {
  return (
    label
      .split(/\s+/)
      .map((p) => p[0])
      .filter((c) => c && /[a-z0-9]/i.test(c))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function Row({ label, sub, value }: { label: string; sub?: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {value && <span className="shrink-0 tabular-nums font-semibold">{value}</span>}
    </div>
  );
}

export function JobCard({ job, compact = false }: { job: LedgerJob; compact?: boolean }) {
  const isActive = (job.status ?? "").toLowerCase() === "active";
  const title = streetLine(job);
  const accent = isActive
    ? "border-l-4 border-l-[var(--success)] bg-[color-mix(in_oklab,var(--success)_4%,transparent)]"
    : "border-l-4 border-l-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_4%,transparent)]";
  const pill = isActive
    ? "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]"
    : "bg-[color-mix(in_oklab,var(--warning)_22%,transparent)] text-[var(--warning-foreground)]";

  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: job.id }}
      className={`l-card-cw block overflow-hidden ${accent}`}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {initialsOf(title)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-[-0.02em]">{title}</p>
          <span
            className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm ${pill}`}
          >
            ● {job.status}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-5 pb-4">
        <Row label="Client" sub={job.client.name} />
        <Row label="Address" sub={job.address} />
        {!compact && job.trades.length > 0 && (
          <Row
            label="Trades"
            sub={
              job.trades.slice(0, 3).join(" · ") +
              (job.trades.length > 3 ? ` +${job.trades.length - 3}` : "")
            }
          />
        )}
      </div>

      {job.budget > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/60 px-5 py-3">
          <p className="text-xs text-muted-foreground">Budget</p>
          <p className="tabular-nums text-lg font-bold text-[var(--success)]">
            {formatCurrency(job.budget)}
          </p>
        </div>
      )}
    </Link>
  );
}

import { costPercent, costTone } from "@/lib/job-costs";
import { formatCurrency } from "./ledger-ui";

const TONE_BG: Record<string, string> = {
  healthy: "var(--success)",
  warning: "var(--warning)",
  over: "var(--destructive)",
  none: "var(--muted-foreground)",
};

export function JobProfitBar({ budget, cost }: { budget: number; cost: number }) {
  const tone = costTone(budget, cost);
  const pct = costPercent(budget, cost);
  const over = tone === "over" ? cost - budget : 0;

  return (
    <div className="mt-3">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "color-mix(in oklab, var(--foreground) 8%, transparent)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Costs against budget"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${tone === "none" ? 0 : Math.max(pct, 2)}%`, background: TONE_BG[tone] }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] l-muted">
        <span>{tone === "none" ? "No budget set" : `${pct}% of budget spent`}</span>
        {over > 0 && (
          <span className="font-semibold" style={{ color: "var(--destructive)" }}>
            {formatCurrency(over)} over
          </span>
        )}
      </div>
    </div>
  );
}

import { formatCurrency } from "./ledger-ui";

function Metric({
  label,
  caption,
  value,
  tone,
}: {
  label: string;
  caption: string;
  value: number;
  tone?: "green" | "red";
}) {
  return (
    <div className="min-w-0 px-4 py-4 md:px-5 md:py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{label}</p>
      <p
        className="mt-2 truncate text-[22px] font-bold tabular-nums tracking-[-0.02em] md:text-[26px]"
        style={{
          color:
            tone === "green"
              ? "var(--success)"
              : tone === "red"
                ? "var(--destructive)"
                : undefined,
        }}
      >
        {formatCurrency(value)}
      </p>
      <p className="mt-1 truncate text-[11px] opacity-55">{caption}</p>
    </div>
  );
}

export function FinanceSummary({
  budgets,
  costs,
  expectedProfit,
}: {
  budgets: number;
  costs: number;
  expectedProfit: number;
}) {
  return (
    <section className="l-card overflow-hidden">
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric label="Total active budgets" caption="Across all active jobs" value={budgets} />
        <Metric label="Total costs (MTD)" caption="Recorded to date" value={costs} />
        <Metric
          label="Expected profit"
          caption="Budgets less recorded costs"
          value={expectedProfit}
          tone={expectedProfit < 0 ? "red" : "green"}
        />
      </div>
    </section>
  );
}

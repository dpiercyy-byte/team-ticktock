import { ReactNode } from "react";
import { fmtMoney, fmtPct } from "@/lib/ledger-client";

type Tone = "ink" | "positive" | "warning";

const toneMap: Record<Tone, { chip: string; value: string }> = {
  ink: { chip: "bg-slate-900/5 text-slate-700", value: "text-slate-900" },
  positive: { chip: "bg-emerald-500/10 text-emerald-700", value: "text-emerald-700" },
  warning: { chip: "bg-amber-500/10 text-amber-700", value: "text-amber-700" },
};

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "ink",
  valueType = "money",
  icon,
  testid,
}: {
  label: string;
  value: number;
  sublabel?: string;
  tone?: Tone;
  valueType?: "money" | "pct";
  icon?: ReactNode;
  testid?: string;
}) {
  const t = toneMap[tone];
  const display = valueType === "pct" ? fmtPct(value) : fmtMoney(value, { compact: true });
  return (
    <div className="pill-card p-5 md:p-6 flex flex-col gap-3 fade-up" data-testid={testid}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
        {icon && <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${t.chip}`}>{icon}</span>}
      </div>
      <div className={`display text-3xl md:text-4xl num ${t.value}`}>{display}</div>
      {sublabel && <div className="text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}

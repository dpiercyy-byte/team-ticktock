import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { KpiCard } from "./KpiCard";
import { DollarSign, TrendingUp, Percent, Receipt } from "lucide-react";
import { LedgerJob, fmtMoney, fmtPct, monthKey, monthKeySortable } from "@/lib/ledger-client";

const LEAD_COLORS: Record<string, string> = {
  referral: "#10b981",
  repeat: "#6366f1",
  designer: "#f59e0b",
  website: "#0ea5e9",
  unknown: "#94a3b8",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="pill-card px-3 py-2 text-xs" style={{ background: "white" }}>
      <div className="font-semibold text-slate-900 mb-0.5">{label || payload[0].name}</div>
      <div className="num text-slate-700">{fmtMoney(payload[0].value)}</div>
    </div>
  );
};

export function ExecutiveDashboard({ jobs }: { jobs: LedgerJob[] }) {
  const closed = useMemo(() => jobs.filter((j) => j.finish_date), [jobs]);
  const totalGross = useMemo(() => jobs.reduce((s, j) => s + (j.total_price || 0), 0), [jobs]);
  const totalNet = useMemo(() => closed.reduce((s, j) => s + (j.net || 0), 0), [closed]);
  const avgMargin = useMemo(() => {
    if (closed.length === 0) return 0;
    return closed.reduce((s, j) => s + (j.profit_margin || 0), 0) / closed.length;
  }, [closed]);
  const totalTax = useMemo(() => jobs.reduce((s, j) => s + (j.gross_with_hst || 0), 0), [jobs]);

  const monthlyRevenue = useMemo(() => {
    const map = new Map<string, { key: string; label: string; revenue: number }>();
    closed.forEach((j) => {
      const k = monthKeySortable(j.finish_date);
      if (!k) return;
      const label = monthKey(j.finish_date) || k;
      const entry = map.get(k) || { key: k, label, revenue: 0 };
      entry.revenue += j.total_price || 0;
      map.set(k, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [closed]);

  const leadBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    jobs.forEach((j) => {
      const k = (j.lead_source || "unknown").toLowerCase();
      map.set(k, (map.get(k) || 0) + (j.total_price || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [jobs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Gross Revenue" value={totalGross} sublabel={`${jobs.length} projects tracked`} tone="ink" icon={<DollarSign className="w-4 h-4" />} />
        <KpiCard label="Net Revenue" value={totalNet} sublabel={`${closed.length} closed out jobs`} tone="positive" icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="Avg Profit Margin" value={avgMargin} valueType="pct" sublabel={avgMargin < 0.15 ? "Below healthy threshold" : "Across closed jobs"} tone={avgMargin < 0.15 ? "warning" : "positive"} icon={<Percent className="w-4 h-4" />} />
        <KpiCard label="Total Tax Liabilities" value={totalTax} sublabel="Sum of Gross with HST" tone="ink" icon={<Receipt className="w-4 h-4" />} />
      </div>

      <div className="pill-card p-6 md:p-8 fade-up">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h2 className="display text-2xl md:text-3xl text-slate-900">Revenue by Month</h2>
            <p className="text-sm text-slate-500 mt-1">Sum of Total Price, grouped by Finish Date</p>
          </div>
          <span className="text-xs uppercase tracking-wider text-slate-500 num">{monthlyRevenue.length} months</span>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} tickFormatter={(v: number) => fmtMoney(v, { compact: true })} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
              <Bar dataKey="revenue" fill="#0f172a" radius={[8, 8, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="pill-card p-6 md:p-8 lg:col-span-3 fade-up">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="display text-2xl md:text-3xl text-slate-900">Revenue by Lead Source</h2>
              <p className="text-sm text-slate-500 mt-1">Where the money comes from</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={leadBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={72} outerRadius={120} paddingAngle={3} stroke="none">
                  {leadBreakdown.map((e, i) => (
                    <Cell key={i} fill={LEAD_COLORS[e.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" iconType="circle" formatter={(v: string) => <span className="text-slate-600 text-sm capitalize">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="pill-card p-6 md:p-8 lg:col-span-2 fade-up">
          <h3 className="display text-xl text-slate-900 mb-4">Source breakdown</h3>
          <div className="space-y-3">
            {leadBreakdown
              .sort((a, b) => b.value - a.value)
              .map((s) => {
                const pct = totalGross > 0 ? s.value / totalGross : 0;
                return (
                  <div key={s.name}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEAD_COLORS[s.name] || "#94a3b8" }} />
                        <span className="text-sm text-slate-700 capitalize">{s.name}</span>
                      </div>
                      <div className="text-sm num text-slate-900 font-semibold">
                        {fmtMoney(s.value, { compact: true })}
                        <span className="text-slate-400 font-normal"> · {fmtPct(pct, 0)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct * 100}%`, background: LEAD_COLORS[s.name] || "#94a3b8" }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

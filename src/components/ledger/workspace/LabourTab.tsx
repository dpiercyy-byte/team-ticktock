import { formatCurrency } from "@/components/ledger/ledger-ui";
import { Empty, SectionTitle, fmtDate } from "./ui";
import type { LabourRow } from "@/lib/workspace-math";

export function LabourTab({
  rows,
  totals,
}: {
  rows: LabourRow[];
  totals: { hours: number; cost: number; flagged: number };
}) {
  return (
    <div>
      <section className="l-card p-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Hours" value={totals.hours.toFixed(2)} />
          <Stat label="Labour cost" value={formatCurrency(totals.cost)} />
          <Stat label="Flagged" value={String(totals.flagged)} />
        </div>
        <p className="mt-3 text-[11px] l-muted">
          Calculated live from Clockwise time entries on this job site.
        </p>
      </section>

      <div className="mt-4">
        <SectionTitle hint={`${rows.length} entr${rows.length === 1 ? "y" : "ies"}`}>
          Time entries
        </SectionTitle>
        {rows.length === 0 ? (
          <Empty>No time has been logged against this job yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {rows.map((r) => (
              <li key={r.id} className="l-card px-4 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                  <p className="truncate text-[14px] font-semibold">{r.worker}</p>
                  <p className="shrink-0 text-[13px] font-bold tabular-nums l-accent">
                    {formatCurrency(r.cost)}
                  </p>
                </div>
                <p className="mt-0.5 text-[12px] l-muted">
                  {fmtDate(r.date)} · {r.hours.toFixed(2)} h @ {formatCurrency(r.rate)}/h
                  {r.open ? " · still clocked in" : ""}
                </p>
                {(r.flagged || r.geoStatus === "offsite") && (
                  <p className="mt-1 text-[11px] font-semibold l-red">
                    {[r.flagged ? "Flagged for review" : null, r.geoStatus === "offsite" ? "Off-site GPS" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] l-muted">{label}</p>
      <p className="mt-1 truncate text-[18px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

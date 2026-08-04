import { formatCurrency } from "@/components/ledger/ledger-ui";
import { Empty, SectionTitle, fmtDate } from "./ui";
import type { CostRow } from "@/lib/workspace-math";

export function CostsTab({
  rows,
  totals,
}: {
  rows: CostRow[];
  totals: { total: number; billable: number; needsReview: number };
}) {
  return (
    <div>
      <section className="l-card p-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Materials" value={formatCurrency(totals.total)} />
          <Stat label="Client billable" value={formatCurrency(totals.billable)} />
          <Stat label="Needs review" value={String(totals.needsReview)} />
        </div>
        <p className="mt-3 text-[11px] l-muted">
          Pulled from Clockwise receipts and reimbursements allocated to this job site.
        </p>
      </section>

      <div className="mt-4">
        <SectionTitle hint={`${rows.length} receipt${rows.length === 1 ? "" : "s"}`}>
          Receipts
        </SectionTitle>
        {rows.length === 0 ? (
          <Empty>No receipts are allocated to this job site yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {rows.map((r) => (
              <li key={r.id} className="l-card px-4 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                  <p className="truncate text-[14px] font-semibold">{r.vendor}</p>
                  <p className="shrink-0 text-[13px] font-bold tabular-nums">
                    {formatCurrency(r.total)}
                  </p>
                </div>
                <p className="mt-0.5 text-[12px] l-muted">
                  {fmtDate(r.date)} · {r.payee}
                  {r.category ? ` · ${r.category}` : ""}
                  {r.subtotal != null ? ` · sub ${formatCurrency(r.subtotal)}` : ""}
                  {r.tax != null ? ` · tax ${formatCurrency(r.tax)}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {r.billable && <span className="l-pill">Client billable</span>}
                  {r.needsReview && <span className="l-pill">Needs review</span>}
                  {r.receiptUrl && (
                    <a
                      href={r.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-semibold l-accent"
                    >
                      View receipt
                    </a>
                  )}
                </div>
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/components/ledger/ledger-ui";
import { getAdminToken } from "@/lib/session";
import {
  deleteChangeOrder,
  deleteProjectCost,
  saveChangeOrder,
  saveProjectCost,
} from "@/lib/finance.functions";
import type {
  ChangeOrderRow,
  ChangeOrderStatus,
  ProjectCostCategory,
  ProjectCostRow,
  ProjectFinancials,
} from "@/lib/finance-math";
import { Empty, SectionTitle, fmtDate } from "./ui";

const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
const money = (n: number | null) => (n == null ? "—" : formatCurrency(n));

const CATEGORY_LABEL: Record<ProjectCostCategory, string> = {
  subcontractor: "Subcontractor",
  permit: "Permit / fee",
  other: "Other cost",
};

type CoDraft = {
  id: string | null;
  description: string;
  amount: string;
  status: ChangeOrderStatus;
  approvedDate: string;
  notes: string;
};
type CostDraft = {
  id: string | null;
  category: ProjectCostCategory;
  description: string;
  vendor: string;
  amount: string;
  incurredOn: string;
  clientBillable: boolean;
  notes: string;
};

const emptyCo: CoDraft = {
  id: null,
  description: "",
  amount: "",
  status: "draft",
  approvedDate: "",
  notes: "",
};
const emptyCost: CostDraft = {
  id: null,
  category: "subcontractor",
  description: "",
  vendor: "",
  amount: "",
  incurredOn: "",
  clientBillable: false,
  notes: "",
};

const inputCls =
  "w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none";

export function FinancialsTab({
  projectId,
  financials,
  changeOrders,
  projectCosts,
  exportState,
  counts,
}: {
  projectId: string;
  financials: ProjectFinancials;
  changeOrders: ChangeOrderRow[];
  projectCosts: ProjectCostRow[];
  exportState: { lastExportedAt: string | null; inSync: boolean | null };
  counts: { labourEntries: number; receipts: number; payments: number };
}) {
  const qc = useQueryClient();
  const saveCo = useServerFn(saveChangeOrder);
  const delCo = useServerFn(deleteChangeOrder);
  const saveCost = useServerFn(saveProjectCost);
  const delCost = useServerFn(deleteProjectCost);
  const [coDraft, setCoDraft] = useState<CoDraft | null>(null);
  const [costDraft, setCostDraft] = useState<CostDraft | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["ledger", "workspace", projectId] });
  const token = () => {
    const t = getAdminToken();
    if (!t) throw new Error("Not signed in");
    return t;
  };

  const coSave = useMutation({
    mutationFn: async (d: CoDraft) =>
      saveCo({
        data: {
          token: token(),
          id: d.id,
          projectId,
          description: d.description.trim(),
          amount: Number(d.amount || 0),
          status: d.status,
          approvedDate: d.approvedDate || null,
          notes: d.notes.trim() || null,
        },
      }),
    onSuccess: async () => {
      setCoDraft(null);
      await invalidate();
    },
  });
  const coDelete = useMutation({
    mutationFn: async (id: string) => delCo({ data: { token: token(), id } }),
    onSuccess: invalidate,
  });
  const costSave = useMutation({
    mutationFn: async (d: CostDraft) =>
      saveCost({
        data: {
          token: token(),
          id: d.id,
          projectId,
          category: d.category,
          description: d.description.trim(),
          vendor: d.vendor.trim() || null,
          amount: Number(d.amount || 0),
          incurredOn: d.incurredOn || null,
          clientBillable: d.clientBillable,
          notes: d.notes.trim() || null,
        },
      }),
    onSuccess: async () => {
      setCostDraft(null);
      await invalidate();
    },
  });
  const costDelete = useMutation({
    mutationFn: async (id: string) => delCost({ data: { token: token(), id } }),
    onSuccess: invalidate,
  });

  const { revenue, costs, results } = financials;

  return (
    <div className="grid gap-4">
      {/* Headline */}
      <section className="l-card p-5">
        <div className="grid grid-cols-2 gap-4">
          <Big label="Total revenue" value={formatCurrency(results.totalRevenue)} />
          <Big label="Total cost" value={formatCurrency(results.totalCost)} />
          <Big
            label="Gross profit (actual)"
            value={formatCurrency(results.grossProfit)}
            sub={`${pct(results.grossMargin)} margin`}
          />
          <Big
            label="Forecast at completion"
            value={money(results.forecastProfit)}
            sub={
              results.forecastProfit == null
                ? "Needs more recorded progress"
                : `${pct(results.forecastMargin)} projected`
            }
            muted
          />
        </div>
        <p className="mt-3 text-[11px] l-muted">
          Actual figures come from recorded records. Forecast figures extrapolate recorded cost
          over reported progress and are projections, not results.
        </p>
      </section>

      {/* Revenue */}
      <section>
        <SectionTitle hint={`${pct(results.percentCollected)} collected`}>Revenue</SectionTitle>
        <div className="l-card p-4">
          <Line label="Original accepted contract" value={revenue.originalContract} />
          <Line label="Approved change orders" value={revenue.approvedChangeOrders} />
          <Line label="Revised contract value" value={revenue.revisedContract} strong />
          <Line
            label="Payments received"
            value={revenue.received}
            hint={`${counts.payments} payment records`}
          />
          <Line label="Outstanding balance" value={revenue.outstanding} strong />
          {revenue.pendingChangeOrders !== 0 && (
            <Line
              label="Draft change orders (not counted)"
              value={revenue.pendingChangeOrders}
              muted
            />
          )}
        </div>
      </section>

      {/* Costs */}
      <section>
        <SectionTitle hint="company cost">Costs</SectionTitle>
        <div className="l-card p-4">
          <Line
            label="Clockwise labour cost"
            value={costs.labourCost}
            hint={`${counts.labourEntries} time entries`}
          />
          <Line label="Materials" value={costs.materials} hint={`${counts.receipts} receipts`} />
          <Line label="Worker reimbursements" value={costs.reimbursements} />
          <Line label="Subcontractors" value={costs.subcontractors} />
          <Line label="Permits and fees" value={costs.permits} />
          <Line label="Other project costs" value={costs.other} />
          <Line label="Total cost" value={costs.totalCost} strong />
          <Line
            label="Client-billable purchases (recovered, not a cost)"
            value={costs.clientBillableTotal}
            muted
          />
        </div>
      </section>

      {/* Reconciliation */}
      <section className="l-card p-4">
        <div className="flex items-start gap-2">
          {exportState.inSync === false ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 l-red" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0 l-accent" />
          )}
          <div>
            <p className="text-[13px] font-semibold">
              {exportState.lastExportedAt == null
                ? "Not exported to Sheets yet"
                : exportState.inSync === false
                  ? "Sheet row is out of date"
                  : "Sheet row matches these records"}
            </p>
            <p className="mt-0.5 text-[12px] l-muted">
              {exportState.lastExportedAt
                ? `Last exported ${fmtDate(exportState.lastExportedAt)}. `
                : ""}
              These records are the source of truth; Google Sheets is a reporting copy. This is
              operational job costing, not a formal accounting ledger.
            </p>
          </div>
        </div>
      </section>

      {/* Change orders */}
      <section>
        <SectionTitle hint={`${changeOrders.length} total`}>Change orders</SectionTitle>
        {changeOrders.length === 0 && !coDraft ? (
          <Empty>No change orders recorded.</Empty>
        ) : (
          <ul className="grid gap-2">
            {changeOrders.map((c) => (
              <li key={c.id} className="l-card px-4 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                  <p className="truncate text-[14px] font-semibold">{c.description}</p>
                  <p className="shrink-0 text-[13px] font-bold tabular-nums">
                    {formatCurrency(c.amount)}
                  </p>
                </div>
                <p className="mt-0.5 text-[12px] l-muted">
                  {c.status === "approved"
                    ? `Approved${c.approvedDate ? ` ${fmtDate(c.approvedDate)}` : ""}`
                    : c.status === "rejected"
                      ? "Rejected"
                      : "Draft — not in revised contract"}
                  {c.notes ? ` · ${c.notes}` : ""}
                </p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    className="text-[12px] font-semibold l-accent"
                    onClick={() =>
                      setCoDraft({
                        id: c.id,
                        description: c.description,
                        amount: String(c.amount),
                        status: c.status,
                        approvedDate: c.approvedDate ?? "",
                        notes: c.notes ?? "",
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold l-red"
                    onClick={() => coDelete.mutate(c.id)}
                    disabled={coDelete.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {coDraft ? (
          <form
            className="l-card mt-3 grid gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (coDraft.description.trim()) coSave.mutate(coDraft);
            }}
          >
            <input
              autoFocus
              value={coDraft.description}
              onChange={(e) => setCoDraft({ ...coDraft, description: e.target.value })}
              placeholder="Added bathroom tile, extra framing…"
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                value={coDraft.amount}
                onChange={(e) => setCoDraft({ ...coDraft, amount: e.target.value })}
                placeholder="Amount"
                className={inputCls}
              />
              <select
                value={coDraft.status}
                onChange={(e) =>
                  setCoDraft({ ...coDraft, status: e.target.value as ChangeOrderStatus })
                }
                className={inputCls}
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            {coDraft.status === "approved" && (
              <input
                type="date"
                value={coDraft.approvedDate}
                onChange={(e) => setCoDraft({ ...coDraft, approvedDate: e.target.value })}
                className={inputCls}
              />
            )}
            <textarea
              value={coDraft.notes}
              onChange={(e) => setCoDraft({ ...coDraft, notes: e.target.value })}
              placeholder="Notes"
              rows={2}
              className={`${inputCls} resize-none`}
            />
            <FormActions
              onCancel={() => setCoDraft(null)}
              pending={coSave.isPending}
              disabled={!coDraft.description.trim()}
              label="Save change order"
            />
          </form>
        ) : (
          <AddButton onClick={() => setCoDraft(emptyCo)}>Add change order</AddButton>
        )}
      </section>

      {/* Other costs */}
      <section>
        <SectionTitle hint={`${projectCosts.length} recorded`}>
          Subcontractors, permits and other costs
        </SectionTitle>
        {projectCosts.length === 0 && !costDraft ? (
          <Empty>No manual project costs recorded. Labour and receipts pull in automatically.</Empty>
        ) : (
          <ul className="grid gap-2">
            {projectCosts.map((c) => (
              <li key={c.id} className="l-card px-4 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                  <p className="truncate text-[14px] font-semibold">{c.description}</p>
                  <p className="shrink-0 text-[13px] font-bold tabular-nums">
                    {formatCurrency(c.amount)}
                  </p>
                </div>
                <p className="mt-0.5 text-[12px] l-muted">
                  {CATEGORY_LABEL[c.category]}
                  {c.vendor ? ` · ${c.vendor}` : ""}
                  {c.incurredOn ? ` · ${fmtDate(c.incurredOn)}` : ""}
                  {c.clientBillable ? " · client-billable" : ""}
                  {c.notes ? ` · ${c.notes}` : ""}
                </p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    className="text-[12px] font-semibold l-accent"
                    onClick={() =>
                      setCostDraft({
                        id: c.id,
                        category: c.category,
                        description: c.description,
                        vendor: c.vendor ?? "",
                        amount: String(c.amount),
                        incurredOn: c.incurredOn ?? "",
                        clientBillable: c.clientBillable,
                        notes: c.notes ?? "",
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold l-red"
                    onClick={() => costDelete.mutate(c.id)}
                    disabled={costDelete.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {costDraft ? (
          <form
            className="l-card mt-3 grid gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (costDraft.description.trim()) costSave.mutate(costDraft);
            }}
          >
            <input
              autoFocus
              value={costDraft.description}
              onChange={(e) => setCostDraft({ ...costDraft, description: e.target.value })}
              placeholder="Electrical rough-in, building permit…"
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={costDraft.category}
                onChange={(e) =>
                  setCostDraft({
                    ...costDraft,
                    category: e.target.value as ProjectCostCategory,
                  })
                }
                className={inputCls}
              >
                <option value="subcontractor">Subcontractor</option>
                <option value="permit">Permit / fee</option>
                <option value="other">Other cost</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={costDraft.amount}
                onChange={(e) => setCostDraft({ ...costDraft, amount: e.target.value })}
                placeholder="Amount"
                className={inputCls}
              />
              <input
                value={costDraft.vendor}
                onChange={(e) => setCostDraft({ ...costDraft, vendor: e.target.value })}
                placeholder="Vendor"
                className={inputCls}
              />
              <input
                type="date"
                value={costDraft.incurredOn}
                onChange={(e) => setCostDraft({ ...costDraft, incurredOn: e.target.value })}
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={costDraft.clientBillable}
                onChange={(e) =>
                  setCostDraft({ ...costDraft, clientBillable: e.target.checked })
                }
              />
              Client-billable (recovered from client, not a company cost)
            </label>
            <textarea
              value={costDraft.notes}
              onChange={(e) => setCostDraft({ ...costDraft, notes: e.target.value })}
              placeholder="Notes"
              rows={2}
              className={`${inputCls} resize-none`}
            />
            <FormActions
              onCancel={() => setCostDraft(null)}
              pending={costSave.isPending}
              disabled={!costDraft.description.trim()}
              label="Save cost"
            />
          </form>
        ) : (
          <AddButton onClick={() => setCostDraft(emptyCost)}>Add cost</AddButton>
        )}
      </section>
    </div>
  );
}

function Big({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] l-muted">{label}</p>
      <p
        className={`mt-1 truncate text-[20px] font-bold tabular-nums${muted ? " l-muted" : ""}`}
      >
        {value}
      </p>
      {sub && <p className="text-[12px] l-muted">{sub}</p>}
    </div>
  );
}

function Line({
  label,
  value,
  hint,
  strong,
  muted,
}: {
  label: string;
  value: number;
  hint?: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <div className="min-w-0">
        <p className={`text-[13px]${strong ? " font-bold" : ""}${muted ? " l-muted" : ""}`}>
          {label}
        </p>
        {hint && <p className="text-[11px] l-muted">{hint}</p>}
      </div>
      <p
        className={`shrink-0 text-[13px] tabular-nums${strong ? " font-bold" : " font-semibold"}${muted ? " l-muted" : ""}`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full text-[13px] font-bold"
      style={{ background: "var(--l-ink)", color: "var(--l-on-ink)" }}
    >
      <Plus className="h-4 w-4" /> {children}
    </button>
  );
}

function FormActions({
  onCancel,
  pending,
  disabled,
  label,
}: {
  onCancel: () => void;
  pending: boolean;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full px-4 py-2 text-[12px] font-semibold l-muted"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-50"
        style={{ background: "var(--l-accent)", color: "var(--l-on-ink)" }}
      >
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

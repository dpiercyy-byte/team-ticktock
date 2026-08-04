import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/components/ledger/ledger-ui";
import { getAdminToken } from "@/lib/session";
import { deleteProjectPayment, saveProjectPayment } from "@/lib/workspace.functions";
import type { PaymentRow } from "@/lib/workspace-math";
import { Empty, SectionTitle, fmtDate } from "./ui";

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partly paid",
  overdue: "Overdue",
  due: "Scheduled",
};

type Draft = {
  id: string | null;
  description: string;
  amountExpected: string;
  dueDate: string;
  amountReceived: string;
  receivedDate: string;
  method: string;
  notes: string;
};

const emptyDraft: Draft = {
  id: null,
  description: "",
  amountExpected: "",
  dueDate: "",
  amountReceived: "",
  receivedDate: "",
  method: "",
  notes: "",
};

export function PaymentsTab({
  projectId,
  rows,
  totals,
}: {
  projectId: string;
  rows: PaymentRow[];
  totals: { expected: number; received: number; overdue: number };
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveProjectPayment);
  const remove = useServerFn(deleteProjectPayment);
  const [draft, setDraft] = useState<Draft | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["ledger", "workspace", projectId] });

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return save({
        data: {
          token,
          projectId,
          id: d.id,
          description: d.description.trim(),
          amountExpected: Number(d.amountExpected || 0),
          dueDate: d.dueDate || null,
          amountReceived: Number(d.amountReceived || 0),
          receivedDate: d.receivedDate || null,
          method: d.method.trim() || null,
          notes: d.notes.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      setDraft(null);
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return remove({ data: { token, id } });
    },
    onSuccess: invalidate,
  });

  return (
    <div>
      <section className="l-card p-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Expected" value={formatCurrency(totals.expected)} />
          <Stat label="Received" value={formatCurrency(totals.received)} />
          <Stat label="Overdue" value={String(totals.overdue)} />
        </div>
      </section>

      <div className="mt-4">
        <SectionTitle hint={`${rows.length} scheduled`}>Payment register</SectionTitle>
        {rows.length === 0 && !draft ? (
          <Empty>No payments scheduled for this project yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {rows.map((p) => (
              <li key={p.id} className="l-card px-4 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                  <p className="truncate text-[14px] font-semibold">{p.description}</p>
                  <p className="shrink-0 text-[13px] font-bold tabular-nums">
                    {formatCurrency(p.amountExpected)}
                  </p>
                </div>
                <p className="mt-0.5 text-[12px] l-muted">
                  {STATUS_LABEL[p.status]} ·{" "}
                  {p.dueDate ? `due ${fmtDate(p.dueDate)}` : "no due date"}
                  {p.amountReceived > 0
                    ? ` · received ${formatCurrency(p.amountReceived)}${p.receivedDate ? ` on ${fmtDate(p.receivedDate)}` : ""}`
                    : ""}
                  {p.method ? ` · ${p.method}` : ""}
                </p>
                {p.notes && <p className="mt-1 text-[12px] l-muted">{p.notes}</p>}
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    className="text-[12px] font-semibold l-accent"
                    onClick={() =>
                      setDraft({
                        id: p.id,
                        description: p.description,
                        amountExpected: String(p.amountExpected),
                        dueDate: p.dueDate ?? "",
                        amountReceived: p.amountReceived ? String(p.amountReceived) : "",
                        receivedDate: p.receivedDate ?? "",
                        method: p.method ?? "",
                        notes: p.notes ?? "",
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold l-red"
                    onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <form
            className="l-card mt-3 grid gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.description.trim()) saveMutation.mutate(draft);
            }}
          >
            <input
              autoFocus
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Deposit, progress draw, final payment…"
              className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                value={draft.amountExpected}
                onChange={(e) => setDraft({ ...draft, amountExpected: e.target.value })}
                placeholder="Amount expected"
                className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
              />
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
              />
              <input
                type="number"
                step="0.01"
                value={draft.amountReceived}
                onChange={(e) => setDraft({ ...draft, amountReceived: e.target.value })}
                placeholder="Amount received"
                className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
              />
              <input
                type="date"
                value={draft.receivedDate}
                onChange={(e) => setDraft({ ...draft, receivedDate: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
              />
            </div>
            <input
              value={draft.method}
              onChange={(e) => setDraft({ ...draft, method: e.target.value })}
              placeholder="Payment method"
              className="w-full rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
            />
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Notes"
              rows={2}
              className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-[14px] outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-full px-4 py-2 text-[12px] font-semibold l-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!draft.description.trim() || saveMutation.isPending}
                className="rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-50"
                style={{ background: "var(--l-accent)", color: "var(--l-on-ink)" }}
              >
                {saveMutation.isPending ? "Saving…" : "Save payment"}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setDraft(emptyDraft)}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full text-[13px] font-bold"
            style={{ background: "var(--l-ink)", color: "var(--l-on-ink)" }}
          >
            <Plus className="h-4 w-4" /> Add payment
          </button>
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

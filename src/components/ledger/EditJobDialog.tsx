import { useState } from "react";
import { LedgerJob, useUpdateLedgerJob } from "@/lib/ledger-client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ExternalLink, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type LogRow = {
  date?: string | null;
  amount: number;
  comment?: string;
  category?: string;
  vendor?: string;
  method?: string;
  has_hst?: boolean;
};

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function EditJobDialog({
  job, open, onOpenChange,
}: { job: LedgerJob; open: boolean; onOpenChange: (v: boolean) => void }) {
  const update = useUpdateLedgerJob();
  const isSheetLinked = !!job.sheet_id;
  const sheetHref = job.sheet_id ? `https://docs.google.com/spreadsheets/d/${job.sheet_id}/edit` : null;

  // basics
  const [address, setAddress] = useState(job.address ?? "");
  const [clientName, setClientName] = useState(job.client_name ?? "");
  const [startDate, setStartDate] = useState(job.start_date ?? "");
  const [finishDate, setFinishDate] = useState(job.finish_date ?? "");
  // pricing
  const [totalPrice, setTotalPrice] = useState(String(job.total_price ?? 0));
  const [grossCash, setGrossCash] = useState(String(job.gross_cash ?? 0));
  const [grossHst, setGrossHst] = useState(String(job.gross_with_hst ?? 0));
  // costs
  const [finishMat, setFinishMat] = useState(String(job.finish_materials ?? 0));
  const [bldMat, setBldMat] = useState(String(job.building_materials ?? 0));
  const [subs, setSubs] = useState(String(job.subs ?? 0));
  const [labor, setLabor] = useState(String(job.labor ?? 0));
  // logs
  const [priceLog, setPriceLog] = useState<LogRow[]>(job.price_log ?? []);
  const [expenseLog, setExpenseLog] = useState<LogRow[]>(job.expense_log ?? []);
  const [paymentsLog, setPaymentsLog] = useState<LogRow[]>(job.payments_log ?? []);

  async function save() {
    if (isSheetLinked) return;
    try {
      await update.mutateAsync({
        id: job.id,
        patch: {
          address: address.trim(),
          client_name: clientName.trim() || null,
          start_date: startDate || null,
          finish_date: finishDate || null,
          total_price: num(totalPrice),
          gross_cash: num(grossCash),
          gross_with_hst: num(grossHst),
          finish_materials: num(finishMat),
          building_materials: num(bldMat),
          subs: num(subs),
          labor: num(labor),
          price_log: priceLog,
          expense_log: expenseLog,
          payments_log: paymentsLog,
        },
      });
      toast.success("Job updated");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
          <DialogDescription className="truncate">{job.address}</DialogDescription>
        </DialogHeader>

        {isSheetLinked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              This job is linked to a Google Sheet — the sheet is the source of truth. Fields are read-only here.
              {sheetHref && (
                <a href={sheetHref} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 underline">
                  Open sheet <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        <fieldset disabled={isSheetLinked} className="space-y-4">
          <Tabs defaultValue="basics">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basics">Basics</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & costs</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-3 mt-3">
              <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
              <Field label="Client"><Input value={clientName} onChange={(e) => setClientName(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date"><Input type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} /></Field>
                <Field label="Finish date"><Input type="date" value={finishDate ?? ""} onChange={(e) => setFinishDate(e.target.value)} /></Field>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Total price"><Input type="number" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} /></Field>
                <Field label="Gross (cash)"><Input type="number" step="0.01" value={grossCash} onChange={(e) => setGrossCash(e.target.value)} /></Field>
                <Field label="Gross w/ HST"><Input type="number" step="0.01" value={grossHst} onChange={(e) => setGrossHst(e.target.value)} /></Field>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Cost buckets</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Finish materials"><Input type="number" step="0.01" value={finishMat} onChange={(e) => setFinishMat(e.target.value)} /></Field>
                  <Field label="Building materials"><Input type="number" step="0.01" value={bldMat} onChange={(e) => setBldMat(e.target.value)} /></Field>
                  <Field label="Subs"><Input type="number" step="0.01" value={subs} onChange={(e) => setSubs(e.target.value)} /></Field>
                  <Field label="Labor"><Input type="number" step="0.01" value={labor} onChange={(e) => setLabor(e.target.value)} /></Field>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="space-y-5 mt-3">
              <LogEditor
                title="Price log"
                rows={priceLog}
                onChange={setPriceLog}
                columns={[
                  { key: "date", label: "Date", type: "date" },
                  { key: "amount", label: "Amount", type: "number" },
                  { key: "comment", label: "Comment", type: "text" },
                ]}
              />
              <LogEditor
                title="Expenses"
                rows={expenseLog}
                onChange={setExpenseLog}
                columns={[
                  { key: "date", label: "Date", type: "date" },
                  { key: "amount", label: "Amount", type: "number" },
                  { key: "category", label: "Category", type: "text" },
                  { key: "vendor", label: "Vendor", type: "text" },
                ]}
              />
              <LogEditor
                title="Payments"
                rows={paymentsLog}
                onChange={setPaymentsLog}
                columns={[
                  { key: "date", label: "Date", type: "date" },
                  { key: "amount", label: "Amount", type: "number" },
                  { key: "method", label: "Method", type: "text" },
                ]}
              />
            </TabsContent>
          </Tabs>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!isSheetLinked && (
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-medium text-slate-600 mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

type Col = { key: keyof LogRow; label: string; type: "date" | "number" | "text" };

function LogEditor({
  title, rows, onChange, columns,
}: { title: string; rows: LogRow[]; onChange: (r: LogRow[]) => void; columns: Col[] }) {
  function updateCell(i: number, key: keyof LogRow, v: string) {
    const next = rows.slice();
    const row = { ...next[i] };
    if (key === "amount") (row as any)[key] = num(v);
    else (row as any)[key] = v;
    next[i] = row;
    onChange(next);
  }
  function addRow() {
    const blank: LogRow = { date: new Date().toISOString().slice(0, 10), amount: 0 };
    onChange([...rows, blank]);
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add row
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-slate-400 italic px-1">No entries yet</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) auto` }}>
              {columns.map((c) => (
                <Input
                  key={c.key}
                  type={c.type}
                  step={c.type === "number" ? "0.01" : undefined}
                  value={(r as any)[c.key] ?? ""}
                  placeholder={c.label}
                  onChange={(e) => updateCell(i, c.key, e.target.value)}
                />
              ))}
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

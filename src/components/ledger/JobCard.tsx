import { useState } from "react";
import { LedgerJob, fmtMoney, fmtPct, fmtDate, totalExpenses, isAdminSession, useDeleteLedgerJob, useUpdateLedgerJob } from "@/lib/ledger-client";
import { MapPin, User, Calendar, TrendingUp, DollarSign, Trash2, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const LEAD_OPTIONS = ["referral", "repeat", "designer", "website", "unknown"];

export function JobCard({ job }: { job: LedgerJob }) {
  const [open, setOpen] = useState(false);
  const [leadSource, setLeadSource] = useState(job.lead_source || "unknown");
  const [paymentsReceived, setPaymentsReceived] = useState(String(job.payments_received || 0));

  const update = useUpdateLedgerJob();
  const del = useDeleteLedgerJob();
  const admin = isAdminSession();

  const balance = (job.total_price || 0) - (job.payments_received || 0);
  const expenses = totalExpenses(job);
  const isClosed = !!job.finish_date;

  return (
    <div className="pill-card p-5 md:p-6 fade-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-1">
            <MapPin className="w-3.5 h-3.5" />
            {isClosed ? "Closed" : "Active"}
          </div>
          <h3 className="display text-xl md:text-2xl text-slate-900 truncate">{job.address}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
            {job.client_name && (<span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" /> {job.client_name}</span>)}
            <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(job.start_date)} → {fmtDate(job.finish_date)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-slate-500">Total</div>
          <div className="display text-2xl md:text-3xl num text-slate-900">{fmtMoney(job.total_price)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Stat label="Net" value={fmtMoney(job.net)} tone={job.net >= 0 ? "positive" : "warning"} icon={<TrendingUp className="w-3.5 h-3.5" />} />
        <Stat label="Margin" value={fmtPct(job.profit_margin)} tone={job.profit_margin < 0.15 ? "warning" : "positive"} />
        <Stat label="Expenses" value={fmtMoney(expenses)} />
        <Stat label="Balance" value={fmtMoney(balance)} tone={balance > 0 ? "warning" : "positive"} icon={<DollarSign className="w-3.5 h-3.5" />} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} className="text-slate-600">
          {open ? <><ChevronUp className="w-4 h-4 mr-1" /> Hide details</> : <><ChevronDown className="w-4 h-4 mr-1" /> Show details</>}
        </Button>
        <div className="flex items-center gap-1">
          {admin && !isClosed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const iso = job.start_date ?? new Date().toISOString().slice(0, 10);
                await update.mutateAsync({ id: job.id, patch: { finish_date: iso } });
                toast.success("Marked as closed");
              }}
              className="text-emerald-700 hover:text-emerald-800"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Mark closed
            </Button>
          )}
          {admin && (
            <Button variant="ghost" size="sm" onClick={async () => {
              if (!confirm(`Delete job "${job.address}"?`)) return;
              await del.mutateAsync(job.id);
              toast.success("Job deleted");
            }} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
          {admin && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Lead source</label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_OPTIONS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Payments received</label>
                <Input type="number" step="0.01" value={paymentsReceived} onChange={(e) => setPaymentsReceived(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={async () => {
                  await update.mutateAsync({ id: job.id, patch: { lead_source: leadSource, payments_received: parseFloat(paymentsReceived) || 0 } });
                  toast.success("Saved");
                }} disabled={update.isPending}>Save</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Finish Materials" value={fmtMoney(job.finish_materials)} />
            <MiniStat label="Building Materials" value={fmtMoney(job.building_materials)} />
            <MiniStat label="Subs" value={fmtMoney(job.subs)} />
            <MiniStat label="Labor" value={fmtMoney(job.labor)} />
            <MiniStat label="Gross (cash)" value={fmtMoney(job.gross_cash)} />
            <MiniStat label="Gross w/ HST" value={fmtMoney(job.gross_with_hst)} />
            <MiniStat label="Payments" value={fmtMoney(job.payments_received)} />
            <MiniStat label="Lead" value={job.lead_source} capitalize />
          </div>

          {job.price_log?.length > 0 && <LogTable title="Price log" rows={job.price_log.map((p) => [fmtDate(p.date), fmtMoney(p.amount), p.comment])} headers={["Date", "Amount", "Comment"]} />}
          {job.expense_log?.length > 0 && <LogTable title="Expenses" rows={job.expense_log.map((p) => [fmtDate(p.date), fmtMoney(p.amount), p.category.replace(/_/g, " "), p.vendor])} headers={["Date", "Amount", "Category", "Vendor"]} />}
          {job.payments_log?.length > 0 && <LogTable title="Payments" rows={job.payments_log.map((p) => [fmtDate(p.date), fmtMoney(p.amount), p.method])} headers={["Date", "Amount", "Method"]} />}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "ink", icon }: { label: string; value: string; tone?: "ink" | "positive" | "warning"; icon?: React.ReactNode }) {
  const cls = tone === "positive" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">{icon}{label}</div>
      <div className={`num font-semibold text-base ${cls}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`num text-sm font-medium text-slate-800 ${capitalize ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}

function LogTable({ title, rows, headers }: { title: string; rows: Array<Array<string | number>>; headers: string[] }) {
  return (
    <div>
      <h4 className="display text-sm text-slate-700 mb-2">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
            <tr>{headers.map((h) => <th key={h} className="text-left px-2 py-1.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {r.map((c, j) => <td key={j} className="px-2 py-1.5 num text-slate-700">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

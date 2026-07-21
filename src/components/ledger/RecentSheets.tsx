import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet as SheetIcon, ExternalLink, Loader2, ArrowRight } from "lucide-react";
import { fmtDate, isAdminSession, useOpenLedgerJobFromSheet, useRecentSheetJobs } from "@/lib/ledger-client";
import { toast } from "sonner";

export function RecentSheets() {
  const admin = isAdminSession();
  const { data, isLoading } = useRecentSheetJobs();
  const open = useOpenLedgerJobFromSheet();
  const [url, setUrl] = useState("");

  if (!admin) return null;

  async function handleOpen() {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      const r = await open.mutateAsync(trimmed);
      if (r.error) toast.error(`Linked, but pull failed: ${r.error}`);
      else toast.success("Sheet opened and synced");
      setUrl("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to open sheet");
    }
  }

  return (
    <div className="pill-card p-5 md:p-6 fade-up">
      <div className="flex items-center gap-2 mb-3">
        <SheetIcon className="w-4 h-4 text-emerald-700" />
        <h2 className="display text-lg text-slate-900">Recent Google Sheets</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Paste a per-job Google Sheet URL to mirror it into Ledger. The sheet stays the source of truth —
        Ledger only reads.
      </p>
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <Input
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleOpen(); }}
          className="flex-1 bg-white"
        />
        <Button onClick={handleOpen} disabled={open.isPending || !url.trim()}>
          {open.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1" />}
          Open
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="text-xs text-slate-500">No linked sheets yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(data ?? []).map((row) => (
            <a
              key={row.id}
              href={`https://docs.google.com/spreadsheets/d/${row.sheet_id}/edit`}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-2 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors p-3"
            >
              <div className="mt-0.5 shrink-0 rounded-md bg-emerald-50 text-emerald-700 p-1.5">
                <SheetIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {row.client_name || row.address}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {row.finish_date ? "Closed" : "Active"}
                  {row.sheet_last_sync_at ? ` · synced ${fmtDate(row.sheet_last_sync_at)}` : " · never synced"}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 mt-1" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

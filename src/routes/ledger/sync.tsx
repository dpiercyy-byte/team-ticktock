import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useLedgerJobs, useResetLedgerJobs, useUploadLedgerJobXlsx, isAdminSession } from "@/lib/ledger-client";
import { Button } from "@/components/ui/button";
import { Upload, RefreshCw, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ledger/sync")({
  component: LedgerSync,
});

function LedgerSync() {
  const admin = isAdminSession();
  const { data } = useLedgerJobs();
  const upload = useUploadLedgerJobXlsx();
  const reset = useResetLedgerJobs();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Array<{ file: string; ok: boolean; msg: string }>>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const nextLog: typeof log = [];
    for (const f of Array.from(files)) {
      try {
        const res = await upload.mutateAsync(f);
        nextLog.push({ file: f.name, ok: true, msg: res.created ? "Created" : "Updated" });
      } catch (e: any) {
        nextLog.push({ file: f.name, ok: false, msg: e?.message || "Failed" });
      }
      setLog([...nextLog]);
    }
    setBusy(false);
    toast.success(`Processed ${files.length} file(s)`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-2xl md:text-3xl text-slate-900">Sync</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload job spreadsheets (.xlsx) to import into Ledger</p>
      </div>

      {!admin && (
        <div className="pill-card p-4 flex items-start gap-3 border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            You're viewing Ledger as a worker. Only admins can upload or reset job data.
          </div>
        </div>
      )}

      {admin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="pill-card p-6 fade-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white inline-flex items-center justify-center"><Upload className="w-5 h-5" /></div>
              <div>
                <div className="display text-lg text-slate-900">Upload spreadsheets</div>
                <div className="text-xs text-slate-500">Bulk-import one or many .xlsx files</div>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button className="w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" /> Choose .xlsx files</>}
            </Button>
          </div>

          <div className="pill-card p-6 fade-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white inline-flex items-center justify-center"><RefreshCw className="w-5 h-5" /></div>
              <div>
                <div className="display text-lg text-slate-900">Reset all jobs</div>
                <div className="text-xs text-slate-500">Deletes every Ledger job. Cannot be undone.</div>
              </div>
            </div>
            <Button variant="destructive" className="w-full" disabled={reset.isPending} onClick={async () => {
              if (!confirm("Delete ALL Ledger jobs? This cannot be undone.")) return;
              const r = await reset.mutateAsync();
              toast.success(`Deleted ${r.deleted} job(s)`);
            }}>
              {reset.isPending ? "Resetting..." : "Reset all jobs"}
            </Button>
          </div>
        </div>
      )}

      <div className="pill-card p-6">
        <div className="flex items-baseline justify-between mb-3">
          <div className="display text-lg text-slate-900">Current state</div>
          <div className="text-xs text-slate-500 num">{data?.length ?? 0} jobs in Ledger</div>
        </div>
        {log.length > 0 && (
          <div className="space-y-1">
            {log.map((l, i) => (
              <div key={i} className="text-xs flex items-center gap-2">
                {l.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                <span className="text-slate-700 truncate">{l.file}</span>
                <span className="text-slate-400 ml-auto">{l.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

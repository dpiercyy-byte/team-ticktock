import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  useLedgerJobs,
  useUploadLedgerJobXlsx,
  isAdminSession,
} from "@/lib/ledger-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Info,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ledger/sync")({
  component: LedgerSync,
});

function LedgerSync() {
  const admin = isAdminSession();
  const { data } = useLedgerJobs();
  const upload = useUploadLedgerJobXlsx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [markClosed, setMarkClosed] = useState(false);
  const [log, setLog] = useState<Array<{ file: string; ok: boolean; msg: string }>>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const nextLog: typeof log = [];
    for (const f of Array.from(files)) {
      try {
        const res = await upload.mutateAsync({ file: f, markClosed });
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
        <p className="text-sm text-slate-500 mt-0.5">Upload job spreadsheets. Google Sheets links live on each active job.</p>
      </div>

      {!admin && (
        <div className="pill-card p-4 flex items-start gap-3 border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            You're viewing Ledger as a worker. Only admins can upload data or configure sync.
          </div>
        </div>
      )}

      {admin && (
        <div className="pill-card p-6 fade-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white inline-flex items-center justify-center"><Upload className="w-5 h-5" /></div>
            <div>
              <div className="display text-lg text-slate-900">Upload spreadsheets</div>
              <div className="text-xs text-slate-500">Bulk-import one or many .xlsx files</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-slate-50">
            <Checkbox
              id="mark-closed"
              checked={markClosed}
              onCheckedChange={(v) => setMarkClosed(v === true)}
            />
            <label htmlFor="mark-closed" className="text-sm text-slate-700 cursor-pointer select-none">
              Mark uploaded jobs as <span className="font-semibold">closed</span> (use for "DONE" spreadsheets missing a finish date)
            </label>
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
          <p className="text-xs text-slate-500 mt-2">
            Tip: filenames starting with <code className="text-slate-700">DONE -</code>, <code className="text-slate-700">CLOSED -</code>, or <code className="text-slate-700">COMPLETE -</code> are auto-marked as closed if the workbook has no finish date.
          </p>
        </div>
      )}

      {admin && (
        <div className="pill-card p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            Google Sheets sync is now <span className="font-semibold">per active job</span>. Open any active job card and paste its sheet URL to link and sync. Sheet edits pull back into the app automatically every 5 minutes.
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

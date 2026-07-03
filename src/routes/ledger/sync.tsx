import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLedgerJobs,
  useUploadLedgerJobXlsx,
  useSetJobSheet,
  usePushJobToSheet,
  usePullJobFromSheet,
  isAdminSession,
  fmtDate,
  type LedgerJob,
} from "@/lib/ledger-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Info, Link2, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ledger/sync")({
  component: LedgerSync,
});

function LedgerSync() {
  // Avoid SSR/client hydration mismatch — sessionStorage isn't available on the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const admin = mounted && isAdminSession();

  const { data: jobs } = useLedgerJobs();
  const upload = useUploadLedgerJobXlsx();
  const setSheet = useSetJobSheet();
  const pushSheet = usePushJobToSheet();
  const pullSheet = usePullJobFromSheet();

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [markClosed, setMarkClosed] = useState(false);
  const [log, setLog] = useState<Array<{ file: string; ok: boolean; msg: string }>>([]);

  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [sheetUrl, setSheetUrl] = useState<string>("");

  const { activeJobs, closedJobs } = useMemo(() => {
    const list = (jobs ?? []) as LedgerJob[];
    return {
      activeJobs: list.filter((j) => !j.finish_date),
      closedJobs: list.filter((j) => !!j.finish_date),
    };
  }, [jobs]);

  const selectedJob = useMemo(
    () => (jobs ?? []).find((j) => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  // When switching jobs, prefill the URL field with the currently linked sheet id.
  useEffect(() => {
    if (!selectedJob) { setSheetUrl(""); return; }
    setSheetUrl(selectedJob.sheet_id ?? "");
  }, [selectedJobId, selectedJob]);

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

  async function handleSaveAndPush() {
    if (!selectedJobId) { toast.error("Choose a job first"); return; }
    if (!sheetUrl.trim()) { toast.error("Paste a Google Sheet URL"); return; }
    try {
      await setSheet.mutateAsync({ jobId: selectedJobId, url: sheetUrl.trim() });
      await pushSheet.mutateAsync(selectedJobId);
      toast.success("Sheet linked and pushed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to link sheet");
    }
  }

  async function handlePull() {
    if (!selectedJobId) { toast.error("Choose a job first"); return; }
    try {
      await pullSheet.mutateAsync(selectedJobId);
      toast.success("Pulled latest from sheet");
    } catch (e: any) {
      toast.error(e?.message || "Failed to pull");
    }
  }

  const linkerBusy = setSheet.isPending || pushSheet.isPending || pullSheet.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-2xl md:text-3xl text-slate-900">Sync</h1>
        <p className="text-sm text-slate-500 mt-0.5">Link a Google Sheet to any job, or bulk-upload spreadsheets.</p>
      </div>

      {mounted && !admin && (
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
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white inline-flex items-center justify-center"><Link2 className="w-5 h-5" /></div>
            <div>
              <div className="display text-lg text-slate-900">Link a Google Sheet to a job</div>
              <div className="text-xs text-slate-500">Pick any job, paste its sheet URL, then push or pull</div>
            </div>
          </div>

          {(jobs?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-500 p-3 rounded-xl bg-slate-50">
              No jobs in Ledger yet — upload a spreadsheet below first, then come back here to link a Google Sheet.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Job</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a job..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {activeJobs.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Active</SelectLabel>
                        {activeJobs.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.address}{j.client_name ? ` — ${j.client_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {closedJobs.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Closed</SelectLabel>
                        {closedJobs.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.address}{j.client_name ? ` — ${j.client_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Google Sheet URL</label>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                />
                {selectedJob?.sheet_id && (
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Linked
                    {selectedJob.sheet_last_sync_at && (
                      <span className="text-slate-400">· last sync {fmtDate(selectedJob.sheet_last_sync_at)}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button className="flex-1" disabled={linkerBusy || !selectedJobId || !sheetUrl.trim()} onClick={handleSaveAndPush}>
                  {(setSheet.isPending || pushSheet.isPending)
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    : <><ArrowUpFromLine className="w-4 h-4 mr-2" /> Save & Push</>}
                </Button>
                <Button variant="outline" className="flex-1" disabled={linkerBusy || !selectedJob?.sheet_id} onClick={handlePull}>
                  {pullSheet.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Pulling...</>
                    : <><ArrowDownToLine className="w-4 h-4 mr-2" /> Pull now</>}
                </Button>
              </div>
            </div>
          )}
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
            Sheet edits pull back into the app automatically every 5 minutes. You can also open any active job card to link a sheet from there.
          </div>
        </div>
      )}

      <div className="pill-card p-6">
        <div className="flex items-baseline justify-between mb-3">
          <div className="display text-lg text-slate-900">Current state</div>
          <div className="text-xs text-slate-500 num">{jobs?.length ?? 0} jobs in Ledger</div>
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

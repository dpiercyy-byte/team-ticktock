import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, RefreshCw } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { getAdminToken } from "@/lib/session";
import {
  discoverSheetJobs,
  listSheetJobSources,
  setSheetJobsSyncEnabled,
  syncSheetJob,
  syncSheetJobs,
} from "@/lib/sheet-jobs.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/ledger/sheets")({
  head: () => ({
    meta: [
      { title: "Job sheets — Ledger" },
      {
        name: "description",
        content: "Import the ongoing Google Sheet job files into Ledger projects.",
      },
      { property: "og:title", content: "Job sheets — Ledger" },
      { property: "og:description", content: "Ongoing job sheets, synced into Ledger." },
    ],
  }),
  component: SheetJobsPage,
});

function requireToken() {
  const t = getAdminToken();
  if (!t) throw new Response("Admin required", { status: 401 });
  return t;
}

function SheetJobsPage() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["ledger", "sheet-jobs"],
    queryFn: async () => listSheetJobSources({ data: { token: requireToken() } }),
    staleTime: 10_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["ledger", "sheet-jobs"] });

  const discover = useMutation({
    mutationFn: async () => discoverSheetJobs({ data: { token: requireToken() } }),
    onSuccess: (r) => {
      toast.success(`Found ${r.found} ongoing sheet${r.found === 1 ? "" : "s"}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncAll = useMutation({
    mutationFn: async () => syncSheetJobs({ data: { token: requireToken() } }),
    onSuccess: (r) => {
      toast.success(`Synced ${r.synced} job${r.synced === 1 ? "" : "s"}${r.failed ? `, ${r.failed} failed` : ""}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncOne = useMutation({
    mutationFn: async (id: string) => syncSheetJob({ data: { token: requireToken(), id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success("Sheet imported");
      else toast.error(r.error ?? "Import failed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusyId(null),
  });

  const toggle = useMutation({
    mutationFn: async (enabled: boolean) =>
      setSheetJobsSyncEnabled({ data: { token: requireToken(), enabled } }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const sources = q.data?.sources ?? [];
  const active = sources.filter((s) => s.ongoing);
  const finished = sources.filter((s) => !s.ongoing);

  return (
    <LedgerShell>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Job sheets</h1>
        <p className="mt-1 text-sm l-muted">
          Every Drive file with “ongoing” in its name is matched to a job by address and its
          payments, materials and subs are pulled in. The sheet stays the source of truth; nothing
          is written back.
        </p>
      </header>

      <div className="l-card mb-5 flex flex-wrap items-center gap-2 px-4 py-3.5">
        <button
          className="l-btn"
          onClick={() => discover.mutate()}
          disabled={discover.isPending}
        >
          {discover.isPending ? "Scanning…" : "Scan Drive"}
        </button>
        <button
          className="l-btn l-btn-primary"
          onClick={() => syncAll.mutate()}
          disabled={syncAll.isPending}
        >
          {syncAll.isPending ? "Syncing…" : "Sync all ongoing"}
        </button>
        <label className="ml-auto flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={!!q.data?.settings.enabled}
            onChange={(e) => toggle.mutate(e.target.checked)}
          />
          Nightly auto-sync
        </label>
      </div>

      {q.data?.settings.lastSyncAt ? (
        <p className="mb-4 text-[12px] l-muted">
          Last sync {new Date(q.data.settings.lastSyncAt).toLocaleString()}
        </p>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm l-muted">Loading…</p>
      ) : sources.length === 0 ? (
        <div className="l-card px-6 py-16 text-center">
          <FileSpreadsheet className="mx-auto h-6 w-6 l-muted" />
          <p className="mt-3 text-sm l-muted">No job sheets tracked yet — run a Drive scan.</p>
        </div>
      ) : (
        <div className="grid gap-5">
          <SourceList
            title="Ongoing"
            rows={active}
            busyId={busyId}
            onSync={(id) => {
              setBusyId(id);
              syncOne.mutate(id);
            }}
          />
          {finished.length > 0 ? (
            <SourceList
              title="No longer marked ongoing"
              rows={finished}
              busyId={busyId}
              onSync={(id) => {
                setBusyId(id);
                syncOne.mutate(id);
              }}
            />
          ) : null}
        </div>
      )}
    </LedgerShell>
  );
}

type Row = {
  id: string;
  fileId: string;
  fileName: string;
  address: string | null;
  projectId: string | null;
  matchMode: string;
  status: string;
  warnings: string[];
  lastError: string | null;
  lastSyncedAt: string | null;
};

function SourceList({
  title,
  rows,
  busyId,
  onSync,
}: {
  title: string;
  rows: Row[];
  busyId: string | null;
  onSync: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wide l-muted">{title}</h2>
      <ul className="grid gap-3">
        {rows.map((s) => (
          <li key={s.id} className="l-card px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{s.address || s.fileName}</p>
                <p className="truncate text-[12px] l-muted">{s.fileName}</p>
                <p className="mt-1 text-[12px] l-muted">
                  {s.projectId
                    ? `Linked (${s.matchMode})`
                    : "Not linked yet — a job will be created on first sync"}
                  {s.lastSyncedAt
                    ? ` · synced ${new Date(s.lastSyncedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill status={s.status} />
                <button
                  className="l-btn"
                  onClick={() => onSync(s.id)}
                  disabled={busyId === s.id}
                  aria-label="Sync this sheet"
                >
                  <RefreshCw className={`h-4 w-4 ${busyId === s.id ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            {s.lastError ? (
              <p className="mt-2 text-[12px] text-destructive">{s.lastError}</p>
            ) : null}
            {s.warnings.length > 0 ? (
              <ul className="mt-2 grid gap-1">
                {s.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] l-muted">
                    <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "synced")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-bold">
        <Check className="h-3 w-3" /> Synced
      </span>
    );
  if (status === "warning")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-bold">
        <AlertTriangle className="h-3 w-3" /> Check
      </span>
    );
  if (status === "error")
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-bold text-destructive">
        Error
      </span>
    );
  return <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold">Pending</span>;
}

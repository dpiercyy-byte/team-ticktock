import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Wifi, WifiOff, LogOut, Briefcase, Clock, Receipt, X, FileText, Trash2, Paperclip, Banknote,
  MapPin, MapPinOff, CloudOff, RefreshCw, AlertCircle, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { CameraFilePicker } from "@/components/CameraFilePicker";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { listWorkersPublic, workerLogin } from "@/lib/auth.functions";
import { getWorkerState, clockIn, clockOut, workerSetEntryReason, workerListActiveClientSites, workerSetPlannedJob } from "@/lib/entries.functions";
import {
  workerSubmitReimbursement, workerUploadReceipt,
  workerListReimbursements, workerDeleteReimbursement, workerListActiveSites,
} from "@/lib/reimbursements.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  getWorkerSession, setWorkerSession, clearWorkerSession, type WorkerSession,
} from "@/lib/session";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { enqueueClock } from "@/lib/offline-queue";
import { workerWeekSummary } from "@/lib/payout.functions";
import { fmtHours, fmtMoney, diffHours } from "@/lib/format";

import { isAcceptableUpload, prepareUpload, withRetry } from "@/lib/image-compress";


type GeoCoords = { lat: number; lng: number } | null;

async function getGeo(timeoutMs = 10_000): Promise<GeoCoords> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise<GeoCoords>((resolve) => {
    let done = false;
    const finish = (v: GeoCoords) => { if (!done) { done = true; resolve(v); } };
    const t = setTimeout(() => finish(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(t); finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { clearTimeout(t); finish(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}


export function WorkerApp() {
  const [session, setSession] = useState<WorkerSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  

  useEffect(() => {
    setSession(getWorkerSession());
    setHydrated(true);
  }, []);

  if (!hydrated) return <div className="min-h-dvh bg-background" />;

  if (!session) {
    return <PinLogin onLogin={(s) => {
      setWorkerSession(s);
      setSession(s);
    }} />;
  }
  return (
    <ClockInScreen
      session={session}
      onLogout={() => { clearWorkerSession(); setSession(null); }}
    />
  );
}

function PinLogin({ onLogin }: { onLogin: (s: WorkerSession) => void }) {
  const list = useServerFn(listWorkersPublic);
  const login = useServerFn(workerLogin);
  const { data: workers, isLoading } = useQuery({ queryKey: ["workers-pub"], queryFn: () => list() });
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  const m = useMutation({
    mutationFn: () => login({ data: { workerId: workerId!, pin } }),
    onSuccess: (r) => {
      if (!r.ok || !r.token || !r.worker) { toast.error(r.error ?? "Invalid PIN"); setPin(""); return; }
      onLogin({ token: r.token, id: r.worker.id, name: r.worker.name });
    },
    onError: () => { toast.error("Invalid PIN"); setPin(""); },
  });

  const selectedName = workers?.find((w) => w.id === workerId)?.name;

  return (
    <div className="min-h-dvh bg-muted/40 flex flex-col px-6 pt-16 pb-10">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col">
        <div className="text-center mb-12">
          <div
            className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full mb-5 shadow-sm"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Clock className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Clockwise</h1>
          <p className="text-[15px] text-muted-foreground mt-1.5">Clock in for today's work.</p>
        </div>

        {!workerId ? (
          <div className="space-y-8">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">
                Your name
              </Label>
              {isLoading ? (
                <div className="h-[60px] rounded-2xl bg-background border border-border/60 flex items-center px-4 text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : workers && workers.length > 0 ? (
                <Select onValueChange={(val) => setWorkerId(val)}>
                  <SelectTrigger className="w-full h-[60px] rounded-2xl bg-background border border-border/60 px-4 text-base shadow-none data-[placeholder]:text-muted-foreground focus:ring-2 focus:ring-primary/30">
                    <SelectValue placeholder="Select your name" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="p-6 text-sm text-muted-foreground text-center rounded-2xl bg-background border border-border/60">
                  No workers yet. Ask your admin to add you.
                </p>
              )}
            </div>

            <Button
              type="button"
              disabled
              style={{ background: "var(--gradient-primary)" }}
              className="w-full h-[60px] rounded-2xl text-base font-semibold text-primary-foreground shadow-sm transition-all active:scale-[0.98] active:brightness-105 hover:brightness-110 hover:shadow-md"
            >
              Continue
            </Button>

            <div className="text-center pt-2">
              <a
                href="/admin"
                className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground active:bg-secondary active:text-secondary-foreground active:scale-[0.98]"
              >
                Admin sign in
                <ChevronRight className="h-4 w-4" />
              </a>

            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (pin.length >= 4) m.mutate(); }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">
                {selectedName ? `PIN for ${selectedName}` : "PIN"}
              </Label>
              <Input
                id="pin" type="password" inputMode="numeric" autoComplete="off"
                autoFocus maxLength={12}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="h-[60px] rounded-2xl bg-background border border-border/60 px-4 text-center text-2xl tracking-[0.5em] shadow-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40"
                placeholder="••••"
              />
            </div>

            <Button
              type="submit"
              style={{ background: "var(--gradient-primary)" }}
              className="w-full h-[60px] rounded-2xl text-base font-semibold text-primary-foreground shadow-sm transition-all active:scale-[0.98] hover:brightness-110 hover:shadow-md"
              disabled={pin.length < 4 || m.isPending}
            >
              {m.isPending ? "Signing in…" : "Continue"}
            </Button>

            <div className="text-center pt-2 space-y-4">
              <button
                type="button"
                onClick={() => { setWorkerId(null); setPin(""); }}
                className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground active:bg-secondary active:text-secondary-foreground active:scale-[0.98]"
              >
                <ChevronLeft className="h-4 w-4" />
                Choose a different name
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}

function ClockInScreen({ session, onLogout }: { session: WorkerSession; onLogout: () => void }) {
  
  const stateFn = useServerFn(getWorkerState);
  const inFn = useServerFn(clockIn);
  const outFn = useServerFn(clockOut);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["worker-state", session.id],
    queryFn: () => stateFn({ data: { token: session.token } }),
    refetchInterval: 30_000,
  });

  // Auto logout if token invalid
  useEffect(() => { if (isError) { toast.error("Session expired"); onLogout(); } }, [isError, onLogout]);

  const [project, setProject] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!data?.active) return;
    const i = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [data?.active]);

  const [lastGeo, setLastGeo] = useState<null | { status: "verified" | "callback" | "supplier" | "off_site" | "no_gps"; siteLabel: string | null }>(null);
  const [reasonPrompt, setReasonPrompt] = useState<null | { entryId: string; status: "off_site" | "no_gps"; kind: "in" | "out" }>(null);
  const [plannedPrompt, setPlannedPrompt] = useState<null | { entryId: string; alsoNeedsReason: boolean; reasonStatus?: "off_site" | "no_gps" }>(null);

  const handleSynced = (r: Parameters<NonNullable<Parameters<typeof useOfflineSync>[0]["onSynced"]>>[0]) => {
    if (r.kind === "in") {
      setLastGeo({ status: r.res.geo.status, siteLabel: r.res.geo.siteLabel });
      toast.success("Clock-in synced");
      if (r.res.needsReason && r.res.entryId && r.res.geo.status !== "verified" && r.res.geo.status !== "callback") {
        setReasonPrompt({ entryId: r.res.entryId, status: r.res.geo.status as any, kind: "in" });
      }
    } else {
      setLastGeo(null);
      toast.success("Clock-out synced");
      if (r.res.needsPlannedJob && r.res.entryId) {
        setPlannedPrompt({
          entryId: r.res.entryId,
          alsoNeedsReason: !!r.res.needsReason && r.res.geo.status !== "verified",
          reasonStatus: r.res.needsReason && r.res.geo.status !== "verified" ? (r.res.geo.status as "off_site" | "no_gps") : undefined,
        });
      } else if (r.res.needsReason && r.res.entryId && r.res.geo.status !== "verified") {
        setReasonPrompt({ entryId: r.res.entryId, status: r.res.geo.status as any, kind: "out" });
      }
    }
  };

  const sync = useOfflineSync({ workerId: session.id, onSynced: handleSynced });

  const queueAction = (kind: "in" | "out", coords: GeoCoords, projectVal?: string) => {
    enqueueClock({
      kind,
      token: session.token,
      workerId: session.id,
      payload: {
        project: projectVal,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        clientTimestamp: new Date().toISOString(),
      },
    });
  };

  const inMut = useMutation({
    mutationFn: async () => {
      const coords = await getGeo();
      // If offline or already pending, queue it.
      if (!navigator.onLine || sync.pending.length > 0) {
        queueAction("in", coords, project || undefined);
        return { queued: true as const };
      }
      try {
        const res = await inFn({ data: {
          token: session.token,
          project: project || undefined,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        } });
        return { queued: false as const, res };
      } catch (e) {
        // Network-style failure → queue.
        queueAction("in", coords, project || undefined);
        return { queued: true as const };
      }
    },
    onSuccess: (out) => {
      setProject("");
      qc.invalidateQueries({ queryKey: ["worker-state", session.id] });
      if (out.queued) {
        toast.success("Clock-in saved — will sync when online");
      } else {
        const r = out.res;
        setLastGeo({ status: r.geo.status, siteLabel: r.geo.siteLabel });
        toast.success("Clocked in");
        if (r.needsReason && r.entryId && r.geo.status !== "verified" && r.geo.status !== "callback") {
          setReasonPrompt({ entryId: r.entryId, status: r.geo.status as any, kind: "in" });
        }
      }
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const outMut = useMutation({
    mutationFn: async () => {
      const coords = await getGeo();
      if (!navigator.onLine || sync.pending.length > 0) {
        queueAction("out", coords);
        return { queued: true as const };
      }
      try {
        const res = await outFn({ data: {
          token: session.token,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        } });
        return { queued: false as const, res };
      } catch (e) {
        queueAction("out", coords);
        return { queued: true as const };
      }
    },
    onSuccess: (out) => {
      qc.invalidateQueries({ queryKey: ["worker-state", session.id] });
      if (out.queued) {
        toast.success("Clock-out saved — will sync when online");
      } else {
        const r = out.res;
        setLastGeo(null);
        toast.success("Clocked out");
        if (r.needsPlannedJob && r.entryId) {
          setPlannedPrompt({
            entryId: r.entryId,
            alsoNeedsReason: !!r.needsReason && r.geo.status !== "verified",
            reasonStatus: r.needsReason && r.geo.status !== "verified" ? (r.geo.status as "off_site" | "no_gps") : undefined,
          });
        } else if (r.needsReason && r.entryId && r.geo.status !== "verified") {
          setReasonPrompt({ entryId: r.entryId, status: r.geo.status as any, kind: "out" });
        }
      }
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });




  // Compute effective active state by applying queued (unsynced) actions on top of server state.
  const serverActive = data?.active ?? null;
  const settings = data?.settings;

  let active: any = serverActive;
  let optimisticPendingKind: "in" | "out" | null = null;
  for (const q of sync.pending) {
    optimisticPendingKind = q.kind;
    if (q.kind === "in" && !active) {
      active = {
        id: `pending-${q.id}`,
        clock_in: q.payload.clientTimestamp,
        project: q.payload.project ?? null,
        geo_status: null,
        offsite_reason_code: null,
        planned_job: null,
        __pending: true,
      };
    } else if (q.kind === "out" && active) {
      active = null;
    }
  }

  const sessionHours = active ? diffHours(active.clock_in, new Date()) : 0;
  // include live session in totals
  const todayDisplay = (data?.todayHours ?? 0) + sessionHours;
  const weekDisplay = (data?.weekHours ?? 0) + sessionHours;
  const rate = Number(data?.worker?.hourly_rate ?? 0);
  void tick;

  const sessionStr = (() => {
    if (!active) return null;
    const ms = Math.max(0, Date.now() - new Date(active.clock_in).getTime());
    const h = Math.floor(ms / 3600_000);
    const m = Math.floor((ms % 3600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();
  void optimisticPendingKind;


  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 border-b border-border bg-card">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="font-semibold truncate">{session.name}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SyncStatusPill status={sync.status} pending={sync.pending.length} failed={sync.failed.length} onRetry={sync.retry} />
          <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {(sync.pending.length > 0 || sync.failed.length > 0) && (
        <PendingBanner
          pending={sync.pending.length}
          failed={sync.failed.length}
          online={sync.online}
          syncing={sync.status === "syncing"}
          onSyncNow={sync.flush}
          onRetry={sync.retry}
        />
      )}


      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="text-center flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {active ? "Currently Working" : "Not Clocked In"}
              </p>
              {active && (
                <p className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight select-none">{sessionStr}</p>
              )}
              {active?.project && (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> {active.project}
                </p>
              )}
            </div>

            {!active && settings?.project_tracking_enabled && (
              <div className="w-full max-w-xs">
                <Label htmlFor="project" className="text-xs text-muted-foreground">
                  Project / Job site (optional)
                </Label>
                <Input id="project" value={project}
                       onChange={(e) => setProject(e.target.value)} placeholder="e.g. Maple St."
                       className="mt-1.5" maxLength={100} />
              </div>
            )}

            {active ? (
              <Button size="lg" onClick={() => outMut.mutate()} disabled={outMut.isPending}
                      className="h-56 w-56 rounded-full text-xl font-bold shadow-lg touch-manipulation select-none active:scale-95 transition-transform"
                      style={{ background: "var(--destructive)", color: "var(--destructive-foreground)" }}>
                {outMut.isPending ? "…" : "Clock Out"}
              </Button>
            ) : (
              <Button size="lg" onClick={() => inMut.mutate()} disabled={inMut.isPending}
                      className="h-56 w-56 rounded-full text-xl font-bold shadow-[var(--shadow-elevated)] touch-manipulation select-none active:scale-95 transition-transform"
                      style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}>
                {inMut.isPending ? "…" : "Clock In"}
              </Button>
            )}

            <div className="flex flex-col items-center gap-2">
              {lastGeo && (
                <div className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 shadow-sm text-xs ${
                  lastGeo.status === "verified" ? "text-success" :
                  lastGeo.status === "supplier" ? "text-primary" :
                  lastGeo.status === "off_site" ? "text-warning" : "text-muted-foreground"
                }`}>
                  {lastGeo.status === "no_gps"
                    ? <><MapPinOff className="h-3.5 w-3.5" /> Location unavailable</>
                    : lastGeo.status === "verified"
                    ? <><MapPin className="h-3.5 w-3.5" /> Verified at {lastGeo.siteLabel}</>
                    : lastGeo.status === "supplier"
                    ? <><MapPin className="h-3.5 w-3.5" /> At {lastGeo.siteLabel}</>
                    : <><MapPin className="h-3.5 w-3.5" /> Off-site</>}
                </div>
              )}

              {active?.planned_job?.label && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 shadow-sm text-xs text-primary">
                  <MapPin className="h-3.5 w-3.5" /> Heading to: {active.planned_job.label}
                </div>
              )}

              {active && active.geo_status && active.geo_status !== "verified" && active.geo_status !== "supplier" && !active.offsite_reason_code && (
                <button
                  onClick={() => setReasonPrompt({
                    entryId: active.id,
                    status: active.geo_status as any,
                    kind: "in",
                  })}
                  className="inline-flex items-center rounded-full bg-warning/10 text-warning px-3 py-1.5 text-xs font-medium"
                >
                  Add reason for off-site clock-in
                </button>
              )}
            </div>

            <ReimbursementsSection token={session.token} workerId={session.id} />
            <PreviousWeekPill token={session.token} workerId={session.id} />

          </>
        )}
      </main>

      <section className="border-t border-border bg-card rounded-t-2xl px-6 py-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Today</p>
          <p className="text-2xl font-bold tabular-nums">{fmtHours(todayDisplay)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">This Week</p>
          <p className="text-2xl font-bold tabular-nums">{fmtHours(weekDisplay)}</p>
          {settings?.show_pay_estimates && (
            <p className="text-sm text-muted-foreground mt-0.5">{fmtMoney(weekDisplay * rate)} est.</p>
          )}
        </div>
      </section>


      <OffsiteReasonDialog
        token={session.token}
        prompt={reasonPrompt}
        onClose={() => setReasonPrompt(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["worker-state", session.id] })}
      />

      <PlannedJobDialog
        token={session.token}
        prompt={plannedPrompt}
        onClose={() => setPlannedPrompt(null)}
        onSaved={(prompt) => {
          qc.invalidateQueries({ queryKey: ["worker-state", session.id] });
          // If GPS also needed a reason, chain into reason dialog now.
          if (prompt.alsoNeedsReason && prompt.reasonStatus) {
            setReasonPrompt({ entryId: prompt.entryId, status: prompt.reasonStatus, kind: "in" });
          }
        }}
      />

    </div>
  );
}

function ReimbursementsSection({ token, workerId }: { token: string; workerId: string }) {
  const submitFn = useServerFn(workerSubmitReimbursement);
  const uploadFn = useServerFn(workerUploadReceipt);
  const listFn = useServerFn(workerListReimbursements);
  const delFn = useServerFn(workerDeleteReimbursement);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [desc, setDesc] = useState("");
  const [jobSiteId, setJobSiteId] = useState<string>("");
  const [receipt, setReceipt] = useState<{ url: string; mime: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<{ url: string; mime: string } | null>(null);

  const reset = () => { setAmt(""); setDesc(""); setReceipt(null); setJobSiteId(""); };

  const lq = useQuery({
    queryKey: ["worker-reimb", workerId],
    queryFn: () => listFn({ data: { token } }),
  });

  const sitesFn = useServerFn(workerListActiveSites);
  const sitesQ = useQuery({
    queryKey: ["worker-sites", workerId],
    queryFn: () => sitesFn({ data: { token } }),
    enabled: open,
  });
  const sites = (sitesQ.data?.sites ?? []) as Array<{ id: string; label: string; kind: string }>;
  const clientSites = sites.filter((s) => (s.kind ?? "client") === "client");
  const supplierSites = sites.filter((s) => s.kind === "supplier");

  // Realtime: any change to reimbursements for this worker → refetch
  useEffect(() => {
    const channel = supabase
      .channel(`reimb-worker-${workerId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "reimbursements",
        filter: `worker_id=eq.${workerId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["worker-reimb", workerId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workerId, qc]);

  const handleFile = async (file: File) => {
    if (!isAcceptableUpload(file)) {
      toast.error("Only images or PDF allowed");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Max file size is 25MB");
      return;
    }
    setUploading(true);
    try {
      const prepped = await prepareUpload(file);
      const r = await withRetry(() =>
        uploadFn({
          data: {
            token,
            filename: prepped.filename,
            mime: prepped.mime as any,
            base64: prepped.base64,
          },
        }),
      );
      setReceipt({ url: r.url, mime: r.mime });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = useMutation({
    mutationFn: () => submitFn({ data: {
      token,
      description: desc.trim() || undefined,
      amount: parseFloat(amt) || 0,
      receiptUrl: receipt?.url ?? null,
      receiptMime: receipt?.mime ?? null,
      jobSiteId,
    } }),
    onSuccess: () => {
      toast.success("Reimbursement submitted");
      reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["worker-reimb", workerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to submit"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { token, id } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["worker-reimb", workerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to remove"),
  });

  const items = lq.data?.items ?? [];
  const weekTotal = items.reduce((s: number, r: any) => s + Number(r.amount), 0);

  return (
    <div className="w-full max-w-sm space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full touch-manipulation"
      >
        <Banknote className="h-4 w-4 mr-2 text-success" />
        Add Reimbursement
      </Button>

      {items.length > 0 && (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-secondary text-xs">
            <span className="font-medium uppercase tracking-wider text-muted-foreground">This week</span>
            <span className="tabular-nums font-semibold">{fmtMoney(weekTotal)}</span>
          </div>
          <ul className="divide-y divide-border">
            {items.map((r: any) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                {r.receipt_url ? (
                  <button type="button"
                          onClick={() => setViewing({ url: r.receipt_url, mime: r.receipt_mime || "image/jpeg" })}
                          className="block h-9 w-9 shrink-0 overflow-hidden rounded bg-secondary">
                    {(r.receipt_mime || "").startsWith("image/") ? (
                      <img src={r.receipt_url} alt="Receipt" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate flex items-center gap-1.5">
                    {r.description}
                    {r.receipt_url && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </p>
                </div>
                <span className="tabular-nums shrink-0">{fmtMoney(Number(r.amount))}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                            aria-label="Remove reimbursement">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove this reimbursement?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove this reimbursement? This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del.mutate(r.id)}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit reimbursement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="r-amt" className="text-xs">Amount ($)<span className="text-destructive ml-0.5">*</span></Label>
              <Input
                id="r-amt" type="number" step="0.01" inputMode="decimal" min="0"
                value={amt} onChange={(e) => setAmt(e.target.value)}
                placeholder="0.00" className="mt-1.5 h-11 text-base"
              />
            </div>
            <div>
              <Label className="text-xs">Job<span className="text-destructive ml-0.5">*</span></Label>
              <Select value={jobSiteId} onValueChange={setJobSiteId}>
                <SelectTrigger className="mt-1.5 h-11 text-base"><SelectValue placeholder="Select a job" /></SelectTrigger>
                <SelectContent>
                  {clientSites.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Client jobs</SelectLabel>
                      {clientSites.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="r-desc" className="text-xs">Description (optional)</Label>
              <Textarea
                id="r-desc" value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Screws from Home Depot"
                rows={2} maxLength={200} className="mt-1.5 text-base"
              />
            </div>
            <div>
              <Label className="text-xs">Receipt photo (optional)</Label>
              <div className="mt-1.5">
                {receipt ? (
                  <div className="flex items-center gap-2 rounded-md border border-border p-2">
                    <div className="h-12 w-12 overflow-hidden rounded bg-secondary shrink-0">
                      {receipt.mime.startsWith("image/") ? (
                        <img src={receipt.url} alt="Receipt" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-1">Receipt attached</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReceipt(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <CameraFilePicker
                    onFile={handleFile}
                    uploading={uploading}
                    label="Attach receipt"
                  />
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => submit.mutate()}
              disabled={!jobSiteId || !amt || parseFloat(amt) <= 0 || uploading || submit.isPending}
            >
              {submit.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {viewing && (viewing.mime === "application/pdf" ? (
            <iframe src={viewing.url} className="w-full h-[70vh] rounded border border-border" title="Receipt" />
          ) : (
            <img src={viewing.url} alt="Receipt" className="w-full max-h-[70vh] object-contain rounded" />
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const REASON_OPTIONS: { code: string; label: string }[] = [
  { code: "material_pickup", label: "Material pickup" },
  { code: "client_visit", label: "Client visit" },
  { code: "travel", label: "Travel between sites" },
  { code: "forgot_clockout", label: "Forgot to clock out" },
  { code: "new_site", label: "New / unlisted site" },
  { code: "other", label: "Other" },
];

function OffsiteReasonDialog({
  token, prompt, onClose, onSaved,
}: {
  token: string;
  prompt: { entryId: string; status: "off_site" | "no_gps"; kind: "in" | "out" } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const setFn = useServerFn(workerSetEntryReason);
  const [code, setCode] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (prompt) { setCode(""); setNote(""); }
  }, [prompt?.entryId]);

  const save = useMutation({
    mutationFn: () => setFn({ data: {
      token,
      entryId: prompt!.entryId,
      code: code as any,
      note: note.trim() || null,
    } }),
    onSuccess: () => {
      toast.success("Reason saved");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const open = !!prompt;
  const title = prompt?.status === "no_gps"
    ? "No location detected"
    : "Clocked in off-site";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Help your admin verify this {prompt?.kind === "out" ? "clock-out" : "clock-in"}.
            Pick the closest reason.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {REASON_OPTIONS.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={() => setCode(r.code)}
                className={`text-left rounded-md border px-3 py-2 text-sm transition ${
                  code === r.code
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {(code === "other" || code === "new_site") && (
            <div>
              <Label htmlFor="reason-note" className="text-xs text-muted-foreground">
                Add a brief note
              </Label>
              <Textarea
                id="reason-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Picked up lumber at Home Depot"
                maxLength={200}
                className="mt-1.5"
                rows={3}
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose}>Skip</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!code || save.isPending || ((code === "other" || code === "new_site") && !note.trim())}
          >
            {save.isPending ? "Saving…" : "Save reason"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PlannedPrompt = { entryId: string; alsoNeedsReason: boolean; reasonStatus?: "off_site" | "no_gps" };

function PlannedJobDialog({
  token, prompt, onClose, onSaved,
}: {
  token: string;
  prompt: PlannedPrompt | null;
  onClose: () => void;
  onSaved: (p: PlannedPrompt) => void;
}) {
  const listFn = useServerFn(workerListActiveClientSites);
  const setFn = useServerFn(workerSetPlannedJob);
  const [selected, setSelected] = useState<string>("");

  const sitesQ = useQuery({
    enabled: !!prompt,
    queryKey: ["worker-active-client-sites"],
    queryFn: () => listFn({ data: { token } }),
  });

  useEffect(() => { if (prompt) setSelected(""); }, [prompt?.entryId]);

  const save = useMutation({
    mutationFn: () => setFn({ data: {
      token,
      entryId: prompt!.entryId,
      jobSiteId: selected === "__none__" ? null : selected,
    } }),
    onSuccess: () => {
      toast.success(selected === "__none__" ? "Saved" : "Heading to job set");
      const p = prompt!;
      onSaved(p);
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const open = !!prompt;
  const sites = sitesQ.data?.sites ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Required choice — prevent closing without selection by ignoring outside dismiss.
        if (!o && !save.isPending && selected) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Which job are you heading to?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You clocked in away from a client job site. Tell your admin which job you're working today.
          </p>
          <div>
            <Label className="text-xs text-muted-foreground">Planned job site</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-full mt-1.5">
                <SelectValue placeholder={sitesQ.isLoading ? "Loading…" : "Choose a job"} />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
                <SelectItem value="__none__">No job today / other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={!selected || save.isPending}
            className="w-full"
          >
            {save.isPending ? "Saving…" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function SyncStatusPill({ status, pending, failed, onRetry }: {
  status: "idle" | "offline" | "syncing" | "failed";
  pending: number;
  failed: number;
  onRetry: () => void;
}) {
  if (status === "failed") {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-xs text-destructive font-medium"
      >
        <AlertCircle className="h-3.5 w-3.5" />
        Sync failed — retry
      </button>
    );
  }
  if (status === "syncing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Syncing{pending > 0 ? ` ${pending}` : ""}…
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning">
        <CloudOff className="h-3.5 w-3.5" />
        Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <Wifi className="h-3.5 w-3.5" />
      Online
    </span>
  );
}

function PendingBanner({ pending, failed, online, syncing, onSyncNow, onRetry }: {
  pending: number;
  failed: number;
  online: boolean;
  syncing: boolean;
  onSyncNow: () => void;
  onRetry: () => void;
}) {
  if (failed > 0) {
    return (
      <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-destructive/10 border-b border-destructive/30 text-sm">
        <span className="inline-flex items-center gap-2 text-destructive font-medium">
          <AlertCircle className="h-4 w-4" />
          {failed} action{failed === 1 ? "" : "s"} failed to sync
        </span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-warning/10 border-b border-warning/30 text-sm">
      <span className="inline-flex items-center gap-2 text-warning-foreground">
        {syncing
          ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
          : <CloudOff className="h-4 w-4 text-warning" />}
        <span className="text-foreground">
          {pending} action{pending === 1 ? "" : "s"} waiting to sync
        </span>
      </span>
      <Button size="sm" variant="outline" onClick={onSyncNow} disabled={!online || syncing}>
        {syncing ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  );
}

function PreviousWeekPill({ token, workerId }: { token: string; workerId: string }) {
  const fn = useServerFn(workerWeekSummary);

  // Previous week (Sunday) ISO
  const prevWeekStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() - 7);
    return d.toISOString().slice(0, 10);
  })();

  const { data, isLoading } = useQuery({
    queryKey: ["worker-prev-week", workerId, prevWeekStart],
    queryFn: () => fn({ data: { token, weekStart: prevWeekStart } }),
  });

  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<{ url: string; mime: string } | null>(null);

  if (isLoading || !data) return null;

  const statusStyle =
    data.status === "paid"
      ? "bg-success/10 text-success border-success/20"
      : data.status === "overdue"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-warning/10 text-warning border-warning/20";

  const fmtRange = (s: string, e: string) => {
    const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${new Date(s).toLocaleDateString([], o)} – ${new Date(e).toLocaleDateString([], o)}`;
  };

  return (
    <div className="w-full max-w-sm">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 shadow-sm flex items-center justify-between gap-3 active:scale-[0.99] transition-transform touch-manipulation"
      >
        <div className="text-left min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last week</p>
          <p className="text-sm font-medium truncate">{fmtRange(data.weekStart, data.weekEnd)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-base font-bold tabular-nums">{fmtMoney(data.total)}</span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${statusStyle}`}>
            {data.status}
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Last week's pay</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{fmtRange(data.weekStart, data.weekEnd)}</p>

            <div className="rounded-lg border border-border divide-y divide-border">
              <Row label="Hours" value={fmtHours(data.hours)} />
              <Row label="Wages" value={fmtMoney(data.wages)} />
              <Row label="Reimbursements" value={fmtMoney(data.reimbTotal)} />
              <Row label="Total" value={fmtMoney(data.total)} bold />
              {data.status === "paid" && data.actualPaid != null && data.actualPaid !== data.total && (
                <Row label="Actually paid" value={fmtMoney(data.actualPaid)} />
              )}
              {data.status === "paid" && data.tipAmount != null && data.tipAmount > 0 && (
                <Row label="Tip" value={fmtMoney(data.tipAmount)} />
              )}
            </div>

            <div className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-between ${statusStyle}`}>
              <span className="font-semibold uppercase tracking-wider text-xs">{data.status}</span>
              {data.paidAt && (
                <span className="text-xs opacity-80">
                  {new Date(data.paidAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
              )}
            </div>

            {data.reimbursements.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Receipts</p>
                <ul className="space-y-1.5">
                  {data.reimbursements.map((r: any) => (
                    <li key={r.id} className="flex items-center gap-2 text-sm">
                      {r.receipt_url ? (
                        <button
                          type="button"
                          onClick={() => setViewing({ url: r.receipt_url, mime: r.receipt_mime || "image/jpeg" })}
                          className="block h-8 w-8 shrink-0 overflow-hidden rounded bg-secondary"
                        >
                          {(r.receipt_mime || "").startsWith("image/") ? (
                            <img src={r.receipt_url} alt="Receipt" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                      ) : (
                        <div className="h-8 w-8 shrink-0 rounded bg-secondary" />
                      )}
                      <span className="truncate flex-1">{r.description}</span>
                      <span className="tabular-nums shrink-0">{fmtMoney(Number(r.amount))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {viewing && ((viewing.mime || "").startsWith("image/") ? (
            <img src={viewing.url} alt="Receipt" className="max-h-[70vh] w-full object-contain rounded" />
          ) : (
            <a href={viewing.url} target="_blank" rel="noreferrer" className="text-primary underline">
              Open receipt
            </a>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

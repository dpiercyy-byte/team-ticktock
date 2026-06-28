import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Wifi, WifiOff, LogOut, Briefcase, Clock, Receipt, Upload, X, FileText, Trash2, Paperclip,
  MapPin, MapPinOff,
} from "lucide-react";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { listWorkersPublic, workerLogin } from "@/lib/auth.functions";
import { getWorkerState, clockIn, clockOut, workerSetEntryReason } from "@/lib/entries.functions";
import {
  workerSubmitReimbursement, workerUploadReceipt,
  workerListReimbursements, workerDeleteReimbursement,
} from "@/lib/reimbursements.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  getWorkerSession, setWorkerSession, clearWorkerSession, type WorkerSession,
} from "@/lib/session";
import { useOnline } from "@/hooks/use-online";
import { fmtHours, fmtMoney, diffHours } from "@/lib/format";

const ALLOWED_RECEIPT_MIMES = ["image/jpeg", "image/png", "application/pdf"] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

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
    return <PinLogin onLogin={(s) => { setWorkerSession(s); setSession(s); }} />;
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
    onSuccess: (r) => onLogin({ token: r.token, id: r.worker.id, name: r.worker.name }),
    onError: () => { toast.error("Invalid PIN"); setPin(""); },
  });

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-3"
               style={{ background: "var(--gradient-primary)" }}>
            <Clock className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Clockwise</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {workerId ? "Enter your PIN" : "Select your name"}
          </p>
        </div>

        {!workerId ? (
          <Card className="p-4 space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : workers && workers.length > 0 ? (
              <div>
                <Label className="text-xs text-muted-foreground">Select your name</Label>
                <Select onValueChange={(val) => setWorkerId(val)}>
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue placeholder="Choose a worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground text-center">
                No workers yet. Ask your admin to add you.
              </p>
            )}
          </Card>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (pin.length >= 4) m.mutate(); }}
                className="space-y-4">
            <div className="text-center text-sm">
              Signing in as{" "}
              <span className="font-semibold">
                {workers?.find(w => w.id === workerId)?.name}
              </span>
            </div>
            <div>
              <Label htmlFor="pin" className="sr-only">PIN</Label>
              <Input
                id="pin" type="password" inputMode="numeric" autoComplete="off"
                autoFocus maxLength={12}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-[0.5em] h-14"
                placeholder="••••"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base" disabled={pin.length < 4 || m.isPending}>
              {m.isPending ? "Checking…" : "Sign in"}
            </Button>
            <button type="button" onClick={() => { setWorkerId(null); setPin(""); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground">
              ← Choose a different name
            </button>
          </form>
        )}

        <div className="text-center">
          <a href="/admin" className="text-xs text-muted-foreground hover:text-foreground">
            Admin sign in
          </a>
        </div>
      </div>
    </div>
  );
}

function ClockInScreen({ session, onLogout }: { session: WorkerSession; onLogout: () => void }) {
  const online = useOnline();
  const stateFn = useServerFn(getWorkerState);
  const inFn = useServerFn(clockIn);
  const outFn = useServerFn(clockOut);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
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

  const [lastGeo, setLastGeo] = useState<null | { status: "verified" | "off_site" | "no_gps"; siteLabel: string | null }>(null);

  const inMut = useMutation({
    mutationFn: async () => {
      const coords = await getGeo();
      return inFn({ data: {
        token: session.token,
        project: project || undefined,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      } });
    },
    onSuccess: (r) => {
      setProject("");
      setLastGeo({ status: r.geo.status, siteLabel: r.geo.siteLabel });
      qc.invalidateQueries({ queryKey: ["worker-state", session.id] });
      toast.success("Clocked in");
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const outMut = useMutation({
    mutationFn: async () => {
      const coords = await getGeo();
      return outFn({ data: {
        token: session.token,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      } });
    },
    onSuccess: (r) => {
      setLastGeo({ status: r.geo.status, siteLabel: r.geo.siteLabel });
      qc.invalidateQueries({ queryKey: ["worker-state", session.id] });
      toast.success("Clocked out");
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });


  const active = data?.active;
  const settings = data?.settings;
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

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 border-b border-border bg-card">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="font-semibold truncate">{session.name}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`flex items-center gap-1 text-xs ${online ? "text-success" : "text-muted-foreground"}`}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? "Online" : "Offline"}
          </span>
          <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {active ? "Currently Working" : "Not Clocked In"}
              </p>
              {active && (
                <p className="mt-2 text-5xl sm:text-6xl font-bold tabular-nums tracking-tight select-none">{sessionStr}</p>
              )}
              {active?.project && (
                <p className="mt-2 text-sm text-muted-foreground inline-flex items-center gap-1.5">
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
                      className="h-40 w-40 rounded-full text-lg font-bold shadow-lg touch-manipulation select-none active:scale-95 transition-transform"
                      style={{ background: "var(--destructive)", color: "var(--destructive-foreground)" }}>
                {outMut.isPending ? "…" : "Clock Out"}
              </Button>
            ) : (
              <Button size="lg" onClick={() => inMut.mutate()} disabled={inMut.isPending}
                      className="h-40 w-40 rounded-full text-lg font-bold shadow-[var(--shadow-elevated)] touch-manipulation select-none active:scale-95 transition-transform"
                      style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}>
                {inMut.isPending ? "…" : "Clock In"}
              </Button>
            )}

            {lastGeo && (
              <p className={`text-xs inline-flex items-center gap-1.5 -mt-2 ${
                lastGeo.status === "verified" ? "text-success" :
                lastGeo.status === "off_site" ? "text-warning" : "text-muted-foreground"
              }`}>
                {lastGeo.status === "no_gps"
                  ? <><MapPinOff className="h-3.5 w-3.5" /> Location unavailable</>
                  : lastGeo.status === "verified"
                  ? <><MapPin className="h-3.5 w-3.5" /> Verified at {lastGeo.siteLabel}</>
                  : <><MapPin className="h-3.5 w-3.5" /> Off-site</>}
              </p>
            )}

            <button onClick={() => refetch()} className="text-xs text-muted-foreground">
              Tap to refresh

            </button>

            <ReimbursementsSection token={session.token} workerId={session.id} />
          </>
        )}
      </main>

      <section className="border-t border-border bg-card px-6 py-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] grid grid-cols-2 gap-4">
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
  const [receipt, setReceipt] = useState<{ url: string; mime: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<{ url: string; mime: string } | null>(null);

  const reset = () => { setAmt(""); setDesc(""); setReceipt(null); };

  const lq = useQuery({
    queryKey: ["worker-reimb", workerId],
    queryFn: () => listFn({ data: { token } }),
  });

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
    if (!ALLOWED_RECEIPT_MIMES.includes(file.type as any)) {
      toast.error("Only JPG, PNG or PDF allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max file size is 10MB");
      return;
    }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const r = await uploadFn({ data: { token, filename: file.name, mime: file.type as any, base64 } });
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
      description: desc.trim(),
      amount: parseFloat(amt) || 0,
      receiptUrl: receipt?.url ?? null,
      receiptMime: receipt?.mime ?? null,
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
        <Receipt className="h-4 w-4 mr-2" />
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
              <Label htmlFor="r-amt" className="text-xs">Amount ($)</Label>
              <Input
                id="r-amt" type="number" step="0.01" inputMode="decimal" min="0"
                value={amt} onChange={(e) => setAmt(e.target.value)}
                placeholder="0.00" className="mt-1.5 h-11 text-base"
              />
            </div>
            <div>
              <Label htmlFor="r-desc" className="text-xs">Description</Label>
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
                  <label className="block">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      capture="environment"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (f) handleFile(f);
                      }}
                    />
                    <span className={`flex items-center justify-center gap-2 text-sm px-3 py-2.5 rounded-md border border-dashed border-border cursor-pointer hover:bg-secondary ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                      <Upload className="h-4 w-4" />
                      {uploading ? "Uploading…" : "Attach receipt"}
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => submit.mutate()}
              disabled={!desc.trim() || !amt || parseFloat(amt) <= 0 || uploading || submit.isPending}
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

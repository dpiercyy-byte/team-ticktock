import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Clock, LogOut, Plus, Trash2, Pencil, Download, AlertTriangle, KeyRound, DollarSign,
  Paperclip, Upload, X, FileText, MapPin, MapPinOff, Archive, ArchiveRestore, Search, Truck, Building2,
} from "lucide-react";

import {
  adminLogin, adminVerify, adminChangePassword,
} from "@/lib/auth.functions";
import {
  listWorkersAdmin, createWorker, deleteWorker, setWorkerRate, resetWorkerPin,
} from "@/lib/workers.functions";
import {
  adminListEntries, adminAddEntry, adminEditEntry, adminDeleteEntry, adminFlaggedEntries,
  adminUpdateEntryGeo,
} from "@/lib/entries.functions";
import { getPublicSettings, updateSettings } from "@/lib/settings.functions";
import {
  listReimbursements, addReimbursement, deleteReimbursement, uploadReceipt,
} from "@/lib/reimbursements.functions";
import { weeklyPayout, exportEntriesCsv } from "@/lib/payout.functions";
import {
  adminListJobSites, adminAddJobSite, adminUpdateJobSite, adminDeleteJobSite, adminArchiveJobSite,
  adminSearchPlaces, adminBulkAddJobSites,
} from "@/lib/jobsites.functions";
import { adminListAuditLog } from "@/lib/audit.functions";

import { getAdminToken, setAdminToken, clearAdminToken } from "@/lib/session";
import { fmtHours, fmtMoney, fmtTime, fmtDate, startOfWeekISO, diffHours } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

const INACTIVITY_MS = 30 * 60 * 1000;
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

export function AdminApp() {
  const [token, setTokenState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const verify = useServerFn(adminVerify);

  useEffect(() => {
    const t = getAdminToken();
    if (!t) { setHydrated(true); return; }
    verify({ data: { token: t } })
      .then((r) => { setAdminToken(r.token); setTokenState(r.token); })
      .catch(() => { clearAdminToken(); })
      .finally(() => setHydrated(true));
  }, [verify]);

  // Inactivity logout
  useEffect(() => {
    if (!token) return;
    let last = Date.now();
    const reset = () => { last = Date.now(); };
    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach(e => window.addEventListener(e, reset));
    const t = setInterval(() => {
      if (Date.now() - last > INACTIVITY_MS) {
        clearAdminToken(); setTokenState(null);
        toast.info("Logged out due to inactivity");
      }
    }, 30_000);
    return () => { events.forEach(e => window.removeEventListener(e, reset)); clearInterval(t); };
  }, [token]);

  const updateToken = (newToken: string) => { setAdminToken(newToken); setTokenState(newToken); };

  if (!hydrated) return <div className="min-h-dvh bg-background" />;
  if (!token) return <AdminLogin onLogin={updateToken} />;
  return <AdminDashboard token={token} updateToken={updateToken}
                         onLogout={() => { clearAdminToken(); setTokenState(null); }} />;
}

function AdminLogin({ onLogin }: { onLogin: (t: string) => void }) {
  const login = useServerFn(adminLogin);
  const [pw, setPw] = useState("");
  const m = useMutation({
    mutationFn: () => login({ data: { password: pw } }),
    onSuccess: (r) => onLogin(r.token),
    onError: () => { toast.error("Invalid password"); setPw(""); },
  });
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-2"
               style={{ background: "var(--gradient-primary)" }}>
            <KeyRound className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle>Admin Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                     autoFocus className="mt-1.5" />
            </div>
            <Button type="submit" className="w-full" disabled={m.isPending || !pw}>
              {m.isPending ? "…" : "Sign in"}
            </Button>
            <div className="text-center">
              <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
                ← Back to worker app
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboard({ token, updateToken, onLogout }: {
  token: string; updateToken: (t: string) => void; onLogout: () => void;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                 style={{ background: "var(--gradient-primary)" }}>
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold truncate">Clockwise Admin</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Session expires after 30 min idle</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout} className="shrink-0">
            <LogOut className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <Tabs defaultValue="entries">
          <div className="-mx-4 sm:mx-0 mb-4 sm:mb-6 overflow-x-auto">
            <TabsList className="mx-4 sm:mx-0 w-max sm:w-auto">
              <TabsTrigger value="entries">Time Entries</TabsTrigger>
              <TabsTrigger value="payouts">Weekly Payouts</TabsTrigger>
              <TabsTrigger value="workers">Workers</TabsTrigger>
              <TabsTrigger value="sites">Job Sites</TabsTrigger>
              <TabsTrigger value="audit">Audit Log</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="entries"><EntriesTab token={token} updateToken={updateToken} /></TabsContent>
          <TabsContent value="payouts"><PayoutsTab token={token} updateToken={updateToken} /></TabsContent>
          <TabsContent value="workers"><WorkersTab token={token} updateToken={updateToken} /></TabsContent>
          <TabsContent value="sites"><JobSitesTab token={token} updateToken={updateToken} /></TabsContent>
          <TabsContent value="audit"><AuditTab token={token} updateToken={updateToken} /></TabsContent>
          <TabsContent value="settings"><SettingsTab token={token} updateToken={updateToken} /></TabsContent>
        </Tabs>

      </div>
    </div>
  );
}

// ===== Entries tab =====
function EntriesTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listW = useServerFn(listWorkersAdmin);
  const listE = useServerFn(adminListEntries);
  const flagFn = useServerFn(adminFlaggedEntries);
  const addE = useServerFn(adminAddEntry);
  const editE = useServerFn(adminEditEntry);
  const delE = useServerFn(adminDeleteEntry);
  const updGeo = useServerFn(adminUpdateEntryGeo);
  const listSites = useServerFn(adminListJobSites);
  const settingsFn = useServerFn(getPublicSettings);
  const qc = useQueryClient();

  const sitesQ = useQuery({
    queryKey: ["adm-jobsites"],
    queryFn: () => listSites({ data: { token } }).then(r => { updateToken(r.token); return r.sites; }),
  });

  const wq = useQuery({
    queryKey: ["adm-workers"],
    queryFn: () => listW({ data: { token } }).then((r) => { updateToken(r.token); return r.workers; }),
  });
  const sq = useQuery({ queryKey: ["pub-settings"], queryFn: () => settingsFn() });
  const flagQ = useQuery({
    queryKey: ["flagged"],
    queryFn: () => flagFn({ data: { token } }).then(r => { updateToken(r.token); return r.entries; }),
  });

  const [workerId, setWorkerId] = useState<string | null>(null);
  useEffect(() => { if (!workerId && wq.data?.[0]) setWorkerId(wq.data[0].id); }, [wq.data, workerId]);

  const eq = useQuery({
    enabled: !!workerId,
    queryKey: ["entries", workerId],
    queryFn: () => listE({ data: { token, workerId: workerId! } }).then(r => { updateToken(r.token); return r.entries; }),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const projectsEnabled = sq.data?.project_tracking_enabled;

  const totals = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const wk = new Date(startOfWeekISO()); wk.setHours(0, 0, 0, 0);
    let day = 0, week = 0, month = 0;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    for (const e of eq.data ?? []) {
      if (!e.clock_out) continue;
      const h = diffHours(e.clock_in, e.clock_out);
      const d = new Date(e.clock_in);
      if (d >= today) day += h;
      if (d >= wk) week += h;
      if (d >= monthStart) month += h;
    }
    return { day, week, month };
  })();

  // group entries by date
  const byDate = (eq.data ?? []).reduce<Record<string, any[]>>((acc, e) => {
    const k = new Date(e.clock_in).toDateString();
    (acc[k] ||= []).push(e); return acc;
  }, {});

  return (
    <div className="space-y-6">
      {flagQ.data && flagQ.data.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <CardTitle className="text-base">Pending review ({flagQ.data.length})</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {flagQ.data.slice(0, 5).map((f: any) => (
              <p key={f.id}>
                <span className="font-medium">{f.workers?.name}</span> · {fmtDate(f.clock_in)}
                {" · "}
                {f.clock_out ? `${diffHours(f.clock_in, f.clock_out).toFixed(1)} hrs` : "still clocked in"}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs">Worker</Label>
          <Select value={workerId ?? ""} onValueChange={setWorkerId}>
            <SelectTrigger className="w-full sm:w-[220px] mt-1.5"><SelectValue placeholder="Select worker" /></SelectTrigger>
            <SelectContent>
              {wq.data?.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setAdding(true)} disabled={!workerId} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Add entry
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Today" value={fmtHours(totals.day)} />
        <Stat label="This Week" value={fmtHours(totals.week)} />
        <Stat label="This Month" value={fmtHours(totals.month)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {!workerId || eq.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (eq.data?.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No entries yet for this worker.</p>
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(byDate).map(([date, items]) => {
                const dayHours = items.reduce((s, e) => s + (e.clock_out ? diffHours(e.clock_in, e.clock_out) : 0), 0);
                return (
                  <div key={date}>
                    <div className="px-4 sm:px-5 py-2 bg-secondary flex justify-between text-sm">
                      <span className="font-medium">{fmtDate(items[0].clock_in)}</span>
                      <span className="text-muted-foreground tabular-nums">{fmtHours(dayHours)}</span>
                    </div>
                    {items.map((e: any) => (
                      <div key={e.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium tabular-nums text-sm sm:text-base">
                            {fmtTime(e.clock_in)} – {e.clock_out ? fmtTime(e.clock_out) : <span className="text-success">active</span>}
                            <span className="ml-2 sm:ml-3 text-muted-foreground text-xs sm:text-sm">
                              {e.clock_out ? `${diffHours(e.clock_in, e.clock_out).toFixed(2)} hrs` : ""}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-1.5 items-center">
                            <span className="truncate max-w-[160px]">{e.project ?? "General"}</span>
                            {e.created_by === "admin" && <Badge variant="outline" className="h-4 text-[10px]">manual</Badge>}
                            {e.flagged_review && <Badge className="h-4 text-[10px] bg-warning text-warning-foreground">flagged</Badge>}
                            <GeoTagEditor
                              entry={e}
                              sites={sitesQ.data ?? []}
                              onUpdate={async (status, jobSiteId) => {
                                try {
                                  const r = await updGeo({ data: { token, entryId: e.id, status, jobSiteId } });
                                  updateToken(r.token);
                                  qc.invalidateQueries({ queryKey: ["entries", workerId] });
                                  toast.success("Tag updated");
                                } catch (err: any) { toast.error(err?.message || "Failed"); }
                              }}
                            />
                            {e.offsite_reason_code && (
                              <span
                                className="text-[11px] text-muted-foreground italic truncate max-w-[180px]"
                                title={e.offsite_reason_note || undefined}
                              >
                                · {reasonLabel(e.offsite_reason_code)}{e.offsite_reason_note ? `: ${e.offsite_reason_note}` : ""}
                              </span>
                            )}
                          </p>

                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setConfirmDel(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <EntryDialog
        open={adding} onClose={() => setAdding(false)}
        title="Add time entry" projectsEnabled={!!projectsEnabled}
        onSubmit={async (vals) => {
          try {
            const r = await addE({ data: { token, workerId: workerId!, ...vals } });
            updateToken(r.token);
            qc.invalidateQueries({ queryKey: ["entries", workerId] });
            toast.success("Entry added");
            setAdding(false);
          } catch (e: any) { toast.error(e?.message || "Failed"); }
        }}
      />
      {editing && (
        <EntryDialog
          open onClose={() => setEditing(null)}
          title="Edit entry" projectsEnabled={!!projectsEnabled}
          initial={{
            clockIn: editing.clock_in, clockOut: editing.clock_out, project: editing.project,
          }}
          allowOpenEnd
          onSubmit={async (vals) => {
            try {
              const r = await editE({ data: { token, entryId: editing.id, ...vals, clockOut: vals.clockOut || null, project: vals.project || null } });
              updateToken(r.token);
              qc.invalidateQueries({ queryKey: ["entries", workerId] });
              toast.success("Entry updated");
              setEditing(null);
            } catch (e: any) { toast.error(e?.message || "Failed"); }
          }}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={() => setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const id = confirmDel!;
              setConfirmDel(null);
              try {
                const r = await delE({ data: { token, entryId: id } });
                updateToken(r.token);
                qc.invalidateQueries({ queryKey: ["entries", workerId] });
                toast.success("Deleted");
              } catch (e: any) { toast.error(e?.message || "Failed"); }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
    </CardContent></Card>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
function fromLocalInput(v: string) {
  return new Date(v).toISOString();
}

function EntryDialog({ open, onClose, title, projectsEnabled, initial, allowOpenEnd, onSubmit }: {
  open: boolean; onClose: () => void; title: string; projectsEnabled: boolean;
  initial?: { clockIn: string; clockOut?: string | null; project?: string | null };
  allowOpenEnd?: boolean;
  onSubmit: (v: { clockIn: string; clockOut: string; project?: string }) => void;
}) {
  const [ci, setCi] = useState(toLocalInput(initial?.clockIn) || toLocalInput(new Date().toISOString()));
  const [co, setCo] = useState(toLocalInput(initial?.clockOut) || "");
  const [p, setP] = useState(initial?.project ?? "");
  useEffect(() => {
    if (open) {
      setCi(toLocalInput(initial?.clockIn) || toLocalInput(new Date().toISOString()));
      setCo(toLocalInput(initial?.clockOut) || "");
      setP(initial?.project ?? "");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Clock in</Label>
            <Input type="datetime-local" value={ci} onChange={(e) => setCi(e.target.value)} />
          </div>
          <div>
            <Label>Clock out {allowOpenEnd && <span className="text-xs text-muted-foreground">(blank = still active)</span>}</Label>
            <Input type="datetime-local" value={co} onChange={(e) => setCo(e.target.value)} />
          </div>
          {projectsEnabled && (
            <div>
              <Label>Project (optional)</Label>
              <Input value={p} onChange={(e) => setP(e.target.value)} maxLength={100} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!ci) return;
            if (!allowOpenEnd && !co) return;
            onSubmit({
              clockIn: fromLocalInput(ci),
              clockOut: co ? fromLocalInput(co) : "",
              project: p || undefined,
            });
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Workers tab =====
function WorkersTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listFn = useServerFn(listWorkersAdmin);
  const createFn = useServerFn(createWorker);
  const delFn = useServerFn(deleteWorker);
  const rateFn = useServerFn(setWorkerRate);
  const pinFn = useServerFn(resetWorkerPin);
  const qc = useQueryClient();

  const wq = useQuery({
    queryKey: ["adm-workers"],
    queryFn: () => listFn({ data: { token } }).then((r) => { updateToken(r.token); return r.workers; }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["adm-workers"] });

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""); const [pin, setPin] = useState(""); const [rate, setRate] = useState("0");
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);
  const [resetting, setResetting] = useState<{ id: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add worker</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add worker</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>PIN (4–12 digits)</Label>
                <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} maxLength={12} type="password" />
              </div>
              <div><Label>Hourly rate ($)</Label>
                <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  const r = await createFn({ data: { token, name, pin, hourlyRate: parseFloat(rate) || 0 } });
                  updateToken(r.token); refresh(); toast.success("Worker added");
                  setAdding(false); setName(""); setPin(""); setRate("0");
                } catch (e: any) { toast.error(e?.message || "Failed"); }
              }} disabled={!name.trim() || pin.length < 4}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        {wq.isLoading ? <p className="p-6 text-sm">Loading…</p> :
         wq.data?.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">No workers yet.</p> :
         <div className="divide-y divide-border">
           {wq.data?.map(w => (
             <div key={w.id} className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
               <div className="min-w-0">
                 <p className="font-medium truncate">{w.name}</p>
                 <p className="text-xs text-muted-foreground">${Number(w.hourly_rate).toFixed(2)}/hr</p>
               </div>
               <div className="flex items-center gap-2 shrink-0 ml-auto">
                 <RateEditor worker={w} onSave={async (v) => {
                   try { const r = await rateFn({ data: { token, workerId: w.id, hourlyRate: v } });
                     updateToken(r.token); refresh(); toast.success("Rate updated"); }
                   catch (e: any) { toast.error(e?.message || "Failed"); }
                 }} />
                 <Button variant="outline" size="sm" onClick={() => { setResetting({ id: w.id, name: w.name }); setNewPin(""); }}>
                   <KeyRound className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">PIN</span>
                 </Button>
                 <Button variant="ghost" size="icon" onClick={() => setConfirmDel({ id: w.id, name: w.name })}>
                   <Trash2 className="h-4 w-4 text-destructive" />
                 </Button>
               </div>
             </div>
           ))}
         </div>}
      </CardContent></Card>

      <Dialog open={!!resetting} onOpenChange={() => setResetting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset PIN for {resetting?.name}</DialogTitle></DialogHeader>
          <div>
            <Label>New PIN (4–12 digits)</Label>
            <Input type="password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} maxLength={12} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>Cancel</Button>
            <Button disabled={newPin.length < 4} onClick={async () => {
              try { const r = await pinFn({ data: { token, workerId: resetting!.id, newPin } });
                updateToken(r.token); toast.success("PIN reset"); setResetting(null); }
              catch (e: any) { toast.error(e?.message || "Failed"); }
            }}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={() => setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDel?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              All their time entries and reimbursements will be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const id = confirmDel!.id; setConfirmDel(null);
              try { const r = await delFn({ data: { token, workerId: id } });
                updateToken(r.token); refresh(); toast.success("Worker removed"); }
              catch (e: any) { toast.error(e?.message || "Failed"); }
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RateEditor({ worker, onSave }: { worker: any; onSave: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(worker.hourly_rate));
  useEffect(() => setV(String(worker.hourly_rate)), [worker.hourly_rate, open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><DollarSign className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Rate</span></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Set hourly rate — {worker.name}</DialogTitle></DialogHeader>
        <Input type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onSave(parseFloat(v) || 0); setOpen(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Payouts tab =====
function PayoutsTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const payFn = useServerFn(weeklyPayout);
  const csvFn = useServerFn(exportEntriesCsv);
  const reimbList = useServerFn(listReimbursements);
  const reimbAdd = useServerFn(addReimbursement);
  const reimbDel = useServerFn(deleteReimbursement);
  const upload = useServerFn(uploadReceipt);
  const qc = useQueryClient();

  const [week, setWeek] = useState(startOfWeekISO());

  const pq = useQuery({
    queryKey: ["payout", week],
    queryFn: () => payFn({ data: { token, weekStart: week } }).then(r => { updateToken(r.token); return r.summary; }),
  });

  // Realtime: any reimbursement change → recalc payout & open list
  useEffect(() => {
    const channel = supabase
      .channel("admin-reimb")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "reimbursements",
      }, () => {
        qc.invalidateQueries({ queryKey: ["payout", week] });
        qc.invalidateQueries({ queryKey: ["reimb"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, week]);

  const [reimbFor, setReimbFor] = useState<{ id: string; name: string } | null>(null);
  const [desc, setDesc] = useState(""); const [amt, setAmt] = useState("");
  const [receipt, setReceipt] = useState<{ url: string; mime: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<{ url: string; mime: string } | null>(null);

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
      const r = await upload({ data: { token, filename: file.name, mime: file.type as any, base64 } });
      updateToken(r.token);
      setReceipt({ url: r.url, mime: r.mime });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const rq = useQuery({
    enabled: !!reimbFor,
    queryKey: ["reimb", reimbFor?.id, week],
    queryFn: () => reimbList({ data: { token, workerId: reimbFor!.id, weekStart: week } })
      .then(r => { updateToken(r.token); return r.items; }),
  });

  const downloadCsv = async () => {
    try {
      const r = await csvFn({ data: { token, weekStart: week } });
      updateToken(r.token);
      const blob = new Blob([r.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `time-entries-${week}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const downloadPayoutCsv = () => {
    if (!pq.data) return;
    const header = "Worker,Hours,Rate,Wages,Reimbursements,Total\n";
    const rows = pq.data.map((s: any) =>
      `"${s.name}",${s.hours.toFixed(2)},${s.hourlyRate.toFixed(2)},${s.wages.toFixed(2)},${s.reimbTotal.toFixed(2)},${s.total.toFixed(2)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payout-${week}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs">Week starting (Sunday)</Label>
          <Input type="date" value={week} onChange={(e) => {
            const d = new Date(e.target.value);
            d.setDate(d.getDate() - d.getDay());
            setWeek(d.toISOString().slice(0, 10));
          }} className="mt-1.5 w-full sm:w-[200px]" />
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={downloadCsv} className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 mr-2" /><span className="hidden xs:inline">Time entries </span>CSV
          </Button>
          <Button onClick={downloadPayoutCsv} className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 mr-2" />Payout CSV
          </Button>
        </div>
      </div>

      <Card><CardContent className="p-0">
        {pq.isLoading ? <p className="p-6 text-sm">Loading…</p> : (
          <ul className="divide-y divide-border">
            {pq.data?.length === 0 && (
              <li className="p-6 text-sm text-muted-foreground text-center">No workers yet.</li>
            )}
            {pq.data?.map((s: any) => (
              <li key={s.workerId} className="p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-base truncate">{s.name}</p>
                  <Button size="sm" variant="outline"
                          onClick={() => { setReimbFor({ id: s.workerId, name: s.name }); setDesc(""); setAmt(""); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Reimb.
                  </Button>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">
                      Labour <span className="tabular-nums">({s.hours.toFixed(2)} hrs × ${s.hourlyRate.toFixed(2)})</span>
                    </span>
                    <span className="tabular-nums font-medium">{fmtMoney(s.wages)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">
                      Reimbursements <span className="tabular-nums">({s.reimbursements?.length ?? 0})</span>
                    </span>
                    <span className="tabular-nums font-medium">{fmtMoney(s.reimbTotal)}</span>
                  </div>
                  {s.reimbursements?.length > 0 && (
                    <ul className="ml-3 mt-1 space-y-0.5 text-xs text-muted-foreground border-l border-border pl-3">
                      {s.reimbursements.map((r: any) => (
                        <li key={r.id ?? `${r.description}-${r.amount}`} className="flex items-baseline justify-between gap-2">
                          <span className="truncate">{r.description}</span>
                          <span className="tabular-nums">{fmtMoney(Number(r.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t border-border">
                    <span className="font-semibold">Total owed</span>
                    <span className="tabular-nums font-bold text-base">{fmtMoney(s.total)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>

      <Dialog open={!!reimbFor} onOpenChange={(o) => { if (!o) { setReimbFor(null); setReceipt(null); setDesc(""); setAmt(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reimbursements — {reimbFor?.name} (week of {week})</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} className="flex-1 min-w-[140px]" />
                <Input type="number" step="0.01" placeholder="Amount" value={amt}
                       onChange={(e) => setAmt(e.target.value)} className="w-[110px]" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {receipt ? (
                  <div className="flex items-center gap-2 rounded-md border border-border p-1.5 pr-2">
                    <button type="button" onClick={() => setViewing(receipt)}
                            className="block h-12 w-12 overflow-hidden rounded bg-secondary">
                      {receipt.mime.startsWith("image/") ? (
                        <img src={receipt.url} alt="Receipt preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </button>
                    <span className="text-xs text-muted-foreground">Receipt attached</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReceipt(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (f) handleFile(f);
                      }}
                    />
                    <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-secondary ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                      <Upload className="h-3.5 w-3.5" />
                      {uploading ? "Uploading…" : "Attach receipt (optional)"}
                    </span>
                  </label>
                )}
                <Button className="ml-auto" onClick={async () => {
                  try {
                    const r = await reimbAdd({ data: {
                      token, workerId: reimbFor!.id, weekStart: week,
                      description: desc, amount: parseFloat(amt) || 0,
                      receiptUrl: receipt?.url ?? null,
                      receiptMime: receipt?.mime ?? null,
                    } });
                    updateToken(r.token); setDesc(""); setAmt(""); setReceipt(null);
                    qc.invalidateQueries({ queryKey: ["reimb", reimbFor!.id, week] });
                    qc.invalidateQueries({ queryKey: ["payout", week] });
                  } catch (e: any) { toast.error(e?.message || "Failed"); }
                }} disabled={!desc.trim() || !amt || uploading}>Add</Button>
              </div>
            </div>
            <div className="border border-border rounded-md divide-y divide-border max-h-72 overflow-auto">
              {rq.data?.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No reimbursements this week.</p>
              ) : rq.data?.map((r: any) => (
                <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {r.receipt_url ? (
                      <button type="button"
                              onClick={() => setViewing({ url: r.receipt_url, mime: r.receipt_mime || "image/jpeg" })}
                              className="block h-10 w-10 shrink-0 overflow-hidden rounded bg-secondary">
                        {(r.receipt_mime || "").startsWith("image/") ? (
                          <img src={r.receipt_url} alt="Receipt" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                    ) : null}
                    <p className="truncate flex items-center gap-1.5">
                      {r.description}
                      {r.receipt_url && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums">{fmtMoney(Number(r.amount))}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Delete reimbursement">
                          <Trash2 className="h-4 w-4 text-destructive" />
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
                          <AlertDialogAction onClick={async () => {
                            try {
                              const x = await reimbDel({ data: { token, id: r.id } });
                              updateToken(x.token);
                              qc.invalidateQueries({ queryKey: ["reimb", reimbFor!.id, week] });
                              qc.invalidateQueries({ queryKey: ["payout", week] });
                            } catch (e: any) { toast.error(e?.message || "Failed"); }
                          }}>Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {viewing && (viewing.mime === "application/pdf" ? (
            <iframe src={viewing.url} title="Receipt" className="w-full h-[70vh] rounded-md border border-border" />
          ) : (
            <img src={viewing.url} alt="Receipt" className="w-full max-h-[70vh] object-contain rounded-md" />
          ))}
          {viewing && (
            <DialogFooter>
              <a href={viewing.url} target="_blank" rel="noreferrer">
                <Button variant="outline">Open in new tab</Button>
              </a>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Settings tab =====
function SettingsTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const sFn = useServerFn(getPublicSettings);
  const upd = useServerFn(updateSettings);
  const chFn = useServerFn(adminChangePassword);
  const qc = useQueryClient();

  const sq = useQuery({ queryKey: ["pub-settings"], queryFn: () => sFn() });
  const [pw, setPw] = useState("");

  const setS = async (patch: Partial<{ projectTrackingEnabled: boolean; showPayEstimates: boolean }>) => {
    if (!sq.data) return;
    try {
      const r = await upd({ data: {
        token,
        projectTrackingEnabled: patch.projectTrackingEnabled ?? sq.data.project_tracking_enabled,
        showPayEstimates: patch.showPayEstimates ?? sq.data.show_pay_estimates,
      }});
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["pub-settings"] });
      toast.success("Settings updated");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Workspace settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Project / Job-site tracking</p>
              <p className="text-xs text-muted-foreground">Show project field on worker clock-in.</p>
            </div>
            <Switch checked={!!sq.data?.project_tracking_enabled}
                    onCheckedChange={(v) => setS({ projectTrackingEnabled: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show pay estimates to workers</p>
              <p className="text-xs text-muted-foreground">Workers see weekly $ estimate (off by default).</p>
            </div>
            <Switch checked={!!sq.data?.show_pay_estimates}
                    onCheckedChange={(v) => setS({ showPayEstimates: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change admin password</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} className="flex-1 min-w-[180px]" />
          <Button disabled={pw.length < 4} className="w-full sm:w-auto" onClick={async () => {
            try { const r = await chFn({ data: { token, newPassword: pw } });
              updateToken(r.token); setPw(""); toast.success("Password changed"); }
            catch (e: any) { toast.error(e?.message || "Failed"); }
          }}>Update</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Job Sites tab =====
function JobSitesTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listFn = useServerFn(adminListJobSites);
  const addFn = useServerFn(adminAddJobSite);
  const updFn = useServerFn(adminUpdateJobSite);
  const delFn = useServerFn(adminDeleteJobSite);
  const archFn = useServerFn(adminArchiveJobSite);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["job-sites"],
    queryFn: () => listFn({ data: { token } }).then((r) => { updateToken(r.token); return r.sites; }),
  });

  const [view, setView] = useState<"client" | "supplier" | "archived">("client");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"client" | "supplier">("client");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [radius, setRadius] = useState(100);
  const [editing, setEditing] = useState<any | null>(null);
  const [eLabel, setELabel] = useState("");
  const [eAddress, setEAddress] = useState("");
  const [eRadius, setERadius] = useState(100);
  const [eKind, setEKind] = useState<"client" | "supplier">("client");
  const [eOrigAddress, setEOrigAddress] = useState("");

  const openEdit = (s: any) => {
    setEditing(s);
    setELabel(s.label ?? "");
    setEAddress(s.address ?? "");
    setEOrigAddress(s.address ?? "");
    setERadius(s.radius_m ?? 100);
    setEKind((s.kind ?? "client") as "client" | "supplier");
  };

  const reset = () => { setAddress(""); setLabel(""); setRadius(100); setKind("client"); };

  const add = useMutation({
    mutationFn: () => addFn({ data: { token, address: address.trim(), label: label.trim() || undefined, radius_m: radius, kind } }),
    onSuccess: (r) => {
      updateToken(r.token);
      toast.success(kind === "supplier" ? "Supplier location added" : "Job site added");
      setView(kind);
      reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not geocode address"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { token, id } }),
    onSuccess: (r) => {
      updateToken(r.token);
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const upd = useMutation({
    mutationFn: (v: { id: string; label: string; radius_m: number; address?: string; kind?: "client" | "supplier" }) =>
      updFn({ data: { token, ...v } }),
    onSuccess: (r) => {
      updateToken(r.token);
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const saveEdit = useMutation({
    mutationFn: (v: { id: string; label: string; radius_m: number; address?: string; kind: "client" | "supplier" }) =>
      updFn({ data: { token, ...v } }),
    onSuccess: (r) => {
      updateToken(r.token);
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });


  const arch = useMutation({
    mutationFn: (v: { id: string; archived: boolean }) => archFn({ data: { token, ...v } }),
    onSuccess: (r, vars) => {
      updateToken(r.token);
      toast.success(vars.archived ? "Job archived" : "Job restored");
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const all = q.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((s: any) => {
      const isArchived = !!s.archived_at;
      const k = s.kind ?? "client";
      if (view === "archived" && !isArchived) return false;
      if (view !== "archived" && isArchived) return false;
      if (view === "client" && k !== "client") return false;
      if (view === "supplier" && k !== "supplier") return false;
      if (!term) return true;
      return (
        (s.label ?? "").toLowerCase().includes(term) ||
        (s.address ?? "").toLowerCase().includes(term)
      );
    });
  }, [all, view, search]);

  const counts = useMemo(() => {
    let client = 0, supplier = 0, archived = 0;
    for (const s of all as any[]) {
      if (s.archived_at) archived++;
      else if ((s.kind ?? "client") === "supplier") supplier++;
      else client++;
    }
    return { client, supplier, archived };
  }, [all]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold">Job Sites</h2>
          <p className="text-xs text-muted-foreground">
            Active jobs verify clock-ins. Supplier locations are recognized but not counted as job work. Archived jobs are hidden from verification.
          </p>
        </div>
        <div className="flex gap-2">
          <BulkAddDialog token={token} updateToken={updateToken} onAdded={(k) => setView(k)} />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Location</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add location</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (address.trim()) add.mutate(); }} className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setKind("client")}
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${kind === "client" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <Building2 className="h-4 w-4 text-success" />
                    <div className="leading-tight">
                      <div className="font-medium">Client job</div>
                      <div className="text-[11px] text-muted-foreground">Verified work site</div>
                    </div>
                  </button>
                  <button type="button" onClick={() => setKind("supplier")}
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${kind === "supplier" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <Truck className="h-4 w-4 text-primary" />
                    <div className="leading-tight">
                      <div className="font-medium">Supplier</div>
                      <div className="text-[11px] text-muted-foreground">Home Depot, Rona…</div>
                    </div>
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="addr">Address</Label>
                <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)}
                       placeholder="123 Oak St, Springfield" autoFocus className="mt-1.5" />
                <p className="text-xs text-muted-foreground mt-1">We'll look up the location automatically.</p>
              </div>
              <div>
                <Label htmlFor="lbl">Friendly name (optional)</Label>
                <Input id="lbl" value={label} onChange={(e) => setLabel(e.target.value)}
                       placeholder={kind === "supplier" ? "e.g. Home Depot - Main St" : "e.g. Smith Reno"} maxLength={80} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="rad">Radius: {radius} m</Label>
                <input id="rad" type="range" min={50} max={500} step={10}
                       value={radius} onChange={(e) => setRadius(parseInt(e.target.value))}
                       className="w-full mt-2" />
                <p className="text-xs text-muted-foreground">Larger = more lenient. Default 100 m works for most sites.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={add.isPending || !address.trim()}>
                  {add.isPending ? "Looking up…" : "Add location"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="inline-flex rounded-md border bg-card p-0.5 text-xs w-fit">
          {(["client", "supplier", "archived"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded capitalize ${view === v ? "bg-secondary font-medium" : "text-muted-foreground"}`}>
              {v === "client" ? `Active jobs (${counts.client})` : v === "supplier" ? `Suppliers (${counts.supplier})` : `Archived (${counts.archived})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={view === "archived" ? "Search archived…" : "Search…"} className="pl-8 h-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              {view === "archived"
                ? (search ? "No archived jobs match your search." : "No archived jobs yet.")
                : view === "supplier"
                ? "No supplier locations yet. Add Home Depot, Rona, etc. to recognize material pickup stops."
                : "No active job sites yet. Add one to enable geo-verification."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((s: any) => {
                const isArchived = !!s.archived_at;
                const isSupplier = (s.kind ?? "client") === "supplier";
                return (
                  <li key={s.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => !isArchived && openEdit(s)}
                        className={`block w-full text-left rounded -mx-1 px-1 py-0.5 ${isArchived ? "cursor-default" : "hover:bg-secondary/60 cursor-pointer"}`}
                        title={isArchived ? undefined : "Click to edit"}
                      >
                        <p className="font-medium truncate flex items-center gap-1.5">
                          {isSupplier
                            ? <Truck className="h-4 w-4 text-primary shrink-0" />
                            : <Building2 className={`h-4 w-4 shrink-0 ${isArchived ? "text-muted-foreground" : "text-success"}`} />}
                          <span className={isArchived ? "text-muted-foreground" : ""}>{s.label}</span>
                          {isArchived && <Badge variant="outline" className="h-4 text-[10px] ml-1">Archived</Badge>}
                          {!isArchived && <Pencil className="h-3 w-3 text-muted-foreground/60 ml-1 shrink-0" />}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.address}</p>
                      </button>

                      {!isArchived && (
                        <div className="flex items-center gap-2 mt-2">
                          <Label className="text-xs text-muted-foreground">Radius</Label>
                          <input type="range" min={50} max={500} step={10} defaultValue={s.radius_m}
                                 onChange={(e) => {
                                   const v = parseInt(e.target.value);
                                   upd.mutate({ id: s.id, label: s.label, radius_m: v });
                                 }}
                                 className="flex-1 max-w-[200px]" />
                          <span className="text-xs tabular-nums w-16">{s.radius_m} m</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isArchived ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => arch.mutate({ id: s.id, archived: false })}>
                            <ArchiveRestore className="h-4 w-4 mr-1" />Restore
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Delete permanently">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this location permanently?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This cannot be undone. Time entries linked to it lose the site label.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(s.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={isSupplier ? "Remove supplier" : "Archive job"}>
                              {isSupplier
                                ? <Trash2 className="h-4 w-4 text-destructive" />
                                : <Archive className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {isSupplier ? "Remove this supplier location?" : "Archive this job?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {isSupplier
                                  ? "It will no longer be recognized on clock-ins. Existing entries keep their tag."
                                  : "Archived jobs are hidden from geo-verification but can be restored anytime. Existing entries stay tagged."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() =>
                                isSupplier ? del.mutate(s.id) : arch.mutate({ id: s.id, archived: true })
                              }>
                                {isSupplier ? "Remove" : "Archive"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit location</DialogTitle></DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!eLabel.trim() || !eAddress.trim()) return;
                saveEdit.mutate({
                  id: editing.id,
                  label: eLabel.trim(),
                  radius_m: eRadius,
                  kind: eKind,
                  address: eAddress.trim() !== eOrigAddress ? eAddress.trim() : undefined,
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label className="mb-1.5 block">Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEKind("client")}
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${eKind === "client" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <Building2 className="h-4 w-4 text-success" />
                    <div className="leading-tight">
                      <div className="font-medium">Client job</div>
                      <div className="text-[11px] text-muted-foreground">Verified work site</div>
                    </div>
                  </button>
                  <button type="button" onClick={() => setEKind("supplier")}
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-sm text-left ${eKind === "supplier" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <Truck className="h-4 w-4 text-primary" />
                    <div className="leading-tight">
                      <div className="font-medium">Supplier</div>
                      <div className="text-[11px] text-muted-foreground">Home Depot, Rona…</div>
                    </div>
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="e-lbl">Friendly name</Label>
                <Input id="e-lbl" value={eLabel} onChange={(e) => setELabel(e.target.value)} maxLength={80} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="e-addr">Address</Label>
                <Input id="e-addr" value={eAddress} onChange={(e) => setEAddress(e.target.value)} className="mt-1.5" />
                <p className="text-xs text-muted-foreground mt-1">
                  {eAddress.trim() !== eOrigAddress
                    ? "Address changed — we'll re-geocode on save."
                    : "Edit to move the geofence to a new location."}
                </p>
              </div>
              <div>
                <Label htmlFor="e-rad">Radius: {eRadius} m</Label>
                <input id="e-rad" type="range" min={50} max={500} step={10}
                       value={eRadius} onChange={(e) => setERadius(parseInt(e.target.value))}
                       className="w-full mt-2" />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saveEdit.isPending || !eLabel.trim() || !eAddress.trim()}>
                  {saveEdit.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


type GeoStatus = "verified" | "supplier" | "off_site" | "no_gps";

const REASON_LABELS: Record<string, string> = {
  material_pickup: "Material pickup",
  client_visit: "Client visit",
  travel: "Travel between sites",
  forgot_clockout: "Forgot to clock out",
  new_site: "New / unlisted site",
  other: "Other",
};
function reasonLabel(code: string | null | undefined) {
  if (!code) return "";
  return REASON_LABELS[code] ?? code;
}

function GeoTagEditor({
  entry, sites, onUpdate,
}: {
  entry: any;
  sites: Array<{ id: string; label: string; kind?: string; archived_at?: string | null }>;
  onUpdate: (status: GeoStatus, jobSiteId: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const status: GeoStatus | null = entry.geo_status ?? null;

  const trigger =
    status === "verified" && entry.job_sites?.label ? (
      <Badge variant="outline" className="h-4 text-[10px] border-success text-success cursor-pointer hover:bg-success/10">
        <MapPin className="h-2.5 w-2.5 mr-0.5" />{entry.job_sites.label}
      </Badge>
    ) : status === "supplier" && entry.job_sites?.label ? (
      <Badge variant="outline" className="h-4 text-[10px] border-primary text-primary cursor-pointer hover:bg-primary/10">
        <Truck className="h-2.5 w-2.5 mr-0.5" />{entry.job_sites.label}
      </Badge>
    ) : status === "off_site" ? (
      <Badge variant="outline" className="h-4 text-[10px] border-warning text-warning cursor-pointer hover:bg-warning/10">
        <MapPin className="h-2.5 w-2.5 mr-0.5" />Off-site
      </Badge>
    ) : status === "no_gps" ? (
      <Badge variant="outline" className="h-4 text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary">
        <MapPinOff className="h-2.5 w-2.5 mr-0.5" />No GPS
      </Badge>
    ) : (
      <Badge variant="outline" className="h-4 text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary">
        <MapPinOff className="h-2.5 w-2.5 mr-0.5" />Set tag
      </Badge>
    );

  const pick = async (s: GeoStatus, jid: string | null) => {
    setOpen(false);
    await onUpdate(s, jid);
  };

  const active = sites.filter((s) => !s.archived_at);
  const clientSites = active.filter((s) => (s.kind ?? "client") === "client");
  const supplierSites = active.filter((s) => s.kind === "supplier");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex" aria-label="Edit geo tag">{trigger}</button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1 max-h-80 overflow-y-auto" align="start">
        {entry.offsite_reason_code && (
          <div className="px-2 py-2 mb-1 rounded bg-warning/10 border border-warning/30 text-[11px]">
            <div className="font-semibold text-warning uppercase tracking-wide mb-0.5">Worker reason</div>
            <div className="text-foreground">{reasonLabel(entry.offsite_reason_code)}</div>
            {entry.offsite_reason_note && (
              <div className="text-muted-foreground italic mt-0.5">"{entry.offsite_reason_note}"</div>
            )}
          </div>
        )}
        <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Client job</div>
        {clientSites.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No active jobs</div>
        )}
        {clientSites.map((s) => {
          const isActive = status === "verified" && entry.job_site_id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => pick("verified", s.id)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${isActive ? "bg-secondary" : ""}`}
            >
              <Building2 className="h-3 w-3 text-success" />
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}

        {supplierSites.length > 0 && (
          <>
            <div className="my-1 h-px bg-border" />
            <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Supplier</div>
            {supplierSites.map((s) => {
              const isActive = status === "supplier" && entry.job_site_id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick("supplier", s.id)}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${isActive ? "bg-secondary" : ""}`}
                >
                  <Truck className="h-3 w-3 text-primary" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </>
        )}

        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          onClick={() => pick("off_site", null)}
          className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${status === "off_site" ? "bg-secondary" : ""}`}
        >
          <MapPin className="h-3 w-3 text-warning" /> Off-site
        </button>
        <button
          type="button"
          onClick={() => pick("no_gps", null)}
          className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary flex items-center gap-1.5 ${status === "no_gps" ? "bg-secondary" : ""}`}
        >
          <MapPinOff className="h-3 w-3 text-muted-foreground" /> No GPS
        </button>
      </PopoverContent>
    </Popover>
  );
}




// ===== Audit Log tab =====
function AuditTab({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const listFn = useServerFn(adminListAuditLog);
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterActor, setFilterActor] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", filterEntity, filterActor],
    queryFn: async () => {
      const res = await listFn({
        data: {
          token,
          entityType: filterEntity === "all" ? undefined : filterEntity,
          actorKind: filterActor === "all" ? undefined : (filterActor as "admin" | "worker" | "system"),
          limit: 300,
        },
      });
      if (res.token !== token) updateToken(res.token);
      return res.entries;
    },
  });

  const actionLabel = (a: string) => {
    const map: Record<string, string> = {
      clock_in: "Clocked in",
      clock_out: "Clocked out",
      entry_create: "Created time entry",
      entry_edit: "Edited time entry",
      entry_delete: "Deleted time entry",
      entry_geo_update: "Updated geo tag",
      reimbursement_create: "Added reimbursement",
      reimbursement_delete: "Deleted reimbursement",
    };
    return map[a] ?? a;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <p className="text-xs text-muted-foreground">
          Append-only history of every change. Records cannot be edited or deleted.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              <SelectItem value="time_entry">Time entries</SelectItem>
              <SelectItem value="reimbursement">Reimbursements</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActor} onValueChange={setFilterActor}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Actor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No audit records yet.</div>
        ) : (
          <div className="space-y-2">
            {data.map((row) => {
              const isOpen = expanded === row.id;
              const hasDetail = row.before || row.after || row.metadata;
              return (
                <div key={row.id} className="border rounded-md text-sm">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : row.id)}
                    className="w-full text-left p-3 hover:bg-secondary/50 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3"
                  >
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(row.created_at)} {fmtTime(row.created_at)}
                    </span>
                    <Badge variant={row.actor_kind === "admin" ? "default" : "secondary"} className="w-fit">
                      {row.actor_label ?? row.actor_kind}
                    </Badge>
                    <span className="font-medium">{actionLabel(row.action)}</span>
                    <span className="text-xs text-muted-foreground sm:ml-auto truncate">
                      {row.entity_type}{row.entity_id ? ` · ${String(row.entity_id).slice(0, 8)}` : ""}
                    </span>
                  </button>
                  {isOpen && hasDetail && (
                    <div className="border-t p-3 bg-muted/30 grid sm:grid-cols-2 gap-3 text-xs">
                      {row.before != null && (
                        <div>
                          <div className="font-semibold text-muted-foreground mb-1">Before</div>
                          <pre className="whitespace-pre-wrap break-all bg-background p-2 rounded border">
{JSON.stringify(row.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {row.after != null && (
                        <div>
                          <div className="font-semibold text-muted-foreground mb-1">After</div>
                          <pre className="whitespace-pre-wrap break-all bg-background p-2 rounded border">
{JSON.stringify(row.after, null, 2)}
                          </pre>
                        </div>
                      )}
                      {row.metadata != null && (
                        <div className="sm:col-span-2">
                          <div className="font-semibold text-muted-foreground mb-1">Metadata</div>
                          <pre className="whitespace-pre-wrap break-all bg-background p-2 rounded border">
{JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Clock, LogOut, Plus, Trash2, Pencil, Download, AlertTriangle, KeyRound, DollarSign,
  Paperclip, Upload, X, FileText,
} from "lucide-react";
import {
  adminLogin, adminVerify, adminChangePassword,
} from "@/lib/auth.functions";
import {
  listWorkersAdmin, createWorker, deleteWorker, setWorkerRate, resetWorkerPin,
} from "@/lib/workers.functions";
import {
  adminListEntries, adminAddEntry, adminEditEntry, adminDeleteEntry, adminFlaggedEntries,
} from "@/lib/entries.functions";
import { getPublicSettings, updateSettings } from "@/lib/settings.functions";
import {
  listReimbursements, addReimbursement, deleteReimbursement, uploadReceipt,
} from "@/lib/reimbursements.functions";
import { weeklyPayout, exportEntriesCsv } from "@/lib/payout.functions";
import { getAdminToken, setAdminToken, clearAdminToken } from "@/lib/session";
import { fmtHours, fmtMoney, fmtTime, fmtDate, startOfWeekISO, diffHours } from "@/lib/format";

const INACTIVITY_MS = 30 * 60 * 1000;

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
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="entries"><EntriesTab token={token} updateToken={updateToken} /></TabsContent>
          <TabsContent value="payouts"><PayoutsTab token={token} updateToken={updateToken} /></TabsContent>
          <TabsContent value="workers"><WorkersTab token={token} updateToken={updateToken} /></TabsContent>
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
  const settingsFn = useServerFn(getPublicSettings);
  const qc = useQueryClient();

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
  const qc = useQueryClient();

  const [week, setWeek] = useState(startOfWeekISO());

  const pq = useQuery({
    queryKey: ["payout", week],
    queryFn: () => payFn({ data: { token, weekStart: week } }).then(r => { updateToken(r.token); return r.summary; }),
  });

  const [reimbFor, setReimbFor] = useState<{ id: string; name: string } | null>(null);
  const [desc, setDesc] = useState(""); const [amt, setAmt] = useState("");
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-secondary">
                <tr className="text-left">
                  <th className="p-3">Worker</th><th className="p-3 text-right">Hours</th>
                  <th className="p-3 text-right">Rate</th><th className="p-3 text-right">Wages</th>
                  <th className="p-3 text-right">Reimb.</th><th className="p-3 text-right">Total</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {pq.data?.map((s: any) => (
                  <tr key={s.workerId} className="border-t border-border">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-right tabular-nums">{s.hours.toFixed(2)}</td>
                    <td className="p-3 text-right tabular-nums">${s.hourlyRate.toFixed(2)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtMoney(s.wages)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtMoney(s.reimbTotal)}</td>
                    <td className="p-3 text-right tabular-nums font-bold">{fmtMoney(s.total)}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline"
                              onClick={() => { setReimbFor({ id: s.workerId, name: s.name }); setDesc(""); setAmt(""); }}>
                        Reimb.
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent></Card>

      <Dialog open={!!reimbFor} onOpenChange={() => setReimbFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reimbursements — {reimbFor?.name} (week of {week})</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} className="flex-1 min-w-[140px]" />
              <Input type="number" step="0.01" placeholder="Amount" value={amt}
                     onChange={(e) => setAmt(e.target.value)} className="w-[110px]" />
              <Button className="w-full sm:w-auto" onClick={async () => {
                try {
                  const r = await reimbAdd({ data: { token, workerId: reimbFor!.id, weekStart: week, description: desc, amount: parseFloat(amt) || 0 } });
                  updateToken(r.token); setDesc(""); setAmt("");
                  qc.invalidateQueries({ queryKey: ["reimb", reimbFor!.id, week] });
                  qc.invalidateQueries({ queryKey: ["payout", week] });
                } catch (e: any) { toast.error(e?.message || "Failed"); }
              }} disabled={!desc.trim() || !amt}>Add</Button>
            </div>
            <div className="border border-border rounded-md divide-y divide-border max-h-72 overflow-auto">
              {rq.data?.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No reimbursements this week.</p>
              ) : rq.data?.map((r: any) => (
                <div key={r.id} className="px-3 py-2 flex items-center justify-between text-sm">
                  <div><p>{r.description}</p></div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{fmtMoney(Number(r.amount))}</span>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      try { const x = await reimbDel({ data: { token, id: r.id } });
                        updateToken(x.token);
                        qc.invalidateQueries({ queryKey: ["reimb", reimbFor!.id, week] });
                        qc.invalidateQueries({ queryKey: ["payout", week] });
                      } catch (e: any) { toast.error(e?.message || "Failed"); }
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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

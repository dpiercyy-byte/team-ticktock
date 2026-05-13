import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wifi, WifiOff, LogOut, Briefcase, Clock } from "lucide-react";
import { listWorkersPublic, workerLogin } from "@/lib/auth.functions";
import { getWorkerState, clockIn, clockOut } from "@/lib/entries.functions";
import {
  getWorkerSession, setWorkerSession, clearWorkerSession, type WorkerSession,
} from "@/lib/session";
import { useOnline } from "@/hooks/use-online";
import { fmtHours, fmtMoney, diffHours } from "@/lib/format";

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
          <Card className="p-2">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : workers && workers.length > 0 ? (
              <ul className="divide-y divide-border">
                {workers.map((w) => (
                  <li key={w.id}>
                    <button
                      onClick={() => setWorkerId(w.id)}
                      className="w-full text-left px-4 py-3.5 hover:bg-secondary rounded-md transition-colors text-base font-medium"
                    >
                      {w.name}
                    </button>
                  </li>
                ))}
              </ul>
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

  const inMut = useMutation({
    mutationFn: () => inFn({ data: { token: session.token, project: project || undefined } }),
    onSuccess: () => { setProject(""); qc.invalidateQueries({ queryKey: ["worker-state", session.id] }); toast.success("Clocked in"); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const outMut = useMutation({
    mutationFn: () => outFn({ data: { token: session.token } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["worker-state", session.id] }); toast.success("Clocked out"); },
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

            <button onClick={() => refetch()} className="text-xs text-muted-foreground">
              Tap to refresh
            </button>
          </>
        )}
      </main>

      <section className="border-t border-border bg-card px-6 py-5 grid grid-cols-2 gap-4">
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

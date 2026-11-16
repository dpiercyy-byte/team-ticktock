import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleAlert, Copy, LogIn, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { adminAddEntry, adminForceClockOut, adminTeamToday } from "@/lib/entries.functions";

export const TIME_PRESETS = ["07:00", "07:30", "15:30", "16:00", "17:00"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:MM" in local time for an ISO timestamp. */
export function localHHMM(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** "YYYY-MM-DD" in local time. */
export function localYMD(iso: string | Date) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Combine a local date and local time into an ISO string. */
export function combineLocal(ymd: string, hhmm: string) {
  return new Date(`${ymd}T${hhmm}`).toISOString();
}
export function presetLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const hr = h % 12 || 12;
  return `${hr}:${pad(m)}${h < 12 ? "a" : "p"}`;
}
function nudge(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

/** Hour / minute / AM-PM picker; value is "HH:MM" (24h) or "" when allowEmpty. */
export function TimeSelect({
  value,
  onChange,
  allowEmpty,
}: {
  value: string;
  onChange: (hhmm: string) => void;
  allowEmpty?: boolean;
}) {
  const empty = !value;
  const [h24, m] = (value || "12:00").split(":").map(Number);
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const set = (hr12: number, min: number, isPm: boolean) =>
    onChange(`${pad((hr12 % 12) + (isPm ? 12 : 0))}:${pad(min)}`);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!minutes.includes(m)) minutes.push(m);
  minutes.sort((a, b) => a - b);
  const cls =
    "h-10 min-w-0 rounded-md border border-input bg-background px-1.5 text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="flex items-center gap-1">
      <select aria-label="Hour" className={cls} value={empty ? "" : h12}
        onChange={(e) => e.target.value === "" ? onChange("") : set(Number(e.target.value), empty ? 0 : m, empty ? true : pm)}>
        {(allowEmpty || empty) && <option value="">--</option>}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <select aria-label="Minute" className={cls} value={empty ? "" : m} disabled={empty}
        onChange={(e) => set(h12, Number(e.target.value), pm)}>
        {empty && <option value="">--</option>}
        {minutes.map((x) => <option key={x} value={x}>{pad(x)}</option>)}
      </select>
      <button type="button" disabled={empty} onClick={() => set(h12, m, !pm)}
        aria-label="Toggle AM/PM"
        className="h-10 rounded-md border border-input bg-foreground px-2 text-sm font-bold text-background disabled:opacity-40">
        {empty ? "--" : pm ? "PM" : "AM"}
      </button>
    </div>
  );
}

/** Tap-the-time popover: change only the time, keep the date. */
export function QuickTimeEdit({
  iso,
  label,
  children,
  onSave,
  validate,
}: {
  iso: string;
  label: string;
  children: React.ReactNode;
  onSave: (newIso: string) => Promise<void> | void;
  /** Return an error message to block the save, or null. */
  validate?: (newIso: string, hhmm: string) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(localHHMM(iso));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [h24, m] = val.split(":").map(Number);
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const setParts = (hr12: number, min: number, isPm: boolean) => {
    const h = (hr12 % 12) + (isPm ? 12 : 0);
    setVal(`${pad(h)}:${pad(min)}`);
    setErr(null);
  };
  const save = async (hhmm: string) => {
    const next = combineLocal(localYMD(iso), hhmm);
    const msg = validate?.(next, hhmm) ?? null;
    if (msg) {
      setErr(msg);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(next);
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message && e.message !== "invalid" ? e.message : "Couldn't save — check the time and try again.");
    } finally {
      setBusy(false);
    }
  };
  const selCls =
    "h-11 rounded-md border border-input bg-background px-2 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring";
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!minutes.includes(m)) minutes.push(m);
  minutes.sort((a, b) => a - b);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setVal(localHHMM(iso));
          setErr(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded px-1 -mx-1 underline decoration-dotted underline-offset-4 hover:bg-secondary"
          aria-label={`Change ${label}`}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          <select aria-label="Hour" className={selCls} value={h12}
            onChange={(e) => setParts(Number(e.target.value), m, pm)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <span className="text-lg font-semibold">:</span>
          <select aria-label="Minute" className={selCls} value={m}
            onChange={(e) => setParts(h12, Number(e.target.value), pm)}>
            {minutes.map((x) => (
              <option key={x} value={x}>{pad(x)}</option>
            ))}
          </select>
          <div className="ml-1 inline-flex overflow-hidden rounded-md border border-input">
            {(["AM", "PM"] as const).map((k) => {
              const active = (k === "PM") === pm;
              return (
                <button key={k} type="button" aria-pressed={active}
                  onClick={() => setParts(h12, m, k === "PM")}
                  className={`h-11 px-3 text-sm font-bold ${active ? "bg-foreground text-background" : "bg-background text-muted-foreground"}`}>
                  {k}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => { setVal(nudge(val, -15)); setErr(null); }}>−15 min</Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => { setVal(nudge(val, 15)); setErr(null); }}>+15 min</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TIME_PRESETS.map((p) => (
            <Button key={p} size="sm" variant="secondary" disabled={busy} onClick={() => save(p)}>
              {presetLabel(p)}
            </Button>
          ))}
        </div>
        {err && (
          <p role="alert" className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-sm font-medium text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {err}
          </p>
        )}
        <Button className="w-full" disabled={busy || !val} onClick={() => save(val)}>
          {busy ? "Saving…" : `Save ${presetLabel(val)}`}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

type TeamEntry = {
  id: string;
  worker_id: string;
  clock_in: string;
  clock_out: string | null;
  auto_clocked_out: boolean;
  [k: string]: any;
};

/** Whole-team view for today with one-tap fixes. */
export function TeamTodayPanel({
  token,
  updateToken,
  onFix,
  onAddShift,
}: {
  token: string;
  updateToken: (t: string) => void;
  onFix: (workerId: string, entry: TeamEntry) => void;
  onAddShift: (workerId: string) => void;
}) {
  const qc = useQueryClient();
  const teamFn = useServerFn(adminTeamToday);
  const addE = useServerFn(adminAddEntry);
  const forceOut = useServerFn(adminForceClockOut);
  const [busy, setBusy] = useState<string | null>(null);
  const dayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const q = useQuery({
    queryKey: ["team-today", dayStart],
    queryFn: () =>
      teamFn({ data: { token, dayStart } }).then((r) => {
        updateToken(r.token);
        return r.workers;
      }),
    refetchInterval: 60_000,
  });

  const refresh = (workerId: string) => {
    qc.invalidateQueries({ queryKey: ["team-today"] });
    qc.invalidateQueries({ queryKey: ["entries", workerId] });
    qc.invalidateQueries({ queryKey: ["flagged"] });
  };
  const run = async (key: string, workerId: string, fn: () => Promise<{ token: string }>, msg: string) => {
    setBusy(key);
    try {
      const r = await fn();
      updateToken(r.token);
      refresh(workerId);
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const today = localYMD(new Date());

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Team today</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="divide-y divide-border">
            {(q.data ?? []).map((w: any) => {
              const entries: TeamEntry[] = w.entries;
              const open = entries.find((e) => !e.clock_out);
              const auto = entries.find((e) => e.auto_clocked_out);
              const todays = entries.filter((e) => localYMD(e.clock_in) === today);
              const last = w.lastShift;
              const status = open
                ? { text: `In since ${presetLabel(localHHMM(open.clock_in))}`, cls: "text-success" }
                : todays.length
                  ? {
                      text: todays
                        .map((e) => `${presetLabel(localHHMM(e.clock_in))}–${e.clock_out ? presetLabel(localHHMM(e.clock_out)) : ""}`)
                        .join(", "),
                      cls: "text-muted-foreground",
                    }
                  : { text: "No shift today", cls: "text-warning" };
              return (
                <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{w.name}</p>
                    <p className={`text-xs tabular-nums ${status.cls}`}>{status.text}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {auto && (
                      <Button size="sm" variant="destructive" onClick={() => onFix(w.id, auto)}>
                        <CircleAlert className="mr-1 h-4 w-4" /> Fix time
                      </Button>
                    )}
                    {open ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === w.id}
                        onClick={() =>
                          run(w.id, w.id, () => forceOut({ data: { token, entryId: open.id } }), `${w.name} clocked out`)
                        }
                      >
                        <LogOut className="mr-1 h-4 w-4" /> Clock out now
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === w.id}
                        onClick={() =>
                          run(
                            w.id,
                            w.id,
                            () =>
                              addE({
                                data: {
                                  token,
                                  workerId: w.id,
                                  clockIn: new Date().toISOString(),
                                  assignedJobSiteIds: last?.assigned_job_site_ids ?? [],
                                },
                              }),
                            `${w.name} clocked in`,
                          )
                        }
                      >
                        <LogIn className="mr-1 h-4 w-4" /> Clock in now
                      </Button>
                    )}
                    {!open && todays.length === 0 && last && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy === w.id + "c"}
                        title={`${presetLabel(localHHMM(last.clock_in))}–${presetLabel(localHHMM(last.clock_out))}`}
                        onClick={() =>
                          run(
                            w.id + "c",
                            w.id,
                            () =>
                              addE({
                                data: {
                                  token,
                                  workerId: w.id,
                                  clockIn: combineLocal(today, localHHMM(last.clock_in)),
                                  clockOut: combineLocal(today, localHHMM(last.clock_out)),
                                  project: last.project ?? undefined,
                                  assignedJobSiteIds: last.assigned_job_site_ids ?? [],
                                },
                              }),
                            `Copied last shift for ${w.name}`,
                          )
                        }
                      >
                        <Copy className="mr-1 h-4 w-4" /> Same as last shift
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onAddShift(w.id)}>
                      <Plus className="mr-1 h-4 w-4" /> Add shift
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

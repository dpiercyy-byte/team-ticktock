import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminWeekSchedule, deleteAssignment, upsertAssignment } from "@/lib/schedule.functions";
import { addDaysISO, startOfWeekISO } from "@/lib/payout-math";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ARRIVAL_PRESETS = ["07:00", "07:30", "08:00"];

export function fmtArrival(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}
const shortDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

type Draft = { workerIds: string[]; dates: string[]; jobSiteId: string; arrival: string; note: string; existingId?: string };

export function SchedulePanel({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const qc = useQueryClient();
  const weekFn = useServerFn(adminWeekSchedule);
  const upsertFn = useServerFn(upsertAssignment);
  const delFn = useServerFn(deleteAssignment);
  const [weekStart, setWeekStart] = useState(() => startOfWeekISO(new Date()));
  const [weekends, setWeekends] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lastSite, setLastSite] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["schedule", weekStart],
    queryFn: () =>
      weekFn({ data: { token, weekStart } }).then((r) => {
        updateToken(r.token);
        return r;
      }),
  });
  const days = useMemo(
    () => (weekends ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]).map((i) => addDaysISO(weekStart, i)),
    [weekStart, weekends],
  );
  const byCell = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of q.data?.assignments ?? []) m.set(`${a.worker_id}|${a.work_date}`, a);
    return m;
  }, [q.data]);
  const sites: any[] = q.data?.sites ?? [];
  const workers: any[] = q.data?.workers ?? [];
  const today = new Date().toLocaleDateString("en-CA");

  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule"] });

  const openCell = (workerId: string, date: string) => {
    const a = byCell.get(`${workerId}|${date}`);
    setDraft(
      a
        ? { workerIds: [workerId], dates: [date], jobSiteId: a.job_site_id, arrival: a.arrival_time?.slice(0, 5) ?? "", note: a.note ?? "", existingId: a.id }
        : { workerIds: [workerId], dates: [date], jobSiteId: lastSite, arrival: "07:00", note: "" },
    );
  };

  const save = async () => {
    if (!draft?.jobSiteId) return toast.error("Pick a job");
    setBusy(true);
    try {
      const r = await upsertFn({
        data: { token, workerIds: draft.workerIds, dates: draft.dates, jobSiteId: draft.jobSiteId, arrivalTime: draft.arrival || null, note: draft.note || null },
      });
      updateToken(r.token);
      setLastSite(draft.jobSiteId);
      refresh();
      setDraft(null);
      toast.success("Scheduled");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft?.existingId) return;
    setBusy(true);
    try {
      const r = await delFn({ data: { token, id: draft.existingId } });
      updateToken(r.token);
      refresh();
      setDraft(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const sortedSites = [...sites].sort((a, b) => (a.id === lastSite ? -1 : b.id === lastSite ? 1 : 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center text-sm font-semibold">
          {shortDate(addDaysISO(weekStart, weekends ? 0 : 1))} – {shortDate(addDaysISO(weekStart, weekends ? 6 : 5))}
        </div>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setDraft({ workerIds: [], dates: [], jobSiteId: lastSite, arrival: "07:00", note: "" })}>
          <Users className="mr-1 h-4 w-4" /> Assign crew
        </Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Weekends <Switch checked={weekends} onCheckedChange={setWeekends} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-secondary">
              <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-semibold">Worker</th>
              {days.map((d) => (
                <th key={d} className={`px-2 py-2 text-center font-semibold ${d === today ? "text-primary" : ""}`}>
                  <div>{DAY_NAMES[new Date(d + "T12:00:00").getDay()]}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">{shortDate(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr><td colSpan={days.length + 1} className="p-4 text-muted-foreground">Loading…</td></tr>
            ) : (
              workers.map((w) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold whitespace-nowrap">{w.name}</td>
                  {days.map((d) => {
                    const a = byCell.get(`${w.id}|${d}`);
                    return (
                      <td key={d} className="p-1">
                        <button
                          type="button"
                          onClick={() => openCell(w.id, d)}
                          className={`h-14 w-full min-w-[84px] rounded-lg px-1.5 text-left text-xs transition-colors ${
                            a ? "bg-primary/10 hover:bg-primary/20" : "border border-dashed border-border text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {a ? (
                            <>
                              <div className="truncate font-semibold text-foreground">{a.job_sites?.label}</div>
                              <div className="tabular-nums text-muted-foreground">{fmtArrival(a.arrival_time)}</div>
                            </>
                          ) : (
                            <span className="block text-center">+</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft?.workerIds.length === 1 && draft.dates.length === 1
                ? `${workers.find((w) => w.id === draft.workerIds[0])?.name} · ${shortDate(draft.dates[0])}`
                : "Assign crew"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div>
                <Label>Job</Label>
                <div className="mt-1 max-h-56 space-y-1 overflow-y-auto">
                  {sortedSites.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, jobSiteId: s.id })}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        draft.jobSiteId === s.id ? "border-primary bg-primary/10 font-semibold" : "border-border"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                  {sites.length === 0 && <p className="text-sm text-muted-foreground">No active job sites.</p>}
                </div>
              </div>
              <div>
                <Label>Arrival time</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input type="time" value={draft.arrival} onChange={(e) => setDraft({ ...draft, arrival: e.target.value })} className="w-32" />
                  {ARRIVAL_PRESETS.map((t) => (
                    <Button key={t} size="sm" variant={draft.arrival === t ? "default" : "secondary"} onClick={() => setDraft({ ...draft, arrival: t })}>
                      {fmtArrival(t)}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={draft.note} maxLength={200} placeholder="e.g. bring tile saw" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              </div>
              {!draft.existingId && (
                <>
                  <div>
                    <Label>Workers</Label>
                    <div className="mt-1 grid grid-cols-2 gap-1.5">
                      {workers.map((w) => (
                        <label key={w.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={draft.workerIds.includes(w.id)}
                            onCheckedChange={(c) =>
                              setDraft({ ...draft, workerIds: c ? [...draft.workerIds, w.id] : draft.workerIds.filter((x) => x !== w.id) })
                            }
                          />
                          {w.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Days</Label>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {days.map((d) => {
                        const on = draft.dates.includes(d);
                        return (
                          <Button key={d} size="sm" variant={on ? "default" : "outline"}
                            onClick={() => setDraft({ ...draft, dates: on ? draft.dates.filter((x) => x !== d) : [...draft.dates, d] })}>
                            {DAY_NAMES[new Date(d + "T12:00:00").getDay()]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {draft?.existingId && (
              <Button variant="outline" className="text-destructive" disabled={busy} onClick={remove}>
                Remove
              </Button>
            )}
            <Button disabled={busy || !draft?.jobSiteId || !draft?.workerIds.length || !draft?.dates.length} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminWeekSchedule, archiveSub, deleteAssignment, deleteSubAssignment, upsertAssignment, upsertSub } from "@/lib/schedule.functions";
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

type Draft = { workerIds: string[]; subIds: string[]; existingIsSub?: boolean; dates: string[]; jobSiteId: string; arrival: string; note: string; existingId?: string };

export function SchedulePanel({ token, updateToken }: { token: string; updateToken: (t: string) => void }) {
  const qc = useQueryClient();
  const weekFn = useServerFn(adminWeekSchedule);
  const upsertFn = useServerFn(upsertAssignment);
  const delFn = useServerFn(deleteAssignment);
  const delSubFn = useServerFn(deleteSubAssignment);
  const upsertSubFn = useServerFn(upsertSub);
  const archiveSubFn = useServerFn(archiveSub);
  const [extraTrades, setExtraTrades] = useState<string[]>([]);
  const [newTrade, setNewTrade] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState<{ id?: string; name: string; trade: string; phone: string } | null>(null);
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
    for (const a of q.data?.assignments ?? []) m.set(`w:${a.worker_id}|${a.work_date}`, a);
    for (const a of (q.data as any)?.subAssignments ?? []) m.set(`s:${a.sub_id}|${a.work_date}`, a);
    return m;
  }, [q.data]);
  const sites: any[] = q.data?.sites ?? [];
  const workers: any[] = q.data?.workers ?? [];
  const subs: any[] = (q.data as any)?.subs ?? [];
  const titleCase = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());
  const tradeOptions = (() => {
    const seen = new Map<string, string>();
    for (const t of ["Electrician", "Plumber", "HVAC", "Drywall", "Painter", ...subs.map((s) => s.trade ?? ""), ...extraTrades]) {
      const v = t.trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v === "HVAC" ? v : titleCase(v));
    }
    return [...seen.values()];
  })();
  const addTrade = () => {
    const v = titleCase(newTrade ?? "");
    if (!v || !subDraft) return setNewTrade(null);
    const existing = tradeOptions.find((t) => t.toLowerCase() === v.toLowerCase());
    if (!existing) setExtraTrades((x) => [...x, v]);
    setSubDraft({ ...subDraft, trade: existing ?? v });
    setNewTrade(null);
  };
  const rows = [
    ...workers.map((w) => ({ kind: "w" as const, id: w.id, name: w.name, sub: "" })),
    ...subs.map((s) => ({ kind: "s" as const, id: s.id, name: s.name, sub: s.trade ?? "", raw: s })),
  ];
  const today = new Date().toLocaleDateString("en-CA");

  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule"] });

  const openCell = (kind: "w" | "s", id: string, date: string) => {
    const a = byCell.get(`${kind}:${id}|${date}`);
    const who = kind === "w" ? { workerIds: [id], subIds: [] } : { workerIds: [], subIds: [id] };
    setDraft(
      a
        ? { ...who, existingIsSub: kind === "s", dates: [date], jobSiteId: a.job_site_id, arrival: a.arrival_time?.slice(0, 5) ?? "", note: a.note ?? "", existingId: a.id }
        : { ...who, dates: [date], jobSiteId: lastSite, arrival: "07:00", note: "" },
    );
  };

  const saveSub = async () => {
    if (!subDraft?.name.trim()) return toast.error("Add a name");
    setBusy(true);
    try {
      const r = await upsertSubFn({ data: { token, id: subDraft.id, name: subDraft.name, trade: subDraft.trade || null, phone: subDraft.phone || null } });
      updateToken(r.token);
      refresh();
      setSubDraft(null);
      toast.success("Sub trade saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };
  const removeSub = async () => {
    if (!subDraft?.id) return;
    setBusy(true);
    try {
      const r = await archiveSubFn({ data: { token, id: subDraft.id } });
      updateToken(r.token);
      refresh();
      setSubDraft(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft?.jobSiteId) return toast.error("Pick a job");
    setBusy(true);
    try {
      const r = await upsertFn({
        data: { token, workerIds: draft.workerIds, subIds: draft.subIds, dates: draft.dates, jobSiteId: draft.jobSiteId, arrivalTime: draft.arrival || null, note: draft.note || null },
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
      const r = await (draft.existingIsSub ? delSubFn : delFn)({ data: { token, id: draft.existingId } });
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
      <div className="c-subnav flex items-center gap-2 p-1.5">
        <Button variant="outline" size="icon" className="c-subtab rounded-xl" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center text-sm font-semibold">
          {shortDate(addDaysISO(weekStart, weekends ? 0 : 1))} – {shortDate(addDaysISO(weekStart, weekends ? 6 : 5))}
        </div>
        <Button variant="outline" size="icon" className="c-subtab rounded-xl" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" className="cw-day-head rounded-2xl border border-border/80 text-foreground hover:opacity-90" onClick={() => setDraft({ workerIds: [], subIds: [], dates: [], jobSiteId: lastSite, arrival: "07:00", note: "" })}>
          <Users className="mr-1 h-4 w-4" /> Assign crew
        </Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Weekends <Switch checked={weekends} onCheckedChange={setWeekends} />
        </label>
      </div>

      <div className="cw-day-card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="cw-day-head">
              <th className="sticky left-0 z-10 cw-day-head px-3 py-2 text-left font-semibold">Worker</th>
              {days.map((d) => (
                <th key={d} className={`px-2 py-2 text-center font-semibold ${d === today ? "bg-primary/15 text-primary" : ""}`}>
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
              rows.map((w, i) => (
                <tr key={w.kind + w.id} className={`border-t ${w.kind === "s" && rows[i - 1]?.kind === "w" ? "border-t-2 border-primary/40" : "border-border"}`}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 whitespace-nowrap">
                    {w.kind === "w" ? (
                      <span className="font-semibold">{w.name}</span>
                    ) : (
                      <button type="button" className="text-left" onClick={() => setSubDraft({ id: w.id, name: w.name, trade: w.raw.trade ?? "", phone: w.raw.phone ?? "" })}>
                        <div className="font-semibold">{w.name}</div>
                        <div className="text-[10px] uppercase tracking-wide text-primary">{w.sub || "Sub trade"}</div>
                      </button>
                    )}
                  </td>
                  {days.map((d) => {
                    const a = byCell.get(`${w.kind}:${w.id}|${d}`);
                    return (
                      <td key={d} className="p-1">
                        <button
                          type="button"
                          onClick={() => openCell(w.kind, w.id, d)}
                          className={`h-14 w-full min-w-[84px] rounded-xl px-1.5 text-left text-xs transition-colors ${
                            a ? "border-l-[3px] border-primary bg-primary/10 hover:bg-primary/20" : "border border-dashed border-border text-muted-foreground hover:bg-primary/5"
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
      <div className="flex justify-center">
        <Button variant="ghost" className="cw-day-head rounded-2xl border border-border/80 text-foreground hover:opacity-90 w-1/2" onClick={() => setSubDraft({ name: "", trade: "", phone: "" })}>
          <Plus className="mr-1 h-4 w-4" /> Add sub trade
        </Button>
      </div>

      <Dialog open={!!subDraft} onOpenChange={(o) => !o && setSubDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subDraft?.id ? "Edit sub trade" : "Add sub trade"}</DialogTitle>
          </DialogHeader>
          {subDraft && (
            <div className="space-y-3">
              <div>
                <Label>Company / name</Label>
                <Input value={subDraft.name} maxLength={80} placeholder="e.g. Ace Electric" onChange={(e) => setSubDraft({ ...subDraft, name: e.target.value })} />
              </div>
              <div>
                <Label>Trade</Label>
                <Input value={subDraft.trade} maxLength={60} placeholder="e.g. Electrician" onChange={(e) => setSubDraft({ ...subDraft, trade: e.target.value })} />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {tradeOptions.map((t) => (
                    <Button key={t} size="sm" variant="outline" className={subDraft.trade.toLowerCase() === t.toLowerCase() ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : ""} onClick={() => setSubDraft({ ...subDraft, trade: t })}>{t}</Button>
                  ))}
                  {newTrade === null ? (
                    <Button size="sm" variant="outline" aria-label="Add trade category" onClick={() => setNewTrade("")}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="flex w-full items-center gap-1.5">
                      <Input autoFocus value={newTrade} maxLength={60} placeholder="e.g. Roofer" className="h-9"
                        onChange={(e) => setNewTrade(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTrade(); } if (e.key === "Escape") setNewTrade(null); }} />
                      <Button size="sm" onClick={addTrade}>Add</Button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label>Phone (optional)</Label>
                <Input type="tel" value={subDraft.phone} maxLength={30} onChange={(e) => setSubDraft({ ...subDraft, phone: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {subDraft?.id && (
              <Button variant="outline" className="text-destructive" disabled={busy} onClick={removeSub}>Remove</Button>
            )}
            <Button disabled={busy || !subDraft?.name.trim()} onClick={saveSub}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft && draft.workerIds.length + draft.subIds.length === 1 && draft.dates.length === 1
                ? `${(workers.find((w) => w.id === draft.workerIds[0]) ?? subs.find((s) => s.id === draft.subIds[0]))?.name} · ${shortDate(draft.dates[0])}`
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
                    <Button key={t} size="sm" variant="outline" className={draft.arrival === t ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : ""} onClick={() => setDraft({ ...draft, arrival: t })}>
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
                  {subs.length > 0 && (
                    <div>
                      <Label>Sub trades</Label>
                      <div className="mt-1 grid grid-cols-2 gap-1.5">
                        {subs.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={draft.subIds.includes(s.id)}
                              onCheckedChange={(c) =>
                                setDraft({ ...draft, subIds: c ? [...draft.subIds, s.id] : draft.subIds.filter((x) => x !== s.id) })
                              }
                            />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Days</Label>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {days.map((d) => {
                        const on = draft.dates.includes(d);
                        return (
                          <Button key={d} size="sm" variant="outline" className={on ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : ""}
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
            <Button disabled={busy || !draft?.jobSiteId || !(draft && draft.workerIds.length + draft.subIds.length) || !draft?.dates.length} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

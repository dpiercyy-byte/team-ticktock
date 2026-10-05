import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminWeekSchedule, upsertAssignment } from "@/lib/schedule.functions";
import { addDaysISO, startOfWeekISO } from "@/lib/payout-math";
import { getAdminToken, setAdminToken } from "@/lib/session";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRESETS = ["07:00", "07:30", "08:00"];
const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
};
const norm = (s: string) => s.toLowerCase().split(",")[0].replace(/[^a-z0-9]/g, "");

/** Schedule workers onto this job straight from its card. */
export function AssignCrewButton({ jobId, address }: { jobId: string; address?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className="h-8 rounded-full text-xs"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Assign crew
      </Button>
      {open && <AssignDialog jobId={jobId} address={address} onClose={() => setOpen(false)} />}
    </>
  );
}

function AssignDialog({ jobId, address, onClose }: { jobId: string; address?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const weekFn = useServerFn(adminWeekSchedule);
  const upsertFn = useServerFn(upsertAssignment);
  const [weekStart, setWeekStart] = useState(() => startOfWeekISO(new Date()));
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [arrival, setArrival] = useState("07:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["schedule", weekStart],
    queryFn: async () => {
      const r = await weekFn({ data: { token: getAdminToken() ?? "", weekStart } });
      setAdminToken(r.token);
      return r;
    },
  });
  const site = useMemo(() => {
    const sites: any[] = q.data?.sites ?? [];
    return (
      sites.find((s) => s.project_id === jobId) ??
      (address ? sites.find((s) => norm(s.address ?? "") === norm(address) || norm(s.label) === norm(address)) : undefined)
    );
  }, [q.data, jobId, address]);
  const busyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of q.data?.assignments ?? []) m.set(`${a.worker_id}|${a.work_date}`, a.job_sites?.label ?? "");
    return m;
  }, [q.data]);
  const days = [1, 2, 3, 4, 5, 6].map((i) => addDaysISO(weekStart, i));
  const thisWeek = startOfWeekISO(new Date());

  const save = async () => {
    if (!site) return;
    setBusy(true);
    try {
      const r = await upsertFn({
        data: { token: getAdminToken() ?? "", workerIds, dates, jobSiteId: site.id, arrivalTime: arrival || null, note: note || null },
      });
      setAdminToken(r.token);
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Crew scheduled");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Assign crew{site ? ` · ${site.label}` : ""}</DialogTitle>
        </DialogHeader>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !site ? (
          <p className="text-sm text-muted-foreground">
            This job doesn't have an active job site yet. Add one under Job Sites, then try again.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={weekStart === thisWeek ? "default" : "outline"} onClick={() => { setWeekStart(thisWeek); setDates([]); }}>This week</Button>
              <Button size="sm" variant={weekStart !== thisWeek ? "default" : "outline"} onClick={() => { setWeekStart(addDaysISO(thisWeek, 7)); setDates([]); }}>Next week</Button>
            </div>
            <div>
              <Label>Days</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {days.map((d) => {
                  const on = dates.includes(d);
                  return (
                    <Button key={d} size="sm" variant={on ? "default" : "outline"}
                      onClick={() => setDates(on ? dates.filter((x) => x !== d) : [...dates, d])}>
                      {DAY[new Date(d + "T12:00:00").getDay()]} {Number(d.slice(8))}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Workers</Label>
              <div className="mt-1 space-y-1.5">
                {(q.data?.workers ?? []).map((w: any) => {
                  const clashes = dates.map((d) => busyMap.get(`${w.id}|${d}`)).filter(Boolean);
                  return (
                    <label key={w.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={workerIds.includes(w.id)}
                        onCheckedChange={(c) => setWorkerIds(c ? [...workerIds, w.id] : workerIds.filter((x) => x !== w.id))} />
                      <span className="font-medium">{w.name}</span>
                      {clashes.length > 0 && (
                        <span className="text-xs text-warning">already at {clashes[0]}{clashes.length > 1 ? ` +${clashes.length - 1}` : ""}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Arrival time</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input type="time" value={arrival} onChange={(e) => setArrival(e.target.value)} className="w-32" />
                {PRESETS.map((t) => (
                  <Button key={t} size="sm" variant={arrival === t ? "default" : "secondary"} onClick={() => setArrival(t)}>{fmt(t)}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. bring tile saw" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button disabled={busy || !site || !workerIds.length || !dates.length} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

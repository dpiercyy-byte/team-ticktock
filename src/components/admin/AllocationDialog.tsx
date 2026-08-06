import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { adminSetEntryAllocation } from "@/lib/entries.functions";

type SiteOpt = { id: string; label: string };
type Row = { jobSiteId: string; hours: string };

const OFF_SITE = "__off_site__";

function totalHours(clockIn: string, clockOut: string) {
  return Math.max(0, (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600_000);
}

export function AllocationDialog({
  entry, sites, token, onToken, onClose, onSaved,
}: {
  entry: any | null;
  sites: SiteOpt[];
  token: string;
  onToken: (t: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const setAlloc = useServerFn(adminSetEntryAllocation);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const shiftHours = entry?.clock_out ? totalHours(entry.clock_in, entry.clock_out) : 0;

  useEffect(() => {
    if (!entry) return;
    const segs = (entry.segments ?? []) as Array<{ jobSiteId: string | null; hours: number }>;
    if (segs.length > 0) {
      setRows(segs.map((s) => ({ jobSiteId: s.jobSiteId ?? OFF_SITE, hours: String(Math.round(s.hours * 100) / 100) })));
    } else {
      setRows([{ jobSiteId: entry.job_site_id ?? OFF_SITE, hours: String(Math.round(shiftHours * 100) / 100) }]);
    }
  }, [entry?.id]);

  const allocated = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0),
    [rows],
  );
  const remainder = Math.round((shiftHours - allocated) * 100) / 100;
  const balanced = Math.abs(remainder) <= 0.02;

  const save = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const r: any = await setAlloc({
        data: {
          token,
          entryId: entry.id,
          allocations: rows
            .filter((x) => (Number(x.hours) || 0) > 0)
            .map((x) => ({
              jobSiteId: x.jobSiteId === OFF_SITE ? null : x.jobSiteId,
              hours: Number(x.hours),
            })),
        },
      });
      if (r?.token) onToken(r.token);
      toast.success("Hours allocated");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save allocation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split hours across job sites</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Shift total {shiftHours.toFixed(2)} h. Allocate it to the sites actually worked —
          project labour costs use these splits.
        </p>
        <div className="space-y-2 max-h-[45vh] overflow-y-auto">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={r.jobSiteId}
                      onValueChange={(v) => setRows((p) => p.map((x, j) => (j === i ? { ...x, jobSiteId: v } : x)))}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Job site" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={OFF_SITE}>Off site / unallocated</SelectItem>
                  {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" step="0.25" min="0" inputMode="decimal" className="w-24 tabular-nums"
                     value={r.hours}
                     onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))} />
              <Button variant="ghost" size="icon" disabled={rows.length === 1}
                      onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" disabled={rows.length >= 6}
                  onClick={() => setRows((p) => [...p, { jobSiteId: OFF_SITE, hours: String(Math.max(0, remainder)) }])}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add site
          </Button>
        </div>
        <p className={`text-xs tabular-nums ${balanced ? "text-muted-foreground" : "text-warning"}`}>
          Allocated {allocated.toFixed(2)} h · {balanced ? "balanced" : `${remainder > 0 ? "unallocated" : "over"} ${Math.abs(remainder).toFixed(2)} h`}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !balanced || allocated <= 0}>
            {saving ? "Saving…" : "Save allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

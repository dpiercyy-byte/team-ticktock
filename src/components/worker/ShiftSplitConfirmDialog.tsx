import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { workerConfirmShiftSplit } from "@/lib/entries.functions";
import { fmtHours } from "@/lib/format";

export type ShiftSegment = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  jobSiteId: string | null;
  label: string;
};

export type ShiftSplitPrompt = { entryId: string; segments: ShiftSegment[] };

type Row = { jobSiteId: string | null; label: string; hours: number };

function rollup(segments: ShiftSegment[]): Row[] {
  const map = new Map<string, Row>();
  for (const s of segments) {
    const end = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
    const hrs = Math.max(0, (end - new Date(s.startedAt).getTime()) / 3600_000);
    const key = s.jobSiteId ?? "";
    const prev = map.get(key);
    if (prev) prev.hours += hrs;
    else map.set(key, { jobSiteId: s.jobSiteId, label: s.label, hours: hrs });
  }
  return Array.from(map.values());
}

export function ShiftSplitConfirmDialog({
  token,
  prompt,
  onClose,
}: {
  token: string;
  prompt: ShiftSplitPrompt | null;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  const rows = useMemo(() => (prompt ? rollup(prompt.segments) : []), [prompt]);
  const total = useMemo(() => rows.reduce((s, r) => s + r.hours, 0), [rows]);
  const draftSum = draft.reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const balanced = Math.abs(draftSum - total) <= 0.02;

  const confirmFn = useServerFn(workerConfirmShiftSplit);
  const mut = useMutation({
    mutationFn: async (allocations?: Array<{ jobSiteId: string | null; hours: number }>) =>
      confirmFn({ data: { token, entryId: prompt!.entryId, ...(allocations ? { allocations } : {}) } }),
    onSuccess: () => {
      toast.success("Thanks — hours confirmed");
      close();
    },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });

  function close() {
    setEditing(false);
    setDraft([]);
    onClose();
  }

  return (
    <Dialog open={!!prompt} onOpenChange={(o) => { if (!o && !mut.isPending) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Today's hours</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You worked at more than one site. Does this look right?
        </p>

        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={(r.jobSiteId ?? "none") + i}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <span className="truncate text-sm">{r.label}</span>
              {editing ? (
                <Input
                  inputMode="decimal"
                  className="h-9 w-20 text-right tabular-nums"
                  value={draft[i] ?? ""}
                  onChange={(e) => setDraft((d) => d.map((v, j) => (j === i ? e.target.value : v)))}
                />
              ) : (
                <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtHours(r.hours)}</span>
              )}
            </li>
          ))}
        </ul>

        {editing && (
          <p className={"text-xs " + (balanced ? "text-muted-foreground" : "text-destructive")}>
            Must total {total.toFixed(2)}h — currently {draftSum.toFixed(2)}h
          </p>
        )}

        <DialogFooter className="gap-2">
          {editing ? (
            <>
              <Button variant="ghost" disabled={mut.isPending} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                disabled={mut.isPending || !balanced}
                onClick={() =>
                  mut.mutate(rows.map((r, i) => ({ jobSiteId: r.jobSiteId, hours: parseFloat(draft[i] ?? "0") || 0 })))
                }
              >
                Save hours
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                disabled={mut.isPending}
                onClick={() => {
                  setDraft(rows.map((r) => r.hours.toFixed(2)));
                  setEditing(true);
                }}
              >
                Adjust
              </Button>
              <Button disabled={mut.isPending} onClick={() => mut.mutate(undefined)}>
                Looks right
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

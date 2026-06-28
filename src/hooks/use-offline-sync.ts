import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { clockIn, clockOut } from "@/lib/entries.functions";
import {
  acquireSyncLock,
  getQueue,
  releaseSyncLock,
  removeQueued,
  subscribeQueue,
  updateQueued,
  type QueuedClockAction,
} from "@/lib/offline-queue";
import { useOnline } from "@/hooks/use-online";

const BACKOFF_MS = [5_000, 30_000, 120_000, 300_000];
const MAX_ATTEMPTS = 5;

export type SyncStatus = "idle" | "offline" | "syncing" | "failed";

export type ClockServerResponse =
  | { kind: "in"; res: Awaited<ReturnType<typeof clockIn>>; queued: QueuedClockAction }
  | { kind: "out"; res: Awaited<ReturnType<typeof clockOut>>; queued: QueuedClockAction };

export function useOfflineSync(opts: {
  workerId: string;
  onSynced?: (r: ClockServerResponse) => void;
}) {
  const online = useOnline();
  const qc = useQueryClient();
  const inFn = useServerFn(clockIn);
  const outFn = useServerFn(clockOut);

  const [queue, setQueue] = useState<QueuedClockAction[]>(() => getQueue());
  const [syncing, setSyncing] = useState(false);
  const onSyncedRef = useRef(opts.onSynced);
  onSyncedRef.current = opts.onSynced;

  useEffect(() => subscribeQueue(setQueue), []);

  const flush = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!acquireSyncLock()) return;
    setSyncing(true);
    try {
      // Always read fresh queue per iteration to pick up changes.
      let q = getQueue().filter((x) => x.workerId === opts.workerId && !x.failed);
      while (q.length > 0) {
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
        const item = q[0];
        // Honour backoff
        const wait = BACKOFF_MS[Math.min(item.attempts, BACKOFF_MS.length - 1)];
        const since = Date.now() - new Date(item.createdAt).getTime();
        if (item.attempts > 0 && since < wait) break;
        try {
          if (item.kind === "in") {
            const res = await inFn({
              data: {
                token: item.token,
                project: item.payload.project || undefined,
                lat: item.payload.lat,
                lng: item.payload.lng,
                clientTimestamp: item.payload.clientTimestamp,
              } as any,
            });
            removeQueued(item.id);
            onSyncedRef.current?.({ kind: "in", res, queued: item });
          } else {
            const res = await outFn({
              data: {
                token: item.token,
                lat: item.payload.lat,
                lng: item.payload.lng,
                clientTimestamp: item.payload.clientTimestamp,
              } as any,
            });
            removeQueued(item.id);
            onSyncedRef.current?.({ kind: "out", res, queued: item });
          }
          qc.invalidateQueries({ queryKey: ["worker-state", opts.workerId] });
        } catch (e: any) {
          const attempts = item.attempts + 1;
          const failed = attempts >= MAX_ATTEMPTS;
          updateQueued(item.id, {
            attempts,
            lastError: e?.message || "Sync failed",
            failed,
          });
          // Stop the loop on failure — wait for backoff or manual retry.
          break;
        }
        q = getQueue().filter((x) => x.workerId === opts.workerId && !x.failed);
      }
    } finally {
      releaseSyncLock();
      setSyncing(false);
    }
  }, [inFn, outFn, qc, opts.workerId]);

  // Trigger flush when we come online or queue grows.
  useEffect(() => {
    if (online && queue.some((q) => q.workerId === opts.workerId && !q.failed)) {
      void flush();
    }
  }, [online, queue, flush, opts.workerId]);

  // Periodic retry while items are pending (handles backoff windows).
  useEffect(() => {
    if (!online) return;
    const hasPending = queue.some((q) => q.workerId === opts.workerId && !q.failed);
    if (!hasPending) return;
    const t = setInterval(() => { void flush(); }, 10_000);
    return () => clearInterval(t);
  }, [online, queue, flush, opts.workerId]);

  const pending = queue.filter((q) => q.workerId === opts.workerId && !q.failed);
  const failed = queue.filter((q) => q.workerId === opts.workerId && q.failed);

  let status: SyncStatus = "idle";
  if (!online) status = "offline";
  else if (syncing) status = "syncing";
  else if (failed.length > 0) status = "failed";

  const retry = useCallback(() => {
    // Reset failed flag + attempts on the failed items, then flush.
    for (const f of failed) {
      updateQueued(f.id, { failed: false, attempts: 0, lastError: null });
    }
    void flush();
  }, [failed, flush]);

  return { pending, failed, status, online, flush, retry };
}

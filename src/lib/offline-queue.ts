// Local-only persistent queue for offline clock-in/out actions.
// Stored in localStorage so it survives reloads while offline.

export type QueuedClockKind = "in" | "out";

export type QueuedClockAction = {
  id: string;
  kind: QueuedClockKind;
  token: string;
  workerId: string;
  payload: {
    project?: string;
    lat: number | null;
    lng: number | null;
    clientTimestamp: string; // ISO captured at tap time
  };
  attempts: number;
  lastError?: string | null;
  failed?: boolean; // exceeded retry budget; needs manual retry
  createdAt: string;
};

const KEY = "clockwise.offlineQueue.v1";
const LOCK_KEY = "clockwise.syncLock.v1";
const LOCK_TTL_MS = 30_000;

type Listener = (q: QueuedClockAction[]) => void;
const listeners = new Set<Listener>();

function read(): QueuedClockAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(q: QueuedClockAction[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(q));
  emit(q);
}

function emit(q: QueuedClockAction[]) {
  for (const l of Array.from(listeners)) {
    try { l(q); } catch { /* noop */ }
  }
}

export function getQueue(): QueuedClockAction[] {
  return read();
}

export function subscribeQueue(l: Listener): () => void {
  listeners.add(l);
  // cross-tab sync
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) emit(read());
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function enqueueClock(input: Omit<QueuedClockAction, "id" | "attempts" | "createdAt">): QueuedClockAction {
  const item: QueuedClockAction = {
    ...input,
    id: (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  const q = read();
  q.push(item);
  write(q);
  return item;
}

export function removeQueued(id: string) {
  write(read().filter((q) => q.id !== id));
}

export function updateQueued(id: string, patch: Partial<QueuedClockAction>) {
  write(read().map((q) => (q.id === id ? { ...q, ...patch } : q)));
}

export function clearFailed() {
  write(read().filter((q) => !q.failed));
}

// Lightweight cross-tab lock so two open tabs don't both flush.
export function acquireSyncLock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    const now = Date.now();
    if (raw) {
      const ts = Number(raw);
      if (Number.isFinite(ts) && now - ts < LOCK_TTL_MS) return false;
    }
    window.localStorage.setItem(LOCK_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export function releaseSyncLock() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(LOCK_KEY); } catch { /* noop */ }
}

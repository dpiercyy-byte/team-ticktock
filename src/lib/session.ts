// Client-side state helpers (NO server-only imports here)
const WORKER_KEY = "tt.worker";
const ADMIN_KEY = "tt.admin";

export type WorkerSession = { token: string; id: string; name: string };

export function getWorkerSession(): WorkerSession | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(WORKER_KEY) || "null"); } catch { return null; }
}
export function setWorkerSession(s: WorkerSession) {
  localStorage.setItem(WORKER_KEY, JSON.stringify(s));
}
export function clearWorkerSession() {
  localStorage.removeItem(WORKER_KEY);
}

// Admin: stored in localStorage so it survives closing the app; token expires after 1 year server-side.
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ADMIN_KEY);
  if (!v || v === "undefined" || v === "null") return null;
  return v;
}
export function setAdminToken(t: string) {
  if (typeof window === "undefined") return;
  if (!t || typeof t !== "string") { localStorage.removeItem(ADMIN_KEY); return; }
  localStorage.setItem(ADMIN_KEY, t);
}
export function clearAdminToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_KEY);
}

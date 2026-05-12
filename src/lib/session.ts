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

// Admin: stored in sessionStorage; token includes 30-min expiry server-side.
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_KEY);
}
export function setAdminToken(t: string) {
  sessionStorage.setItem(ADMIN_KEY, t);
}
export function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_KEY);
}

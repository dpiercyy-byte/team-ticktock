import { queryOptions } from "@tanstack/react-query";
import { getLedgerJob, listLedgerJobs } from "./ledger.functions";
import { clearAdminToken, getAdminToken } from "./session";

/** Redirect without rejecting the active Suspense query. Rejecting while a
 * full-page navigation is in progress makes React Query retry the request and
 * can turn the resulting socket cancellation into a blank error screen. */
function signInAgain(): Promise<never> {
  clearAdminToken();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin")) {
    window.location.replace("/admin");
  }
  return new Promise<never>(() => {});
}

async function requireToken(): Promise<string> {
  const t = getAdminToken();
  if (!t) return signInAgain();
  return t;
}

/** Server fns reject with a raw `Response` on an expired token. */
async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Response && (e.status === 401 || e.status === 403)) return signInAgain();
    throw e;
  }
}

export const ledgerJobsQuery = () =>
  queryOptions({
    queryKey: ["ledger", "jobs"],
    queryFn: async () => {
      const token = await requireToken();
      const res = await withAuth(() => listLedgerJobs({ data: { token } }));
      return res.jobs;
    },
    staleTime: 15_000,
    retry: false,
  });

export const ledgerJobQuery = (id: string) =>
  queryOptions({
    queryKey: ["ledger", "jobs", id],
    queryFn: async () => {
      const token = await requireToken();
      const res = await withAuth(() => getLedgerJob({ data: { token, id } }));
      return { job: res.job, timeline: res.timeline };
    },
    staleTime: 15_000,
    retry: false,
  });

import { queryOptions } from "@tanstack/react-query";
import { getLedgerJob, listLedgerJobs } from "./ledger.functions";
import { clearAdminToken, getAdminToken } from "./session";

/** Send the user back to the admin sign-in instead of letting a raw 401
 *  Response bubble into React (which renders a blank error screen). */
function signInAgain(): never {
  clearAdminToken();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin")) {
    window.location.href = "/admin";
  }
  throw new Error("Your admin session expired. Please sign in again.");
}

function requireToken(): string {
  const t = getAdminToken();
  if (!t) signInAgain();
  return t;
}

/** Server fns reject with a raw `Response` on an expired token. */
async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Response && (e.status === 401 || e.status === 403)) signInAgain();
    throw e;
  }
}

export const ledgerJobsQuery = () =>
  queryOptions({
    queryKey: ["ledger", "jobs"],
    queryFn: async () => {
      const token = requireToken();
      const res = await withAuth(() => listLedgerJobs({ data: { token } }));
      return res.jobs;
    },
    staleTime: 15_000,
  });

export const ledgerJobQuery = (id: string) =>
  queryOptions({
    queryKey: ["ledger", "jobs", id],
    queryFn: async () => {
      const token = requireToken();
      const res = await withAuth(() => getLedgerJob({ data: { token, id } }));
      return { job: res.job, timeline: res.timeline };
    },
    staleTime: 15_000,
  });

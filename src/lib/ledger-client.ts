import { queryOptions } from "@tanstack/react-query";
import { getLedgerJob, listLedgerJobs } from "./ledger.functions";
import { getAdminToken } from "./session";

function requireToken(): string {
  const t = getAdminToken();
  if (!t) throw new Response("Admin required", { status: 401 });
  return t;
}

export const ledgerJobsQuery = () =>
  queryOptions({
    queryKey: ["ledger", "jobs"],
    queryFn: async () => {
      const token = requireToken();
      const res = await listLedgerJobs({ data: { token } });
      return res.jobs;
    },
    staleTime: 15_000,
  });

export const ledgerJobQuery = (id: string) =>
  queryOptions({
    queryKey: ["ledger", "jobs", id],
    queryFn: async () => {
      const token = requireToken();
      const res = await getLedgerJob({ data: { token, id } });
      return { job: res.job, timeline: res.timeline };
    },
    staleTime: 15_000,
  });

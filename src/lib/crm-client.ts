import { queryOptions } from "@tanstack/react-query";
import { getClientProfile, listClientsDirectory, listPipeline, listTodayItems } from "./crm.functions";
import { getAdminToken } from "./session";

function requireToken(): string {
  const t = getAdminToken();
  if (!t) throw new Response("Admin required", { status: 401 });
  return t;
}

export const pipelineQuery = () =>
  queryOptions({
    queryKey: ["crm", "pipeline"],
    queryFn: async () => (await listPipeline({ data: { token: requireToken() } })).cards,
    staleTime: 10_000,
  });

export const todayQuery = () =>
  queryOptions({
    queryKey: ["crm", "today"],
    queryFn: async () => {
      const res = await listTodayItems({ data: { token: requireToken() } });
      return { cards: res.cards, followUps: res.followUps };
    },
    staleTime: 10_000,
  });

export const clientsDirectoryQuery = (q: string, filter: "active" | "archived") =>
  queryOptions({
    queryKey: ["crm", "clients", filter, q],
    queryFn: async () =>
      (await listClientsDirectory({ data: { token: requireToken(), q, filter } })).clients,
    staleTime: 10_000,
  });

export const clientProfileQuery = (id: string) =>
  queryOptions({
    queryKey: ["crm", "client", id],
    queryFn: async () => {
      const res = await getClientProfile({ data: { token: requireToken(), id } });
      return {
        client: res.client,
        properties: res.properties,
        projects: res.projects,
        recentActivity: res.recentActivity,
      };
    },
    staleTime: 10_000,
  });

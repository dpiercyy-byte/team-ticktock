import { queryOptions } from "@tanstack/react-query";
import { listCalendarRecords, listOverdueTasks, listProjectTasks } from "./tasks.functions";
import { getAdminToken } from "./session";

function requireToken(): string {
  const t = getAdminToken();
  if (!t) throw new Response("Admin required", { status: 401 });
  return t;
}

export const projectTasksQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["ledger", "tasks", projectId],
    queryFn: async () =>
      (await listProjectTasks({ data: { token: requireToken(), projectId } })).tasks,
    staleTime: 10_000,
  });

export const overdueTasksQuery = () =>
  queryOptions({
    queryKey: ["ledger", "tasks", "overdue"],
    queryFn: async () => (await listOverdueTasks({ data: { token: requireToken() } })).tasks,
    staleTime: 10_000,
  });

export const calendarRecordsQuery = () =>
  queryOptions({
    queryKey: ["ledger", "calendar"],
    queryFn: async () => (await listCalendarRecords({ data: { token: requireToken() } })).records,
    staleTime: 10_000,
  });

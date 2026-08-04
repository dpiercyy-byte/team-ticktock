import { queryOptions } from "@tanstack/react-query";
import { getProjectWorkspace } from "./workspace.functions";
import { getAdminToken } from "./session";

export const workspaceQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["ledger", "workspace", projectId],
    queryFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Response("Admin required", { status: 401 });
      return getProjectWorkspace({ data: { token, projectId } });
    },
    staleTime: 10_000,
  });

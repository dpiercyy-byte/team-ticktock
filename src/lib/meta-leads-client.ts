import { queryOptions } from "@tanstack/react-query";
import { getMetaLead, listMetaLeads } from "./meta-leads.functions";
import { getAdminToken } from "./session";
const token = () => { const value = getAdminToken(); if (!value) throw new Error("Admin required"); return value; };
export const metaLeadsQuery = () => queryOptions({ queryKey: ["meta-leads"], queryFn: () => listMetaLeads({ data: { token: token() } }), staleTime: 10_000 });
export const metaLeadQuery = (id: string) => queryOptions({ queryKey: ["meta-leads", id], queryFn: () => getMetaLead({ data: { token: token(), id } }), staleTime: 10_000 });

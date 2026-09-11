import { createFileRoute } from "@tanstack/react-router";
import { syncAllLeadSources } from "@/lib/meta-leads.server";
export const Route = createFileRoute("/api/public/hooks/sync-meta-leads")({ server: { handlers: { POST: async () => { try { const result = await syncAllLeadSources(); return Response.json(result); } catch (error) { const message = error instanceof Error ? error.message : String(error); console.error("Meta leads sync failed", message); return Response.json({ error: message }, { status: 500 }); } } } } });

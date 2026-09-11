import { createFileRoute } from "@tanstack/react-router";
import { getSyncSettings, syncAll } from "@/lib/sheet-jobs.server";
import { syncAllLeadSources } from "@/lib/meta-leads.server";

// Called on a schedule so the "ongoing" job sheets keep flowing into Ledger.
export const Route = createFileRoute("/api/public/hooks/sync-sheet-jobs")({
  server: {
    handlers: {
      POST: async () => {
        const settings = await getSyncSettings();
        if (!settings.enabled) return Response.json({ skipped: "disabled" });
        try {
          const [jobs, leads] = await Promise.all([syncAll(), syncAllLeadSources()]);
          return Response.json({
            synced: jobs.synced,
            failed: jobs.failed,
            leadsImported: leads.imported,
            leadSourcesFailed: leads.failed,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("sheet job sync failed", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});

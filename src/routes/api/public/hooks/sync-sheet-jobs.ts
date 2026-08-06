import { createFileRoute } from "@tanstack/react-router";
import { getSyncSettings, syncAll } from "@/lib/sheet-jobs.server";

// Called on a schedule so the "ongoing" job sheets keep flowing into Ledger.
export const Route = createFileRoute("/api/public/hooks/sync-sheet-jobs")({
  server: {
    handlers: {
      POST: async () => {
        const settings = await getSyncSettings();
        if (!settings.enabled) return Response.json({ skipped: "disabled" });
        try {
          const result = await syncAll();
          return Response.json({ synced: result.synced, failed: result.failed });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("sheet job sync failed", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

function torontoCutoff(clockInISO: string, hour = 20): Date {
  const tz = "America/Toronto";
  const ci = new Date(clockInISO);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(ci);
  const y = Number(parts.find(p => p.type === "year")!.value);
  const m = Number(parts.find(p => p.type === "month")!.value);
  const d = Number(parts.find(p => p.type === "day")!.value);
  let candidate = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  for (let i = 0; i < 3; i++) {
    const localHour = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", hour12: false,
    }).format(candidate).replace("24", "00"));
    const diff = hour - localHour;
    if (diff === 0) break;
    candidate = new Date(candidate.getTime() + diff * 3600_000);
  }
  return candidate;
}

export const Route = createFileRoute("/api/public/hooks/auto-clockout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { forceCloseEntry } = await import("@/lib/entries.functions");

        const { data: openEntries, error } = await supabaseAdmin
          .from("time_entries")
          .select("id, clock_in")
          .is("clock_out", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const now = new Date();
        let closed = 0;
        const errors: { id: string; message: string }[] = [];
        for (const e of openEntries ?? []) {
          const cutoff = torontoCutoff(e.clock_in, 20);
          const target = cutoff < now ? cutoff : now;
          try {
            await forceCloseEntry({
              entryId: e.id,
              clockOutISO: target.toISOString(),
              actor: { kind: "system" },
              reason: "auto_8pm",
            });
            closed++;
          } catch (err: any) {
            errors.push({ id: e.id, message: err?.message || String(err) });
          }
        }
        return Response.json({ closed, errors, scanned: openEntries?.length ?? 0 });
      },
    },
  },
});

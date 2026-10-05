import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Navigation } from "lucide-react";
import { workerMySchedule } from "@/lib/schedule.functions";

function fmtArrival(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

/** Read-only: the worker's next 7 days of scheduled jobs. */
export function WorkerScheduleCard({ token }: { token: string }) {
  const fn = useServerFn(workerMySchedule);
  const today = new Date().toLocaleDateString("en-CA");
  const q = useQuery({
    queryKey: ["my-schedule", today],
    queryFn: () => fn({ data: { token, from: today } }),
    refetchInterval: 5 * 60_000,
  });
  const rows: any[] = q.data?.assignments ?? [];
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" /> Your schedule
      </p>
      <div className="space-y-2">
        {rows.map((a) => {
          const isToday = a.work_date === today;
          const day = new Date(a.work_date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          const maps = a.job_sites?.address
            ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.job_sites.address)}`
            : null;
          return (
            <div key={a.id} className={`rounded-xl px-3 py-2 ${isToday ? "bg-primary/10 ring-1 ring-primary/40" : "bg-secondary"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{isToday ? "Today" : day}{a.arrival_time ? ` · arrive ${fmtArrival(a.arrival_time)}` : ""}</p>
                  <p className="truncate font-semibold">{a.job_sites?.label}</p>
                  {a.note && <p className="text-xs italic text-muted-foreground">{a.note}</p>}
                </div>
                {isToday && maps && (
                  <a href={maps} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                    <Navigation className="h-3.5 w-3.5" /> Directions
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

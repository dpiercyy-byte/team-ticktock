import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { statusTone } from "@/components/ledger/ledger-ui";
import { ledgerJobsQuery } from "@/lib/ledger-client";
import type { LedgerJob } from "@/lib/ledger.functions";

export const Route = createFileRoute("/ledger/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Ledger" },
      { name: "description", content: "See scheduled jobs on a clean, calm calendar." },
      { property: "og:title", content: "Calendar — Ledger" },
      { property: "og:description", content: "Scheduled jobs at a glance." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerJobsQuery());
  },
  component: CalendarPage,
});

function CalendarPage() {
  const { data: jobs } = useSuspenseQuery(ledgerJobsQuery());
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const days = useMemo(() => buildMonth(cursor), [cursor]);
  const jobsByDay = useMemo(() => {
    const map = new Map<string, LedgerJob[]>();
    jobs.forEach((j) => {
      if (!j.scheduledFor) return;
      const key = new Date(j.scheduledFor).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    });
    return map;
  }, [jobs]);
  const upcoming = jobs
    .filter((j) => j.scheduledFor)
    .sort((a, b) => +new Date(a.scheduledFor!) - +new Date(b.scheduledFor!))
    .slice(0, 5);

  return (
    <LedgerShell>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Calendar</h1>
        <p className="mt-1 text-sm l-muted">Everything scheduled, at a glance.</p>
      </header>

      <section className="l-card p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => setCursor(shiftMonth(cursor, -1))}><ChevronLeft className="h-4 w-4" /></IconBtn>
            <IconBtn onClick={() => setCursor(shiftMonth(cursor, 1))}><ChevronRight className="h-4 w-4" /></IconBtn>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wider l-muted">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const key = d.date.toDateString();
            const inMonth = d.date.getMonth() === cursor.getMonth();
            const isToday = key === new Date().toDateString();
            const dayJobs = jobsByDay.get(key) ?? [];
            return (
              <div key={i} className={
                "aspect-square rounded-xl p-1.5 text-left text-xs " +
                (isToday ? "bg-primary text-primary-foreground"
                  : inMonth ? "bg-secondary/40 text-foreground" : "l-muted/50")
              }>
                <div className="font-medium tabular-nums">{d.date.getDate()}</div>
                {dayJobs.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {dayJobs.slice(0, 3).map((_, idx) => (
                      <span key={idx} className={"h-1.5 w-1.5 rounded-full " + (isToday ? "bg-primary-foreground" : "bg-primary")} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 px-1 text-[15px] font-semibold tracking-tight">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="l-card px-4 py-8 text-center text-sm l-muted">
            Nothing scheduled.
          </div>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((j) => {
              const d = new Date(j.scheduledFor!);
              return (
                <Link
                  key={j.id}
                  to="/ledger/jobs/$jobId"
                  params={{ jobId: j.id }}
                  className="flex items-center gap-4 l-card px-4 py-3.5"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-center">
                    <div className="text-[10px] font-medium uppercase l-muted">
                      {d.toLocaleDateString(undefined, { month: "short" })}
                    </div>
                    <div className="-mt-0.5 text-base font-semibold tabular-nums">{d.getDate()}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{j.name}</p>
                    <p className="truncate text-xs l-muted">{j.address}</p>
                  </div>
                  <span className={"shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium " + statusTone(j.status)}>
                    {j.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </LedgerShell>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card l-muted hover:text-foreground">
      {children}
    </button>
  );
}

function buildMonth(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  const days: { date: Date }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({ date: d });
  }
  return days;
}

function shiftMonth(d: Date, delta: number) {
  const n = new Date(d);
  n.setMonth(d.getMonth() + delta);
  return n;
}

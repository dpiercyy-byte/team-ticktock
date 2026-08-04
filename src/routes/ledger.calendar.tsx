import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, DollarSign,
  Flag, Hammer, MapPin, ShieldCheck,
} from "lucide-react";
import type { ComponentType } from "react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { calendarRecordsQuery } from "@/lib/tasks-client";
import {
  CALENDAR_TYPES, CALENDAR_TYPE_LABEL, dayKey, groupByDay, upcomingRecords,
  type CalendarRecord, type CalendarType,
} from "@/lib/calendar-math";

export const Route = createFileRoute("/ledger/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Ledger" },
      { name: "description", content: "Site visits, start dates, tasks and payments in one calendar." },
      { property: "og:title", content: "Calendar — Ledger" },
      { property: "og:description", content: "Every dated record across your jobs." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(calendarRecordsQuery());
  },
  component: CalendarPage,
});

const ICON: Record<CalendarType, ComponentType<{ className?: string }>> = {
  site_visit: MapPin,
  start: Flag,
  completion: CheckCircle2,
  task: Hammer,
  payment: DollarSign,
  inspection: ShieldCheck,
  warranty: CalendarDays,
};

function CalendarPage() {
  const { data: records } = useSuspenseQuery(calendarRecordsQuery());
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [filter, setFilter] = useState<CalendarType | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);

  const shown = useMemo(
    () => (filter === "all" ? records : records.filter((r) => r.type === filter)),
    [records, filter],
  );
  const byDay = useMemo(() => groupByDay(shown), [shown]);
  const days = useMemo(() => buildMonth(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = dayKey(new Date().toISOString());
  const selectedRecords = selected ? (byDay.get(selected) ?? []) : [];
  const upcoming = useMemo(() => upcomingRecords(shown, today), [shown, today]);

  return (
    <LedgerShell>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Calendar</h1>
        <p className="mt-1 text-sm l-muted">Site visits, start dates, tasks and payments.</p>
      </header>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>All</FilterPill>
        {CALENDAR_TYPES.map((t) => (
          <FilterPill key={t} active={filter === t} onClick={() => setFilter(t)}>
            {CALENDAR_TYPE_LABEL[t]}
          </FilterPill>
        ))}
      </div>

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
            const key = dayKey(localIso(d.date));
            const inMonth = d.date.getMonth() === cursor.getMonth();
            const isToday = key === today;
            const isSelected = key === selected;
            const dayRecords = byDay.get(key) ?? [];
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(dayRecords.length > 0 ? key : null)}
                className={
                  "aspect-square rounded-xl p-1.5 text-left text-xs " +
                  (isToday
                    ? "bg-primary text-primary-foreground"
                    : isSelected
                      ? "bg-secondary text-foreground"
                      : inMonth
                        ? "bg-secondary/40 text-foreground"
                        : "l-muted/50")
                }
              >
                <div className="font-medium tabular-nums">{d.date.getDate()}</div>
                {dayRecords.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {dayRecords.slice(0, 3).map((r) => (
                      <span
                        key={r.id}
                        className={"h-1.5 w-1.5 rounded-full " + (isToday ? "bg-primary-foreground" : "bg-primary")}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 px-1 text-[15px] font-semibold tracking-tight">
          {selected ? niceDay(selected) : "Upcoming"}
        </h2>
        {(selected ? selectedRecords : upcoming).length === 0 ? (
          <div className="l-card px-4 py-8 text-center text-sm l-muted">Nothing scheduled.</div>
        ) : (
          <div className="grid gap-3">
            {(selected ? selectedRecords : upcoming).map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
          </div>
        )}
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mt-3 text-[12px] font-semibold l-accent"
          >
            Show upcoming
          </button>
        )}
      </section>
    </LedgerShell>
  );
}

function RecordRow({ record }: { record: CalendarRecord }) {
  const Icon = ICON[record.type];
  const d = new Date(record.date.length === 10 ? `${record.date}T12:00:00` : record.date);
  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: record.projectId }}
      className="flex items-center gap-4 l-card px-4 py-3.5"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-center">
        <div className="text-[10px] font-medium uppercase l-muted">
          {d.toLocaleDateString(undefined, { month: "short" })}
        </div>
        <div className="-mt-0.5 text-base font-semibold tabular-nums">{d.getDate()}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className={"truncate text-sm font-medium " + (record.done ? "line-through l-muted" : "")}>
          {record.title}
        </p>
        <p className="truncate text-xs l-muted">
          {record.projectName}
          {record.subtitle ? ` · ${record.subtitle}` : ""}
        </p>
      </div>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary">
        <Icon className="h-4 w-4" />
      </span>
    </Link>
  );
}

function FilterPill({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold " + (active ? "" : "l-pill")}
      style={active ? { background: "var(--l-ink)", color: "var(--l-on-ink)" } : undefined}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card l-muted hover:text-foreground">
      {children}
    </button>
  );
}

function localIso(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function niceDay(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

function buildMonth(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
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

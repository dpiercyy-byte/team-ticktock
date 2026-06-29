export function fmtHours(h: number) {
  return `${h.toFixed(2)} hrs`;
}
export function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
export function startOfWeekISO(d = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}
export function diffHours(a: string, b: string | Date) {
  const t = typeof b === "string" ? new Date(b).getTime() : b.getTime();
  return (t - new Date(a).getTime()) / 3600_000;
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekRangeLabel(iso: string): string {
  const start = new Date(iso + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameYear = start.getFullYear() === end.getFullYear();
  const fmt = (d: Date) => d.toLocaleDateString([], { month: "long", day: "numeric" });
  if (sameYear) return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  return `${fmt(start)}, ${start.getFullYear()} – ${fmt(end)}, ${end.getFullYear()}`;
}

export function relativeWeekLabel(iso: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(iso + "T00:00:00");
  const diff = Math.round((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (diff === 0) return "This week";
  if (diff === 1) return "Last week";
  if (diff > 1) return `${diff} weeks ago`;
  return null;
}

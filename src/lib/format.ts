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

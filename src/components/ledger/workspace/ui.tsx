import type { ReactNode } from "react";

export function Money({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] l-muted">{label}</p>
      <p
        className={
          "mt-1 truncate text-[22px] font-bold tabular-nums md:text-2xl " +
          (tone === "green" ? "l-green" : tone === "red" ? "l-red" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] l-muted">{label}</p>
      <div className="mt-0.5 truncate text-[14px] font-semibold">{value || "—"}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="l-card p-6 text-center text-[13px] l-muted">{children}</div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-1">
      <h2 className="l-eyebrow truncate">{children}</h2>
      {hint && <span className="shrink-0 text-[11px] tabular-nums l-muted">{hint}</span>}
    </div>
  );
}

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

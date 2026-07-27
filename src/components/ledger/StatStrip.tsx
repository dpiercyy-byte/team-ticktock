import type { ReactNode } from "react";

export function StatStrip({
  items,
}: {
  items: { label: string; value: ReactNode; tone?: "accent" | "green" | "muted" }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it) => (
        <div key={it.label} className="l-card px-3 py-4 text-center">
          <p
            className={
              "text-2xl font-bold tabular-nums " +
              (it.tone === "accent" ? "l-accent" : it.tone === "green" ? "l-green" : "")
            }
          >
            {it.value}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium l-muted">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

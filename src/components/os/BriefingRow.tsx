import type { ReactNode } from "react";

export function BriefingRow({
  title,
  count,
  children,
  empty,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  empty?: string;
}) {
  const isEmpty = Array.isArray((children as any).props?.children)
    ? (children as any).props.children.length === 0
    : false;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2
          className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500"
        >
          {title}
        </h2>
        {typeof count === "number" && count > 0 && (
          <span className="text-xs font-medium text-slate-400">{count}</span>
        )}
      </div>
      {isEmpty && empty ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 px-4 py-6 text-center text-xs text-slate-400">
          {empty}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

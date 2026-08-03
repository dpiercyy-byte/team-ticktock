import { AlertCircle, CalendarClock, CheckCircle2 } from "lucide-react";
import { nextActionState } from "@/lib/crm-math";

type CardLike = {
  nextAction: string | null;
  nextActionOwner?: string | null;
  nextActionDueAt: string | null;
  nextActionStatus: string | null;
};

function dueLabel(iso: string | null) {
  if (!iso) return "no due date";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** One line: the single next action, who owns it, when it is due. */
export function NextActionLine({
  card,
  className = "",
}: {
  card: CardLike;
  className?: string;
}) {
  const state = nextActionState({
    action: card.nextAction,
    status: card.nextActionStatus,
    dueAt: card.nextActionDueAt,
  });

  if (state === "none") {
    return (
      <p className={"text-[12px] italic l-muted " + className}>No next action set</p>
    );
  }

  const Icon = state === "done" ? CheckCircle2 : state === "overdue" ? AlertCircle : CalendarClock;
  const tone = state === "done" ? "l-green" : state === "overdue" ? "l-red" : "l-muted";

  return (
    <div className={"grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 " + className}>
      <Icon className={"mt-[2px] h-3.5 w-3.5 shrink-0 " + tone} />
      <div className="min-w-0">
        <p className={"truncate text-[13px] font-semibold " + (state === "done" ? "l-muted" : "")}>
          {card.nextAction}
        </p>
        <p className={"truncate text-[11px] font-semibold " + tone}>
          {state === "done"
            ? "Completed"
            : `${state === "overdue" ? "Overdue · " : state === "today" ? "Due today · " : "Due "}${
                state === "overdue" || state === "today" ? "" : dueLabel(card.nextActionDueAt)
              }${state === "overdue" ? dueLabel(card.nextActionDueAt) : ""}`}
          {card.nextActionOwner ? ` · ${card.nextActionOwner}` : ""}
        </p>
      </div>
    </div>
  );
}

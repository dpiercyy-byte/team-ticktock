import type { ComponentType } from "react";
import {
  Calendar, CheckCircle2, Clock, DollarSign, FileText, Hammer, LogOut, MapPin,
  Package, PenSquare, Phone, Receipt, ShieldCheck, Sparkles,
} from "lucide-react";
import { shortDateTime } from "@/components/ledger/ledger-ui";
import { Empty } from "./ui";
import type { WorkspaceEvent } from "@/lib/workspace-math";

const ICON: Record<string, ComponentType<{ className?: string }>> = {
  created: PenSquare, status: Hammer, stage: Hammer, note: FileText, call: Phone, visit: MapPin,
  estimate: FileText, approval: CheckCircle2, payment: DollarSign, clockin: Clock,
  clockout: LogOut, receipt: Receipt, material: Package, change_order: PenSquare,
  inspection: ShieldCheck, completed: Sparkles, activated: Sparkles,
};

export function ActivityTab({ timeline }: { timeline: WorkspaceEvent[] }) {
  if (timeline.length === 0) return <Empty>No activity yet.</Empty>;
  return (
    <div className="relative">
      <div
        className="absolute bottom-3 left-[19px] top-3 w-px"
        style={{ background: "var(--l-line)" }}
        aria-hidden
      />
      <ol className="grid gap-3">
        {timeline.map((e) => {
          const Icon = ICON[e.kind] ?? Calendar;
          return (
            <li key={e.id} className="relative flex items-start gap-4">
              <div
                className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full"
                style={{ background: "var(--l-surface)", boxShadow: "var(--shadow-card)" }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="l-card min-w-0 flex-1 px-4 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                  <p className="truncate text-[14px] font-semibold">{e.title}</p>
                  <p className="shrink-0 text-[11px] tabular-nums l-muted">
                    {shortDateTime(e.occurredAt)}
                  </p>
                </div>
                {e.detail && <p className="mt-0.5 text-[12px] l-muted">{e.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { Phone, Users } from "lucide-react";
import { formatCurrency } from "@/components/ledger/ledger-ui";
import { Empty, Field, Money, SectionTitle, fmtDate } from "./ui";
import type { LabourRow } from "@/lib/workspace-math";

type Project = {
  id: string;
  name: string;
  client: string;
  clientId: string | null;
  clientPhone: string | null;
  address: string;
  projectType: string;
  status: string;
  deliveryStatus: string | null;
  assignedOwner: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  expectedStartDate: string | null;
  actualStartDate: string | null;
  expectedCompletionDate: string | null;
  actualCompletionDate: string | null;
  progress: number;
};

type Rollup = {
  contractValue: number;
  collected: number;
  labourCost: number;
  materialCost: number;
  recordedCosts: number;
  preliminaryProfit: number;
  outstanding: number;
};

export function OverviewTab({
  project,
  rollup,
  onSite,
  openIssues,
}: {
  project: Project;
  rollup: Rollup;
  onSite: LabourRow[];
  openIssues: {
    flaggedEntries: number;
    receiptsNeedingReview: number;
    overduePayments: number;
    noJobSite: boolean;
  };
}) {
  const issues = [
    openIssues.noJobSite ? "No Clockwise job site connected" : null,
    openIssues.flaggedEntries ? `${openIssues.flaggedEntries} flagged time entr${openIssues.flaggedEntries === 1 ? "y" : "ies"}` : null,
    openIssues.receiptsNeedingReview ? `${openIssues.receiptsNeedingReview} receipt${openIssues.receiptsNeedingReview === 1 ? "" : "s"} need review` : null,
    openIssues.overduePayments ? `${openIssues.overduePayments} overdue payment${openIssues.overduePayments === 1 ? "" : "s"}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-3">
      <section className="l-sheet p-5 md:p-7">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
          <h2 className="l-eyebrow truncate">Financial snapshot</h2>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums l-muted">
            {project.progress}% complete
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
          <Money label="Contract value" value={formatCurrency(rollup.contractValue)} />
          <Money label="Collected" value={formatCurrency(rollup.collected)} tone="green" />
          <Money label="Recorded costs" value={formatCurrency(rollup.recordedCosts)} />
          <Money
            label="Preliminary profit"
            value={formatCurrency(rollup.preliminaryProfit)}
            tone={rollup.preliminaryProfit >= 0 ? "green" : "red"}
          />
        </div>

        <p className="mt-4 text-[11px] l-muted">
          Labour {formatCurrency(rollup.labourCost)} · Materials {formatCurrency(rollup.materialCost)} ·
          Outstanding {formatCurrency(rollup.outstanding)}
        </p>

        <div
          className="mt-4 h-2 w-full overflow-hidden rounded-full"
          style={{ background: "var(--l-surface-2)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${project.progress}%`, background: "var(--l-accent)" }}
          />
        </div>
      </section>

      <div
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] px-4 py-3.5"
        style={{ background: onSite.length > 0 ? "hsl(152 46% 94%)" : "var(--l-surface-2)" }}
      >
        <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold">
          <Users className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {onSite.length === 0
              ? "No workers clocked in"
              : `${onSite.map((w) => w.worker).join(", ")} on site`}
          </span>
        </span>
        {project.clientPhone && (
          <a
            href={`tel:${project.clientPhone}`}
            className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold l-accent"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        )}
      </div>

      <section className="l-card p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Client" value={project.client} />
          <Field label="Project type" value={project.projectType} />
          <Field label="Property" value={project.address} />
          <Field label="Delivery status" value={project.deliveryStatus ?? project.status} />
          <Field label="Assigned owner" value={project.assignedOwner} />
          <Field
            label="Upcoming milestone"
            value={
              project.nextAction
                ? `${project.nextAction}${project.nextActionDueAt ? ` · ${fmtDate(project.nextActionDueAt)}` : ""}`
                : null
            }
          />
          <Field
            label="Start"
            value={
              project.actualStartDate
                ? `${fmtDate(project.actualStartDate)} (actual)`
                : project.expectedStartDate
                  ? `${fmtDate(project.expectedStartDate)} (expected)`
                  : null
            }
          />
          <Field
            label="Completion"
            value={
              project.actualCompletionDate
                ? `${fmtDate(project.actualCompletionDate)} (actual)`
                : project.expectedCompletionDate
                  ? `${fmtDate(project.expectedCompletionDate)} (expected)`
                  : null
            }
          />
        </div>
        {project.clientId && (
          <Link
            to="/ledger/people/$clientId"
            params={{ clientId: project.clientId }}
            className="mt-4 inline-flex text-[12px] font-semibold l-accent"
          >
            View {project.client}'s profile
          </Link>
        )}
      </section>

      <section className="mt-3">
        <SectionTitle>Open issues</SectionTitle>
        {issues.length === 0 ? (
          <Empty>Nothing needs attention on this job.</Empty>
        ) : (
          <ul className="grid gap-2">
            {issues.map((i) => (
              <li key={i} className="l-card px-4 py-3 text-[13px] font-semibold">
                {i}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

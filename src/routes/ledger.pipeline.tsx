import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronDown, MapPin, Plus, User } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { formatCurrency } from "@/components/ledger/ledger-ui";
import { NextActionLine } from "@/components/ledger/NextActionLine";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pipelineQuery } from "@/lib/crm-client";
import { moveProjectStage, type PipelineCard } from "@/lib/crm.functions";
import { LEDGER_SALES_STAGES } from "@/lib/ledger-stages";
import { daysInStageLabel } from "@/lib/crm-math";
import { getAdminToken } from "@/lib/session";

export const Route = createFileRoute("/ledger/pipeline")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pipeline — Ledger" },
      { name: "description", content: "Every opportunity by sales stage, one calm board." },
      { property: "og:title", content: "Pipeline — Ledger" },
      { property: "og:description", content: "Every opportunity by sales stage." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(pipelineQuery());
  },
  component: PipelineScreen,
});

function PipelineScreen() {
  const { data: cards } = useSuspenseQuery(pipelineQuery());
  const [stage, setStage] = useState<string>(LEDGER_SALES_STAGES[0]);
  const qc = useQueryClient();
  const move = useServerFn(moveProjectStage);

  const moveMutation = useMutation({
    mutationFn: async (vars: { id: string; salesStage: string }) => {
      const token = getAdminToken();
      if (!token) throw new Error("Not signed in");
      return move({ data: { token, id: vars.id, salesStage: vars.salesStage as never } });
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      qc.invalidateQueries({ queryKey: ["ledger", "jobs"] });
      qc.invalidateQueries({ queryKey: ["ledger", "jobs", vars.id] });
    },
  });

  const inStage = cards.filter((c) => c.salesStage === stage);

  return (
    <LedgerShell>
      <header className="mb-5">
        <p className="text-[13px] font-medium l-muted">{cards.length} open opportunities</p>
        <h1 className="mt-1 display text-[34px] leading-[1.05] md:text-[42px]">Pipeline</h1>
      </header>

      <Link
        to="/ledger/leads/new"
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-bold"
        style={{ background: "var(--l-ink)", color: "var(--l-on-ink)" }}
      >
        <Plus className="h-5 w-5" /> New lead
      </Link>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 tab-scroll md:-mx-8 md:px-8">
        {LEDGER_SALES_STAGES.map((s) => {
          const n = cards.filter((c) => c.salesStage === s).length;
          const active = s === stage;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              aria-pressed={active}
              className={
                "shrink-0 rounded-full px-3.5 py-2.5 text-[12px] font-semibold transition-colors " +
                (active ? "" : "l-card l-muted")
              }
              style={active ? { background: "var(--l-ink)", color: "var(--l-on-ink)" } : undefined}
            >
              {s} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <section className="mt-5 grid gap-3">
        {inStage.length === 0 ? (
          <div className="l-card px-4 py-10 text-center text-[13px] l-muted">
            Nothing in {stage} right now.
          </div>
        ) : (
          inStage.map((c) => (
            <PipelineCardRow
              key={c.id}
              card={c}
              onMove={(s) => moveMutation.mutate({ id: c.id, salesStage: s })}
              pending={moveMutation.isPending && moveMutation.variables?.id === c.id}
            />
          ))
        )}
      </section>
    </LedgerShell>
  );
}

function PipelineCardRow({
  card,
  onMove,
  pending,
}: {
  card: PipelineCard;
  onMove: (stage: string) => void;
  pending: boolean;
}) {
  return (
    <article className={"l-card p-4 " + (pending ? "opacity-60" : "")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <Link to="/ledger/jobs/$jobId" params={{ jobId: card.id }} className="min-w-0">
          <p className="truncate text-[16px] font-bold tracking-tight">{card.clientName}</p>
          <p className="mt-0.5 truncate text-[13px] l-muted">{card.projectType}</p>
        </Link>
        {card.estimatedValue > 0 && (
          <span className="shrink-0 text-right text-[15px] font-bold tabular-nums">
            {formatCurrency(card.estimatedValue)}
          </span>
        )}
      </div>

      <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-[12px] l-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{card.address}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] l-muted">
        <span className="inline-flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {card.assignedOwner || "Unassigned"}
        </span>
        <span className="tabular-nums">In stage {daysInStageLabel(card.salesStageChangedAt)}</span>
      </div>

      <NextActionLine card={card} className="mt-2.5" />

      <div className="mt-3 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold"
              style={{ background: "var(--l-surface-2)" }}
            >
              Move stage <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LEDGER_SALES_STAGES.map((s) => (
              <DropdownMenuItem key={s} disabled={s === card.salesStage} onSelect={() => onMove(s)}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

// Pure, presentation-level cost shaping for Ledger job cards.
//
// Phase 1: `total` comes from the job's recorded expenses; labour/materials are
// not split yet. Phase 2 only has to change this helper's source (Clockwise
// time entries for labour, receipt scanner rows for materials) — every consumer
// keeps working unchanged.

import type { LedgerJob } from "./ledger.functions";

export type JobCosts = {
  labour: number;
  materials: number;
  other: number;
  total: number;
};

export function jobCosts(job: Pick<LedgerJob, "expenses">): JobCosts {
  const total = Math.max(0, job.expenses || 0);
  return { labour: 0, materials: 0, other: total, total };
}

/** Budget minus recorded costs. Negative means an overrun. */
export function marginOf(job: Pick<LedgerJob, "budget" | "expenses">): number {
  return (job.budget || 0) - jobCosts(job).total;
}

export type CostTone = "none" | "healthy" | "warning" | "over";

/** Green under 75% of budget, yellow to 100%, red beyond. */
export function costTone(budget: number, cost: number): CostTone {
  if (!budget || budget <= 0) return "none";
  const pct = cost / budget;
  if (pct > 1) return "over";
  if (pct >= 0.75) return "warning";
  return "healthy";
}

/** 0-100 fill for the profit bar. */
export function costPercent(budget: number, cost: number): number {
  if (!budget || budget <= 0) return 0;
  return Math.min(100, Math.round((cost / budget) * 100));
}

/** Aggregate figures for the macro dashboard header. */
export function portfolioTotals(jobs: Pick<LedgerJob, "budget" | "expenses">[]) {
  const budgets = jobs.reduce((s, j) => s + (j.budget || 0), 0);
  const costs = jobs.reduce((s, j) => s + jobCosts(j).total, 0);
  return { budgets, costs, expectedProfit: budgets - costs };
}

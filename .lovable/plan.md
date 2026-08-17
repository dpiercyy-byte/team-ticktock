# Ledger as a financial dashboard — Phase 1

Turn the Ledger jobs page into a money-first dashboard: a macro summary header, financial job cards, and a cost-vs-budget bar. CRM/pipeline stages disappear from this screen.

## 1. Filters

Filter pills reduce to: All · Scheduled · Active · Completed. Lead, Site Visit, Estimate and Approval are removed from the Ledger list, and jobs in those stages are excluded from the list entirely (they stay available in the Pipeline tab, nothing is deleted).

## 2. Macro dashboard header

The plain "Jobs" title row is replaced by a high-contrast summary strip with three aggregates across all Active jobs:

- Total Active Budgets — sum of budgets
- Total Costs (MTD) — sum of recorded costs (placeholder aggregation for now, labelled as such)
- Expected Profit — budgets minus costs

Compact, tabular numerals, generous whitespace, one line of small caption text under each figure. The "New" job button stays, moved to sit beside the summary.

## 3. Job card redesign

Each card keeps the street-address heading, with client name and full address as small muted text. Below that, three financial figures in a row:

- Total Budget
- Actual Costs
- Remaining Margin (budget − costs, tinted red when negative)

Status pill stays; trade pills, avatar initials and the budget footer strip are dropped so the card reads as a financial row.

## 4. Profit bar

A thin rounded bar under the figures shows Actual Costs filling Total Budget:

- Green below 75% of budget
- Yellow between 75% and 100%
- Red above 100% (bar full, overrun amount shown next to it)

Jobs with no budget show a neutral, empty track.

## Phase 2 prep (structure only, no new data yet)

Costs are read through a single small helper that returns a shaped object rather than one number:

```text
jobCosts(job) -> { labour, materials, other, total }
```

Phase 1 fills `total` from the job's recorded expenses and leaves `labour`/`materials` at zero, so Phase 2 only has to change that helper's source (Clockwise time entries for labour, receipt scanner rows for materials) — the card and the header keep working unchanged.

## Technical notes

- `src/routes/ledger.jobs.index.tsx`: swap the header for the new summary component, restrict `LEDGER_STATUSES` pills to the three money stages, filter out non-money stages before rendering.
- New `src/components/ledger/FinanceSummary.tsx` (macro header) and `src/components/ledger/JobProfitBar.tsx`.
- New `src/lib/job-costs.ts`: pure `jobCosts(job)` returning `{ labour, materials, other, total }` plus `marginOf(job)` and a `costTone()` returning the green/yellow/red bucket — unit-testable, no server calls.
- `src/components/ledger/JobCard.tsx` rewritten around those helpers; existing green/amber status tinting kept via the current `--success` / `--warning` tokens, bar colours use the same semantic tokens (plus `--destructive` for overrun). No hardcoded hex.
- No schema, server function or Sheets changes in this phase.

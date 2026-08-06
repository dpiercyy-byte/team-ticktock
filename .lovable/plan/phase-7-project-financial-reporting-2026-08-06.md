# Phase 7 — Project Financial Reporting

Give every project one trustworthy money summary, built only from records that already exist (Clockwise time entries, receipts/reimbursements, the payment register) plus two new record types the app has no source for yet: change orders and non-receipt project costs (subcontractors, permits, other).

## What you'll see

A new **Financials** tab in the job workspace with three blocks:

**Revenue**
- Original accepted contract value
- Approved change orders (sum of approved orders only)
- Revised contract value (original + approved change orders)
- Payments received (from the payment register)
- Outstanding balance (revised contract − received)

**Costs**
- Materials (company receipts)
- Client-billable materials (shown separately, never mixed into company cost)
- Subcontractors
- Clockwise labour cost
- Worker reimbursements
- Permits and fees
- Other project costs

**Results**
- Total revenue, total cost
- Current gross profit and margin (actual, recorded to date)
- Forecast gross profit and margin (revised contract vs forecast cost)
- Percentage collected

Every line is tappable and drills into the source rows behind it (time entries, receipts, payments, cost entries), so a total can always be traced. Actual figures and projected figures are visually and textually distinct — forecast values are labelled "Forecast" and never presented as recorded results.

A short banner flags reconciliation issues: receipts still needing review, open (running) time entries, unlinked job sites, and any project whose last Sheets export no longer matches current source data.

## New records

- **Change orders**: description, amount, status (draft / approved / rejected), approved date, notes. Only approved orders change the revised contract value.
- **Project costs**: manual entries for subcontractors, permits and fees, and other costs — description, vendor, amount, category, date, and whether it is client-billable. Receipt-backed material spend keeps coming from reimbursements; this table never duplicates it.

Both support add/edit/delete from the Financials tab, and every create/edit/delete writes to the existing append-only audit log with before/after values.

## Accounting rules honoured

- Labour is computed from Clockwise entries × worker cost rate — never typed in.
- Receipt costs come from the reimbursement/receipt records.
- Payments come from the project payment register.
- No derived total is stored; the summary is calculated on read.
- Client-billable purchases are reported apart from company costs.
- The app states plainly that this is operational job costing, not an accounting or tax ledger.

## Google Sheets

- All current exports keep working untouched (worker entries, payouts, cash tracking).
- A **Project ID** column is added only to the tabs this app writes and owns end to end — the per-worker Time Entries tabs and the Receipts tab — and it fills in only when the record is linked to a project. The Cash Tracking sheet's hand-made layout is not touched, and no existing column moves or is renamed.
- A new **Project Summary** export writes one row per project from the canonical data into its own app-owned tab: contract, change orders, revised contract, received, outstanding, each cost bucket, profit and margin, plus the export timestamp.
- One direction only — the app writes to Sheets, never reads back. Nothing existing is removed; the summary export runs alongside the old workflow so results can be compared across several completed projects first.
- Each project shows a reconciliation indicator when its live figures differ from what was last exported.

## Technical notes

- Migration: `project_change_orders` and `project_costs` tables (FK to `ledger_jobs`, cents columns, `updated_at` trigger, deny-all RLS matching existing tables, service_role grants), plus `last_summary_export_at` / `last_summary_export_hash` on `ledger_jobs` for the reconciliation indicator.
- New pure module `src/lib/finance-math.ts` holds every calculation (revenue rollup, cost buckets, margins, forecast, collected %), unit-tested in `tests/unit/finance-math.test.ts`. `projectRollup` in `workspace-math.ts` stays for existing callers and delegates to the new module so the Overview snapshot and Financials tab can never disagree.
- `src/lib/workspace.server.ts` gains reads for change orders and project costs; `loadWorkspace` returns a `finance` payload. `src/lib/finance.functions.ts` exposes create/update/delete server fns for the two new record types, each writing an audit entry via the existing `audit.server` helper.
- UI: `src/components/ledger/workspace/FinancialsTab.tsx` plus small drill-down sheets, wired into the tab list in `src/routes/ledger.jobs.$jobId.tsx`. The Overview financial snapshot reuses the same numbers.
- Sheets: extend `src/lib/sheet-export.server.ts` with a `Project Summary` tab writer and add the Project ID column to existing project-aware rows; the current tab writers keep their headers and behaviour.
- Forecast basis: forecast cost = recorded costs + remaining budgeted cost derived from the project budget and progress; if a project has no usable budget, forecast is shown as unavailable rather than guessed.

## Out of scope

Invoicing, tax handling, accounts payable, bidirectional Sheets sync, and any change to Clockwise payroll or reimbursement math.

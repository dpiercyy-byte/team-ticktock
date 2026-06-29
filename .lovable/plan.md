## Goal

Make it easy to see which weeks are unpaid for each worker, mark a week paid in one tap, and color-code status across the Payout views.

## What you'll see

**1. New "Pending" sub-tab** (Payout → Weekly | Pending | Lifetime)
- Aggregates every unpaid week across all workers, oldest first.
- Each row: worker name, week range, hours, total owed, status pill, "Mark paid" button.
- Color coding:
  - Red = overdue (week ended 14+ days ago)
  - Amber = current/recent unpaid (week ended <14 days ago)
  - Green = paid (hidden by default; toggle "show paid" to reveal)
- "All time until paid" scope — every unpaid week since the worker's first entry.

**2. Inline status on Weekly view worker cards**
- Each card gets a colored status pill in the header: Unpaid (amber), Overdue (red), or Paid (green).
- Card footer gets a "Mark paid" / "Mark unpaid" toggle button next to "Total owed".
- The week selector in Weekly view (existing) lets you scroll back; older weeks show their paid state.

**3. Lifetime view**
- Adds a small "Unpaid balance" stat under each worker card showing the sum of unpaid weeks.

## Paid scope

One toggle per worker per week marks labor + reimbursements paid together (per your answer). Marking paid records who/when in the audit log.

## Technical section

**New table** `public.weekly_payouts`
- `worker_id uuid` (FK workers)
- `week_start date` (Monday)
- `paid_at timestamptz`
- `paid_by text` (admin label)
- `amount numeric` (snapshot of total owed at time of marking)
- `hours numeric`, `reimbursement_total numeric` (snapshots)
- `notes text nullable`
- Unique `(worker_id, week_start)`
- RLS deny-all (matches existing pattern); access via server functions using `supabaseAdmin` after admin token verification — same pattern as other admin functions.
- GRANT to `service_role`; no anon/authenticated grants.

**New server functions** in `src/lib/payout.functions.ts`:
- `listPendingWeeks({ token })` → returns `[{ workerId, workerName, weekStart, weekEnd, hours, wages, reimbursements, total, status: 'overdue'|'unpaid'|'paid', paidAt? }]`, oldest unpaid first, all time.
- `markWeekPaid({ token, workerId, weekStart })` → inserts into `weekly_payouts` with snapshot, writes audit log entry.
- `unmarkWeekPaid({ token, workerId, weekStart })` → deletes row, writes audit log entry.
- `weeklyPayout` extended to include `paidAt` per worker for the selected week.

**UI changes** in `src/components/admin/AdminApp.tsx`:
- `PayoutsTab` gets a third tab: Weekly | Pending | Lifetime.
- New `PendingPayoutsView` component: table/card list with status pill, color-coded left border, "Mark paid" button (mutation invalidates `pending-payouts`, `weekly-payout`, `lifetime-payout`).
- Weekly worker cards updated with status pill in header and Mark paid/unpaid toggle in footer.
- Status color tokens added to `src/styles.css` (`--status-overdue`, `--status-unpaid`, `--status-paid`) so no hardcoded colors.

**Status thresholds**: overdue if `today - weekEnd >= 14 days` and not paid; otherwise unpaid; paid if a `weekly_payouts` row exists.

**Audit**: `mark_week_paid` / `unmark_week_paid` actions logged with worker, week, amount snapshot.

No worker-side changes. No edits to existing clock or geo logic.

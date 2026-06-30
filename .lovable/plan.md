## Goal

Make every admin-uploaded receipt visibly identifiable. Standalone admin uploads already show as "Admin" — keep that. Admin uploads on a worker's behalf will keep the worker's name but gain a clear **"Uploaded by admin"** badge.

## Changes

### 1. Schema (migration)

- Add `uploaded_by_admin boolean NOT NULL DEFAULT false` to `reimbursements`.
- Backfill from `audit_log`: set `uploaded_by_admin = true` for every reimbursement whose creation row in `audit_log` has `actor_kind = 'admin'` (covers both standalone admin uploads and admin-for-worker uploads, including historical ones).

### 2. Server functions (`src/lib/reimbursements.functions.ts`)

- `adminAddStandaloneReceipt` — also set `uploaded_by_admin: true` on insert (redundant with `is_admin_receipt` but keeps the new flag truthful).
- `addReimbursement` (admin adds on a worker's behalf) — set `uploaded_by_admin: true`.
- Worker self-upload server fn — unchanged (flag stays false).
- `listReimbursements` — include `uploadedByAdmin` in returned items.

### 3. Admin UI (`src/components/admin/AdminApp.tsx` Receipts tab)

- On each receipt card, when `uploadedByAdmin === true` AND `isAdminReceipt === false` (i.e. worker-named but admin-uploaded), render a small badge next to the worker name: **"Uploaded by admin"** (neutral/secondary variant).
- Standalone admin receipts already display "Admin" — no change.
- Worker dropdown filter — no structural change; the existing "Admin" entry continues to filter `is_admin_receipt = true`.

### 4. No change to Google Sheets sync

The "Worker" column already shows "Admin" for standalone admin receipts and the worker's name otherwise. The badge is a UI affordance only; the source data in Sheets stays consistent.

## Out of scope

- Reclassifying the two existing worker self-uploads ("Floor pro", "Paint from Benny moore") — these have `actor_kind = 'worker'` in the audit log, so the backfill correctly leaves them as worker uploads.

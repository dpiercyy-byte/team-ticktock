## Material type on receipts (Regular vs Client-billable)

Add a way to tag each receipt as **Regular materials** or **Client-billable** (finished materials to invoice a client), with an optional linked client job site, surfaced in the admin Receipts tab and the Google Sheet.

### Schema
Migration on `public.reimbursements`:
- `material_type text not null default 'regular'` with check (`'regular' | 'client_billable'`)
- `billable_job_site_id uuid references public.job_sites(id)` (nullable; only meaningful when `material_type = 'client_billable'`)

### Backend (`src/lib/receipts.functions.ts` / `reimbursements.functions.ts`)
- Extend `updateStandaloneReceipt` and the worker-receipt edit fn to accept `material_type` and `billable_job_site_id`.
- Validation: if `material_type = 'client_billable'`, `billable_job_site_id` must reference a non-archived `kind = 'client'` job site (regular receipts ignore the field).
- Audit log entry on changes.

### Google Sheets sync (`receipts.functions.ts`)
- Add two header columns: **Material Type** (`Regular` / `Client Billable`) and **Billable Client** (job site label, blank when regular).
- `ensureSheetHeader` appends the new columns if missing (idempotent), `syncRow` writes them, and the next **Backfill all receipts** run fills history.

### Admin UI (`src/components/admin/AdminApp.tsx` — Receipts tab)
- **Edit fields dialog**: add a segmented control `Regular | Client-billable`. When Client-billable is selected, reveal a "Bill to client" job-site picker (client sites only).
- **Row display**: small badge — neutral "Regular" or accent "Client-billable · {client label}".
- **Filters**: add a "Material" filter (All / Regular / Client-billable) alongside the existing Kind filter.
- Default on new admin receipts = Regular; picker required only when switching to Client-billable.

### Out of scope
- No worker-side UI changes (admin-only per your choice).
- No new payout math; client-billable receipts still flow through existing admin-receipt logic (excluded from worker payouts).

### Technical notes
- Migration includes `GRANT`s already in place via prior reimbursements policies; only column adds + check constraint.
- Sheet column insertion is append-only to preserve existing row references (`sheet_row_id`).
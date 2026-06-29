## Admin standalone receipts (bulk upload → AI parse → Google Sheet)

Add a way for admin to drop receipts into the system that aren't tied to a worker reimbursement — purely for record-keeping and Google Sheets sync. Supports bulk upload of multiple files at once.

### Data model
Reuse the existing `reimbursements` table to keep one source of truth for the Receipts tab + Sheet sync. Add two columns:
- `is_admin_receipt boolean not null default false` — flags rows that should never appear on worker payout cards.
- `payee_label text` — custom payee name entered at upload time (used in the "Worker" column of the sheet for these rows).

Backfill is none — new flag defaults to false.

### Server (`src/lib/reimbursements.functions.ts` + `receipts.functions.ts`)
- New `adminAddStandaloneReceipt({ token, payeeLabel, description?, amount?, weekStart?, file })` — uploads file to the `receipts` bucket, inserts a row with `worker_id = null`-equivalent (sentinel admin worker OR make `worker_id` nullable; see Technical), `is_admin_receipt = true`, `payee_label`. Fires the same background AI parse + Sheet sync used today.
- `listAllReceipts` already returns parsed fields — extend to include `is_admin_receipt` and `payee_label`, and add an `includeAdmin` / `kind` filter ('all' | 'worker' | 'admin').
- Sheet `syncRow` updated: when `is_admin_receipt`, the "Worker" column writes `payee_label` instead of the worker name. Everything else (vendor/date/total/category/job-site) is identical so all receipts live in one tab.

### Payout exclusion
- `weeklyPayout` / `lifetimePayout` / pending-week queries filter `is_admin_receipt = false` so admin receipts never affect what's owed to a worker.

### Admin UI (`ReceiptsTab` in `src/components/admin/AdminApp.tsx`)
- Toolbar gets a primary **Add receipts** button next to "Scan unparsed" / "Export CSV".
- Dialog:
  - Single **Payee** text input (applied to every file in this batch; required).
  - Optional shared **Description** and **Week** (defaults to current week).
  - **Multi-file dropzone** (drag-and-drop or click; accepts images + PDF, up to 10 at a time, 10MB each).
  - List of staged files with thumbnail/filename + remove button; per-file optional description override.
  - **Upload all** button → sequential POST per file with a progress counter; toast on completion ("Uploaded 7, parsing in background").
- Existing filter row gets a **Kind** dropdown: All / Worker / Admin (defaults to All). Each card shows a small "Admin" chip on standalone receipts, and the Worker column shows the `payee_label` for them.
- The existing Edit dialog works for both kinds; for admin receipts the worker field is replaced by an editable payee text input.

### Sheet behavior
- Same sheet, same tab, same column layout. Admin rows are visually identical to worker rows except the Worker column shows the payee name. Backfill button already exists and will pick them up.

### Out of scope
- No new tab — admin receipts live in the existing Receipts tab with a filter.
- No worker-side surface; workers never see admin receipts.
- No editing of `is_admin_receipt` after creation (rare; not worth the UI).

### Technical notes
- `reimbursements.worker_id` is currently `not null`. Migration alters it to nullable so admin receipts can omit it cleanly (alternative — a synthetic "Admin" worker row — pollutes the worker dropdowns everywhere; not preferred). All existing payout queries already join on `worker_id`, so null rows drop out naturally; the added `is_admin_receipt = false` filter is belt-and-suspenders.
- Upload uses the existing `receipts` storage bucket and the same signed-URL flow used by worker receipts so the AI vision parse path is unchanged.
- Bulk upload runs file-by-file client-side (not a single multipart server call) to keep within edge-function payload limits and to surface per-file progress/errors.

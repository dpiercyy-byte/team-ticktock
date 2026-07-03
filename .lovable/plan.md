## Goal

Enable creating an Active job directly in the Ledger app, and restrict the Sync tab's job picker to active jobs only.

## Changes

### 1. New "Create Job" server function (`src/lib/ledger.functions.ts`)
Add `createLedgerJob` that inserts a row into `public.ledger_jobs` with:
- `job_name` (required)
- `client_name`, `address` (optional)
- `start_date` (defaults to today)
- `finish_date` = null (so it counts as Active)
- Contract totals default to 0; sheet fields null.

### 2. UI: "New Job" button on Active tab (`src/routes/ledger/active.tsx`)
Add a primary "+ New Job" button in the header that opens a dialog with fields: Job Name (required), Client, Address, Start Date. On submit, calls `createLedgerJob`, invalidates the jobs query, and the new job appears in the Active list ready for a sheet link.

### 3. Sync tab picker → active-only (`src/routes/ledger/sync.tsx`)
Remove the "Closed" optgroup. Show only `activeJobs`. If the list is empty, show an inline empty state with a button/link that jumps to `/ledger/active` (where the new "+ New Job" button lives) instead of the current picker.

### 4. Copy tweak
Update the helper text on the Sync card to say "Only active jobs can be linked to a sheet. Create one under Active if none appear."

## Out of scope
No schema migration — `ledger_jobs` already has the needed columns. Closed jobs remain visible on the Closed tab and stop syncing (existing behavior).
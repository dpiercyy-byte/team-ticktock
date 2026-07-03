## Add Google Sheet URL input to the Sync tab

Right now sheet linking only appears inside an active job card. If you don't have any active jobs yet, there's nowhere to paste a URL. I'll add a linker directly on the Sync tab.

### What changes on `/ledger/sync` (admin only)

Add a new "Link a Google Sheet to a job" card above the upload card with:

- A **job picker** (dropdown) listing all jobs from Ledger, grouped:
  - Active jobs (no finish date) at the top
  - Closed jobs below, collapsed by default
  - Shows address + client name, searchable
- A **Sheet URL** text input (accepts full `docs.google.com/spreadsheets/d/...` URL or bare ID — same parser as the job card)
- **Save & Push** button — links the sheet to the selected job and immediately pushes current job data to the sheet
- **Pull now** button — pulls sheet data into the selected job
- Shows current link status and last sync time for the selected job

### Empty-state helper

If the jobs list is empty, show a hint: "Upload a spreadsheet below first, then come back here to link a Google Sheet."

### No backend changes

Reuses existing `setJobSheet`, `pushJobToSheetFn`, `pullJobFromSheetFn` server functions and the `useLedgerJobs` hook. The per-job card UI stays as-is.

### Side fix

The Sync page has an SSR hydration warning from a conditional admin-only block. I'll gate the admin/non-admin branches so both render the same shell on the server.

### Files touched

- `src/routes/ledger/sync.tsx` — add the linker card, wire to existing hooks
- `src/lib/ledger-client.ts` — add a small hook wrapping `setJobSheet` / push / pull if not already exported (verify during build)

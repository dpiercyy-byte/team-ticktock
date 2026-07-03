## What determines Active vs Closed

The parser reads cell **C3** of the spreadsheet as `finish_date`. If C3 is empty → job is Active. If C3 has a date → job is Closed. That's the only rule.

Your uploads landed in Active because C3 was blank on those workbooks, even though the filenames said "DONE". The current parser strips `DONE -` / `ACTIVE -` from the filename for the address but never uses that signal to set the finish date.

## Plan

### 1. Fix Active/Closed detection on upload

In `src/lib/ledger-xlsx.ts`:
- Detect a `DONE` / `CLOSED` / `COMPLETE` prefix in the filename before it's stripped.
- If detected AND C3 is empty, set `finish_date` to `start_date` (C2) as a fallback, or to today if C2 is also empty.

In `src/routes/ledger/sync.tsx`:
- Add a checkbox above the upload button: **"Mark uploaded jobs as closed"** (default off). When on, the client sends a flag with each upload.
- Extend `uploadLedgerJobXlsx` in `src/lib/ledger.functions.ts` to accept `markClosed?: boolean` and force `finish_date` when set.
- Add a small **"Mark closed"** action to each JobCard on the Active tab so any misclassified job can be fixed in one click (uses existing `updateLedgerJob`).

### 2. Remove Reset All Jobs

Delete the entire "Reset all jobs" card from `src/routes/ledger/sync.tsx`. Change the grid from 2 columns to a single centered upload card. Leave `resetLedgerJobs`/`useResetLedgerJobs` in place unused (harmless) or remove them — I'll remove them to keep the file clean.

### 3. Google Sheets sync (mirrors Clockwise pattern)

Reuse the existing Google Sheets connector (`GOOGLE_SHEETS_API_KEY` is already linked). Add:

**Schema** — one migration adding two columns to `app_settings`:
- `ledger_export_sheet_id text`
- `ledger_export_last_sync_at timestamptz`

**Server** — `src/lib/ledger-sheet-export.functions.ts` + `.server.ts` matching the Clockwise export shape:
- `getLedgerExportSettings` / `updateLedgerExportSettings` / `runLedgerSheetExportFn`
- Full overwrite of these tabs on every sync:
  - `Active Jobs` — address, client, start date, total price, gross cash, gross+HST, materials, subs, labor, net, margin, payments received, lead source
  - `Closed Jobs` — same columns + finish date
  - `Payments Log` — address, date, amount, method
  - `Expenses Log` — address, date, vendor, category, amount
  - `Price Log` — address, date, amount, has HST, comment
- Freeze header row, bold headers, autosize columns (reuse `formatTab` helper pattern).

**UI** — new "Google Sheets sync" card on the Sync tab (admin only), identical layout to the Clockwise settings card:
- Input for sheet URL/ID with Save
- "Sync now" button showing last sync timestamp
- Connector-ready check hidden until sheet ID is set

### Technical notes

- The DONE-filename detection: `^\s*(DONE|CLOSED|COMPLETE)\b` — case-insensitive, checked before the address is normalized.
- The sync endpoint follows the exact same gateway wrapper (`gw()`), `ensureTabsAndClear`, `writeTab`, `formatTab` helpers as `sheet-export.server.ts` — I'll factor them into a shared `sheets-gateway.server.ts` so both exports use one implementation.
- Address is used as the row key in the log tabs (not tab-per-job — that would explode).
- No changes to `ledger_jobs` schema needed for the sync itself.

### Out of scope

- Automatic scheduled sync (can add pg_cron hook later if you want).
- Two-way sync from Sheets back into Ledger.
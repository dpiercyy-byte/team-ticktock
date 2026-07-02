## Google Sheets Full Export — Nightly Sync

Export **all** worker time entries and weekly payouts to a Google Sheet, with one tab per worker per data type. First run backfills complete history automatically.

### Sheet target
- Sheet ID: `1Qxn6DRVYIIuXvoCXlHSa1fu-CThlBTyj6ipYVVEP4bY`
- Tabs created/overwritten per active worker:
  - `{Worker Name} - Time Entries`
  - `{Worker Name} - Payouts`

### Data source (accurate to app state)
- **Time Entries tab** — every row in `time_entries` for that worker:
  - Date, Clock In, Clock Out, Hours, Project, Clock-In Tag, Clock-Out Tag, Geo Status, Flagged, Entry ID
  - Hours computed live from `clock_out - clock_in`; open entries show blank hours.
- **Payouts tab** — every row in `weekly_payouts` for that worker:
  - Week Start, Hours, Wages, Reimbursements, Tips, Total Amount, Actual Paid, Paid At, Paid By, Notes
  - Uses stored `wages` value (preserves historical $35/$36/$25 rate exactly as recorded — no recalculation).

### Sync behavior
- **Full overwrite** on every run — reflects edits and deletions in the app.
- **First run = complete backfill** (Colin's 102 entries + 22 payout weeks, Edgardo's 106 entries + 24 payout weeks, plus anything added later). No separate migration step needed.
- Frozen header row, bold headers, auto-resized columns via Sheets `batchUpdate`.
- Missing tabs are created automatically; obsolete tabs (deleted worker) are left in place.

### Trigger
- **Nightly** at 1:00 AM ET via `pg_cron` → `POST /api/public/hooks/sheet-export`.
- **Manual "Sync to Sheets now"** button in Admin → Settings for on-demand runs (used for the initial backfill).
- Endpoint secured via `apikey` header (Supabase anon key), same pattern as existing `auto-clockout` hook.

### Admin UI (Settings tab)
- New "Worker Data Export" card:
  - Sheet ID field (defaults to the one above, editable)
  - "Sync now" button with toast + last-sync timestamp
  - Link out to the sheet

### Technical
- New file: `src/routes/api/public/hooks/sheet-export.ts`
- New helper: `src/lib/sheet-export.server.ts` — builds tab data, calls Google Sheets `values.update` + `batchUpdate` via existing `google_sheets` connector gateway
- New server fn: `src/lib/sheet-export.functions.ts` — `runSheetExport()` wrapped with `requireSupabaseAuth` + admin check
- New settings columns on `app_settings`: `worker_export_sheet_id`, `worker_export_last_sync_at`
- pg_cron entry: `0 5 * * *` UTC (= 1 AM ET during EDT; acceptable 1hr drift in EST)

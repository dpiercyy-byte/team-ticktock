# Fix: jobs missing from the Today tab

## What's happening

All 6 of your jobs were created by the "ongoing" Google Sheets importer, and it saved their status as lowercase `active` instead of `Active` (the value the rest of Ledger uses).

- The **Jobs** tab defaults to "All", so it shows everything regardless of status — that's why they appear there.
- The **Today** tab only lists jobs whose status is exactly `Active` or `Scheduled`, so the lowercase rows are filtered out and you get "No active jobs yet".

## The fix

1. Correct the existing rows: set status to `Active` for the imported jobs currently stored as `active` (same for any other case-mismatched values).
2. Fix the importer so newly discovered sheet jobs are written with the canonical status (`Active`) instead of a lowercase one.
3. Make the Today tab's status check case-insensitive, so a stray casing never hides a job again. The status filter pills in Jobs get the same tolerance.

Also fixing a small unrelated crash noticed in the preview: signing out during server rendering touches browser-only storage and errors — that helper gets a browser guard.

## Technical notes

- Data repair: one-off SQL update on `ledger_jobs`.
- `src/lib/sheet-jobs.server.ts` — normalize `status` when creating/updating projects from sheets.
- `src/routes/ledger.index.tsx` — compare statuses lowercased.
- `src/lib/session.ts` — `clearAdminToken()` needs a `typeof window` guard.

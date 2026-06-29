## Root cause

Your Google Sheet only has a `Sheet1` tab, but the sync code is configured to write to a tab named `Receipts` (the default). Every Sheets API call (`ensureSheetHeader`, `PUT`, `append`) returns an HTTP error because that tab doesn't exist — but the code uses `fetch` without checking `res.ok`, so nothing throws. `backfillSheet` then counts each row as "synced" and the UI happily reports success while zero rows actually land in the sheet.

A confirming probe: `GET /spreadsheets/.../` lists only `['Sheet1']` for your spreadsheet, while `app_settings.google_sheet_tab = 'Receipts'`.

## Fix plan (all in `src/lib/receipts.functions.ts`)

1. **Auto-create the target tab if it doesn't exist.**
   In `ensureSheetHeader`, first call `GET /spreadsheets/{id}?fields=sheets.properties.title`. If the configured `tab` is not in the list, send a `POST /spreadsheets/{id}:batchUpdate` with an `addSheet` request to create it, then proceed to write the header row.

2. **Make every gateway call throw on non-OK.**
   Add a small `gw(url, init)` helper that does `fetch` + `if (!res.ok) throw new Error(...)` and use it in `ensureSheetHeader`, the find/update/append calls, and `batchUpdate`. This ensures real failures bubble up instead of being silently swallowed.

3. **Treat "skipped" distinctly in backfill.**
   `syncRow` already returns `{ skipped: true }` when sync is disabled or no sheet ID; have `backfillSheet` count `skipped`, `synced`, and `failed` separately and return all three so the toast can show the truth.

4. **Surface errors in the Settings UI.**
   Update the backfill button handler in `AdminApp.tsx` to display `synced / failed / skipped` (and the first failure message) in the toast so a misconfiguration is visible immediately.

## What you'll see after the fix

- Clicking "Backfill all receipts" will create the `Receipts` tab if missing, write the header, and append your 2 receipts.
- If anything still fails (bad sheet ID, revoked Google connector, etc.), the toast will say `failed: N` with the underlying message instead of a false success.

## Optional follow-up (not in this change)

Add a tab picker in Settings that lists existing tabs from the spreadsheet so you can choose `Sheet1` instead of auto-creating `Receipts`. Say the word and I'll add it.

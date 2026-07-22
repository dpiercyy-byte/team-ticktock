## Problem

`16 Ostick St` shows "synced" but every value is `$0` and every log is empty.

Root cause: `looksLikeMasterSheet` in `src/lib/ledger-sheet-import.server.ts` only inspects `rows[6]` for the block header row (PAYMENTS / EXPENSES / PRICE / REIMBURSE). In the actual master-copy sheet, row 7 is a blank spacer and the block headers are on row 8 (index 7). Detection returns `false`, so `pullJobFromSheet` falls back to the legacy 4-tab parser, finds no `Summary`/`Payments`/`Expenses` tabs, writes zeros for every field, then stamps `sheet_last_sync_at` — which is what makes the UI claim it synced successfully.

`parseMasterSheet` also hard-codes `DATA_START = 9`, which is right for this sheet but will drift if the header row moves by one.

## Fix

Make the parser locate the block-header row dynamically instead of assuming a fixed index.

1. `looksLikeMasterSheet(rows)` — scan rows 4-12 (0-indexed) for a row whose upper-cased join contains all of `PAYMENTS`, `EXPENSES`, `PRICE`. Return `true` when found. (Drop `REIMBURSE` from the required set — some older master copies omit that block.)
2. Add a helper `findBlockHeaderRow(rows)` returning that row index, or `-1`.
3. In `parseMasterSheet`:
   - Call `findBlockHeaderRow`; if `-1`, return `null`.
   - Set `DATA_START = blockHeaderRow + 2` (block header + sub-header + first data row).
   - Keep the existing label-based lookup for `Client Name`, `Start Date`, `Finish Date`, `Total Revenue` so the summary block also tolerates row shifts.

No changes to `pullJobFromSheet`, no schema changes, no UI changes.

## Verification

After the fix, re-pull `16 Ostick St` (per-job Pull button on the card). Expected result against the sheet you have open:

- `total_price` = 12500, `finish_materials` ≈ 1146.92, `building_materials` ≈ 1901.27, `subs` = 1200, `labor` ≈ 5997.52, `net` ≈ 1864.41
- `payments_log` = 3 entries (5000 / 5000 / 2500)
- `expense_log` ≈ 20+ entries across FM/BM/Subs/Labor
- `price_log` = 4 entries
- `reimburse_log` = 4 entries

I'll confirm the row counts with a `SELECT` on `ledger_jobs` after the pull.

## Technical notes

- Purely a parser fix in `src/lib/ledger-sheet-import.server.ts`. Legacy fallback path is left intact for any sheet that genuinely uses the old 4-tab layout.
- `sheet_last_sync_at` will only be stamped after a successful parse-and-write, same as today — the misleading "synced" badge on a zero-data pull is exactly what this fixes going forward, because the master-copy branch will now succeed.
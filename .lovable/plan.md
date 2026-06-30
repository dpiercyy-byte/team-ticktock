## Goal
When an admin deletes a receipt, also remove its row from the synced Google Sheet so the sheet stays consistent and has no blank gap.

## Changes

### 1. `src/lib/receipts.functions.ts` — add `deleteSheetRowExternal(reimbursementId)`
- Reuses existing `gw` helper and `app_settings` lookup.
- No-op if sync disabled or no sheet configured.
- Fetch the spreadsheet metadata to resolve the Receipts tab's numeric `sheetId` (needed for `deleteDimension`).
- Read column A of the tab, find the row whose value equals the reimbursement id.
- If found, call `spreadsheets:batchUpdate` with a `deleteDimension` request (`dimension: "ROWS"`, `startIndex: rowIdx-1`, `endIndex: rowIdx`). This deletes the entire row so rows below shift up — no blank gap left behind.
- Swallow/log errors so a sheet outage never blocks the DB delete.

### 2. `src/lib/reimbursements.functions.ts` — call it from `deleteReimbursement`
- Before (or right after) the DB delete, dynamically import `deleteSheetRowExternal` and await it inside a try/catch (mirroring the existing `syncRowExternal` pattern in `updateStandaloneReceipt`).
- Best-effort: a sheet failure logs an error but the DB row + storage file are still removed and the admin still sees a success toast.

### 3. No UI changes required
The existing confirm-delete dialog already triggers `deleteReimbursement`; behavior just becomes "delete locally + delete from sheet."

## Notes / edge cases
- Receipts created before sync was enabled (no row in the sheet) → lookup returns nothing, function exits cleanly.
- If the user later renames the tab, the lookup misses → logged, DB delete still proceeds.
- Worker-side deletes (`workerDeleteReimbursement`) are out of scope for this change unless you want them included too — let me know and I'll add the same call there.
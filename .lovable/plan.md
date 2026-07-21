
## Goal

Make Google Sheets a one-way source of truth for Ledger jobs. Ledger reads from your existing per-job master-copy sheets; it never writes back. Clockwise's separate receipts→Sheets export is untouched.

## Scope confirmation

- **Push kill = Ledger jobs only.** `ledger-sheet-export.server.ts` (`pushJobToSheet`) and its callers.
- **Not affected:** `src/lib/sheet-export.server.ts` + `sheet-export.functions.ts` (Clockwise receipts CSV/Sheets export) and the receipts nightly export webhook. No risk of double/triple expense entries in your master sheets from that path.

## 1. Disable Ledger → Sheets writes

- Neutralize `pushJobToSheet` so it becomes a no-op (returns `{ disabled: true }`) rather than deleting it — keeps types stable.
- Remove all callers:
  - `pushJobToSheetFn` server fn: return `{ disabled: true }`.
  - The auto-push in `updateLedgerJob` (`ledger.functions.ts`) when a sheet-linked job changes — remove.
  - The `sheet-export` public hook path if it triggers Ledger push (leave Clockwise receipts export intact).
- UI: hide the "Push to Sheet" button on `JobCard` / `EditJobDialog`. Keep "Pull from Sheet" and "Link/Unlink Sheet".
- Sheet-linked jobs stay read-only for content fields (already enforced in `updateLedgerJob`) — behavior unchanged.

## 2. Parse your master-copy sheet layout on pull

Your sheets aren't the 4-tab `Summary/Payments/Expenses/Price Log` layout the current code writes — they're a single `Sheet1` with a fixed grid:

```text
Row 1:  Client Name(s):        | Roslyn Goldmintz
Row 2:  Start Date:            | ...              | Payments Owing: | X   | Estimated Profit: | Y
Row 3:  Finish Date:           | ...              | Profit Margin:  | %
Row 5:  Total Revenue          |                  | Finish Materials| Building Materials | Subs | Labor |   | Net Profit
Row 6:  <values>
Row 7:  header block: PAYMENTS (B–D) | EXPENSES (E–I) | PRICE (K–M) | REIMBURSE (N–P)
Row 9:  sub-headers per block
Row 10+: data rows
```

Rewrite `pullJobFromSheet` to read this layout:

- Read `Sheet1!A1:P200` in one call.
- **Summary** (fixed cells): client name (C1), start (C2), finish (C3), total revenue (B6), finish materials (E6), building materials (F6), subs (G6), labor (H6), payments owing (F2), estimated profit (J2), profit margin (F3). Map to `client_name`, `start_date`, `finish_date`, `total_price` (Total Revenue), `finish_materials`, `building_materials`, `subs`, `labor`, `payments_received` (= total − owing), `net`, `profit_margin`.
- **Payments log** (B10:D, until blank row before totals row): `{ amount: B, method: C, date: D }`.
- **Expenses log** (E10:I, until blank): map into `expense_log` entries with `category` inferred from which column has the value (Finish Materials E / Building F / Subs G / Labor H) and `comment`+`date` from I,J. Because your sheet splits expenses by category column, we'll store each row as `{ date, amount, category, comment }` in `expense_log`.
- **Price log** (K10:M): `{ amount: K, comment: L, date: M }` → `price_log`.
- **Reimburse** (N10:P): parse into `payments_log` as a separate `type: "reimburse"` tag, or a new `reimburse_log` JSONB column (see Technical section).
- Stop parsing each block when it hits the totals row (green totals in row 28 of your example) — detect by first-empty row after data starts.
- Auto-detect tab: if `Sheet1` is missing, fall back to the first tab returned by `sheets.properties`. Handle sheets whose users renamed the tab.
- Keep the existing 4-tab parser as a fallback if `Sheet1` doesn't have the expected labels in column A (backwards compatible for sheets Ledger previously created).

Nightly cron (`pullAllActiveJobs`) stays as-is and picks up the new parser automatically.

## 3. Home screen: recent Sheets

New `/ledger` landing view (or a section at the top of `/ledger/active`):

- "Open from Google Sheets" card grid of the user's recent spreadsheets.
- Fetch via the Google Drive connector: `GET /drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&orderBy=viewedByMeTime desc&pageSize=12&fields=files(id,name,modifiedTime,iconLink,webViewLink)`.
- Server fn `listRecentLedgerSheets({ token })` (admin-only). Returns id, name, modifiedTime, thumbnail-ish icon.
- Clicking a card:
  - If a `ledger_jobs` row already has this `sheet_id`, navigate straight to its 4-tab job view (`EditJobDialog` / job detail).
  - Otherwise create a new `ledger_jobs` row with `sheet_id` set + trigger a pull immediately, then open it. Address/client fill in from the sheet on pull.
- Requires the Google Drive App Connector. If not linked, the section shows a "Connect Google Drive" CTA that calls `standard_connectors--connect` for `google_drive`.

## 4. Pull cadence

Unchanged. Nightly `pullAllActiveJobs` stays on; per-job "Pull now" button in `JobCard` stays.

## Out of scope (explicitly)

- Receipts → Ledger `expense_log` auto-sync (rejected previously).
- Any writes back to your master sheets.
- Changing the Clockwise receipts export pipeline.

---

## Technical notes

- New file: `src/lib/ledger-sheet-import.server.ts` with `parseMasterSheet(values: string[][])` → the shape returned to `pullJobFromSheet`. Unit-testable pure function; feed it your uploaded sheet as a fixture.
- `pullJobFromSheet` becomes: read `Sheet1!A1:P200` → if row 7 contains "PAYMENTS"/"EXPENSES"/"PRICE" → call `parseMasterSheet`; else fall back to legacy 4-tab parser.
- Reimbursements column: add a new JSONB column `reimburse_log` to `ledger_jobs` via a migration (nullable, default `[]`). Alternative is to shove them into `expense_log` with `category: "reimburse"`, but a separate column matches your sheet's mental model. Confirm which you prefer before the migration.
- `pushJobToSheet` neutered but kept exported so `ledger-sheet-export.functions.ts`, cron hooks, and any stale imports don't break.
- `listRecentLedgerSheets` uses `google_drive` connector via gateway `https://connector-gateway.lovable.dev/google_drive/drive/v3/files`. Requires linking that connector; separate from the existing `google_sheets` connector.
- No changes to Clockwise↔Ledger job-site sync or labor auto-compute.
- No schema change to `ledger_jobs` other than optional `reimburse_log jsonb default '[]'`.

## Open question before build

Reimbursements column: separate `reimburse_log` JSONB (recommended) or fold into `expense_log` with `category: "reimburse"`?

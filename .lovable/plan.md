
## Goal

Replace Sheetify by parsing every receipt in-app and (optionally) mirroring the parsed rows into one Google Sheet you own.

## What changes for you

- Workers (and you) upload receipts the same way they do today.
- Each receipt is **auto-parsed on upload** using Lovable AI vision. Extracted fields: vendor, date, subtotal, tax, total, suggested category, suggested job site.
- In the admin **Receipts** sub-tab, each card gains the parsed fields inline + an **Edit** dialog to correct anything the AI got wrong and a **Re-run AI** button.
- A new **Spreadsheet view** toggle on the Receipts tab shows everything as an editable table (sortable/filterable by worker, week, vendor, category, job site) with a single **Export CSV** action — this is the Sheetify replacement.
- A **Settings → Google Sheets sync** section lets you connect your Google account once and pick (or auto-create) a destination Sheet. From then on, every new/edited parsed receipt is appended/updated as a row in that Sheet automatically. A **Backfill to Sheet** button pushes historical rows.

## Data model

Add columns to `public.reimbursements`:
- `parsed_vendor text`
- `parsed_date date`
- `parsed_subtotal numeric`
- `parsed_tax numeric`
- `parsed_total numeric`
- `parsed_category text`
- `parsed_job_site_id uuid` (nullable, references job_sites)
- `parse_status text` (`pending` | `ok` | `failed` | `manual`)
- `parse_confidence numeric`
- `parse_raw jsonb` (full AI response for audit/debug)
- `parsed_at timestamptz`
- `sheet_row_id text` (Google Sheets row identifier for upserts)

Add `public.app_settings` columns:
- `google_sheet_id text`
- `google_sheet_tab text`
- `google_refresh_token text` (encrypted server-side use only)
- `sheet_sync_enabled boolean default false`

All writes go through existing append-only audit log.

## AI extraction

- Model: `google/gemini-3-flash-preview` (vision, cheap, fast) via Lovable AI Gateway. Structured-output JSON schema for the 7 fields + confidence.
- Server fn `parseReceipt(reimbursementId)` in `src/lib/receipts.functions.ts`:
  - Fetches receipt URL, sends image (or first PDF page) to model.
  - Writes parsed fields + `parse_status`, logs to audit, triggers sheet sync if enabled.
- Triggered automatically by `workerUploadReceipt` and admin upload paths after the row is inserted (fire-and-forget; UI shows `pending` then updates).
- Manual **Re-run AI** button calls the same fn.
- Category suggestion uses a short fixed list (Materials, Fuel, Tools, Subcontractor, Permits, Other) — editable.
- Job site suggestion: AI gets the list of active job site labels and picks the closest match by vendor address proximity / explicit mention; falls back to null.

## Google Sheets sync (optional, your account only)

- New "Google Sheets" connector linked via existing connector flow — you authorize once in Settings.
- Server fn `syncReceiptToSheet(reimbursementId)`:
  - Uses connector gateway (`/google_sheets/v4`) to append or update the row keyed by `sheet_row_id`.
  - Row columns: Date, Worker, Vendor, Description, Category, Job Site, Subtotal, Tax, Total, Receipt URL, Week Start.
- Called automatically after successful parse / manual edit.
- Settings panel:
  - Connect Google button
  - Sheet picker (existing sheet by ID/URL, or "Create new")
  - Tab name field
  - Enable/disable sync toggle
  - **Backfill** button (queues sync for every existing receipt)
- If sync fails, row stays in DB with `sheet_row_id = null`; a "Retry sync" button surfaces in the receipt card.

## Admin UI

`ReceiptsTab` updates:
- Each card shows badge: `Parsing…` / `Parsed` / `Failed` / `Edited`.
- Card body shows vendor, date, total, tax, category chip, job-site chip.
- Buttons: **Edit fields**, **Re-run AI**, existing View/Download/Open.
- Top toolbar: filter by category + job site (new), view toggle **Cards | Table**.
- Table view: dense spreadsheet UI with inline edit; CSV export uses the current filter set.

New `ReceiptSyncSettings` panel under Settings tab.

## Worker UI

No visible change beyond a subtle "Receipt being scanned…" line on a freshly added reimbursement (optional polish).

## Technical notes

- Parsing runs server-side in a `createServerFn`; uses `requireSupabaseAuth` for admin manual triggers and a token-scoped variant for worker upload trigger (already how other worker fns auth).
- PDF receipts: convert first page to image server-side before sending to model (pdf-lib + canvas not Worker-safe → use the model's PDF input support: send as `file` block with `application/pdf` MIME — Gemini supports PDF input directly, so no conversion needed).
- Google Sheets: prefer the App connector + `standard_connectors--connect` for `google_sheets`. Single workspace-wide connection matches your "just my account" choice. If user prefers per-account OAuth later, swap to per-user OAuth.
- Failures (429/402) surface as toast + retry; never block clock-in/out flow.
- All new tables/columns get GRANTs + RLS deny-all (admin-only via server fns).

## Out of scope (for this round)

- Line-item extraction (you didn't pick it).
- Multi-admin Google connections.
- Auto-categorization training/feedback loop.

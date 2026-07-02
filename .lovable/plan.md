# Backfill historical time & reimbursements for Colin and Edgardo

## Sources
- **Colin** — `docs.google.com/spreadsheets/d/1iLUK5q3y0l3Rv7Vw2JpyNXRbNbRzk5kpxtcPVVIDuO0` (tab `Sheet1`)
- **Edgardo** — `docs.google.com/spreadsheets/d/1LU0kshS_K3HkoVjwePEdfPePxgke14n3JuwWwIl970c` (tab `Sheet1`, workbook titled `Jr`)

Both sheets share a repeating month block:

```text
Row  Content
1    Month name │ Week 1 │ Week 2 │ Week 3 │ Week 4 │ Week 5 │ MATs │ Gas
2    Date       │ <Mon-of-week dates...>
3-9  Mon..Sun   │ daily $ amount (or "off"/blank)
10   Total weekly hours │ ... │ (col 9 = Gas total)
11   Pay        │ weekly $ totals │ MATs total │ Gas total │ month grand total
12   Paid Date  │ per-week paid dates (Mon dd)
13   (blank separator)
```

## Conversion rules
- **Hours per day** = `daily_dollars / rate`, where `rate = 35` if the week's Monday date is before **2026-03-01**, else `36`.
- Ignore `"off"`, blank, or non-numeric cells.
- **Year inference**: sheet has no year column. Walk months top-to-bottom starting at **2026-01** (Jan header appears first with Jan 5 = 2026-01-05, a Monday — matches). Increment year when month sequence wraps past December.
- **Synthetic clock times** (America/Toronto): `clock_in = <date> 08:00`, `clock_out = clock_in + hours` (no lunch gap). Stored as UTC ISO.
- **Weeks**: derive Monday-of-week from the row-2 date (e.g. `Jan 5` → `2026-01-05`).

## Time entries to insert
Per valid day cell → one row in `public.time_entries`:
- `worker_id` = Colin's or Edgardo's UUID
- `clock_in`, `clock_out` as above
- `created_by = 'admin'`
- `geo_status = 'no_gps'`, `clock_out_geo_status = 'no_gps'`
- `project = null`, `job_site_id = null`
- `flagged_review = false` (14h cap never hit)

**Overlap handling**: before insert, query existing `time_entries` for that worker on that calendar day; skip if any overlap. Report a per-worker skipped count at the end.

## Reimbursements to insert
For each week where **MATs** (row 11 col 7) > 0 → one row in `public.reimbursements`:
- `worker_id`, `amount = MATs total`, `description = "Materials (historical import — <Month> Week N)"`
- `week_start = Monday-of-week`, `material_type = 'regular'`
- `uploaded_by_admin = true`, `is_admin_receipt = false`, `receipt_url = null`

Same shape for **Gas** (row 11 col 8) > 0 with `description = "Gas (historical import — <Month> Week N)"`.

Skip zero/blank. No receipt image, no AI parse, no Sheets sync.

## Weekly payout rows
Not created. The Payout tab will compute wages/reimbursements from the inserted time entries + reimbursements automatically. `weekly_payouts` marks *paid* status only, which historical data doesn't need.

## Audit
One `audit_log` row per insert, `actor_kind = 'admin'`, `action = 'entry_create'` / `'reimbursement_create'`, `metadata = { source: 'historical_backfill', sheet_id, month, week }`.

## Execution
1. Read both sheets via the Google Sheets connector (whole `A1:Z1000` range each).
2. Parse into `{worker, date, hours, dollars}` and `{worker, week_start, mats, gas}` in a one-off Python script.
3. Emit two batched SQL scripts (one INSERT per entry / reimbursement, one audit row each) via the `supabase--insert` tool.
4. After insert, run `SELECT count(*)` + weekly sums for both workers and report totals vs. the sheets' own "Pay" grand totals so you can spot-check.

## What I will NOT change
- No schema migrations.
- No edits to existing entries or reimbursements.
- No changes to `weekly_payouts` (paid-status stays as it is today).
- No UI code touched.

## Confirm before I run
- Colin's UUID `d4639363-65cd-49e1-a3ae-d121aeefc346`, Edgardo's UUID `36ccb19c-6849-46cb-b5f9-2f37cd385617`.
- Start year = **2026** (Jan 5 = Monday in 2026, matches sheet).
- Rate switch date = **2026-03-01**.

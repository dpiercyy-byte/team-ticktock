# Backfill Andrew's last week (Aug 16–22)

Data-only entry. No app code changes, no Google Sheets sync.

## Time entries — 420 Brookdale Ave

44.25 h split evenly across Mon–Fri = 8.85 h/day (8 h 51 m), all stamped to the
420 Brookdale Ave job site, marked as admin-created and on-site.

```text
Mon Aug 17   8:00 AM – 4:51 PM   8.85 h
Tue Aug 18   8:00 AM – 4:51 PM   8.85 h
Wed Aug 19   8:00 AM – 4:51 PM   8.85 h
Thu Aug 20   8:00 AM – 4:51 PM   8.85 h
Fri Aug 21   8:00 AM – 4:51 PM   8.85 h
```

Andrew currently has no entries in that week, so nothing is overwritten.

## Receipt

Home Depot (90 Billy Bishop Way), Aug 18 2026, total $122.47 — uploaded to the
receipts store and attached to Andrew for week starting Aug 16, costed to
420 Brookdale Ave as a regular (non-billable) material.

## Mark the week paid

- Week: Aug 16 2026
- Hours 44.25 · wages $1,327.50 · receipt $122.47 · owed $1,449.97
- Actually paid: $1,450.00 (tip $0.03), paid by Dylan
- Written directly to the payout record, bypassing the Cash Tracking sheet
  export so nothing is duplicated in your manual entry.

## Technical notes

- Insert 5 rows into `time_entries` (worker Andrew, `job_site_id` = 420
  Brookdale, `created_by` = admin, `geo_status` = onsite), times in Toronto
  local converted to UTC.
- Upload the receipt image to the `receipts` bucket, insert a `reimbursements`
  row with the parsed vendor/date/subtotal/tax/total from the image,
  `material_type` = regular, `billable_job_site_id` = 420 Brookdale,
  `parse_status` = manual.
- Insert the `weekly_payouts` row by direct data write rather than calling
  `markWeekPaid`, which is what triggers the sheet export.

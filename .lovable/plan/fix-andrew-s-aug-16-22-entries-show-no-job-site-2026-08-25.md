# Fix: Andrew's Aug 16–22 entries show no job site

## What's actually wrong

The entries do have 420 Brookdale Ave attached — the site link and the day totals are correct in the database. The problem is the status word saved on those five rows.

When I backfilled Andrew's week, the location status was written as `onsite`. Everywhere else in the app the valid words are `verified`, `callback`, `supplier`, `off_site`, `no_gps`. Since `onsite` matches none of them, the Entries tab falls through to its "Set tag" placeholder instead of showing the green "420 Brookdale Ave" pill.

Confirmed: exactly 5 rows use `onsite` (both clock-in and clock-out) — Andrew's Aug 17–21 backfill. Every other row in the system uses a valid word.

## The fix

1. Correct the five rows: change `onsite` to `verified` on both the clock-in and clock-out status for Andrew's Aug 17–21 entries. Their Brookdale site link stays as-is, so the pill will render green immediately.
2. Add a small safety net so a bad status word can never silently hide a site again: where an entry has a job site attached but an unrecognized status, treat it as verified and show the site pill rather than "Set tag".

## Technical notes

- Data change on `public.time_entries`: `geo_status` and `clock_out_geo_status` `'onsite'` → `'verified'` (5 rows, worker Andrew, week of Aug 16).
- UI change in `src/components/admin/AdminApp.tsx` (`GeoTagPicker`): normalize the incoming status — map unknown values with a linked site to `verified` before choosing which badge to render.
- No changes to hours, pay, payout records, or the Sheets export.

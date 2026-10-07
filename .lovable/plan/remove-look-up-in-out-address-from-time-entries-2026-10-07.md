# Remove "Look up in/out address" from time entries

## What's happening
The address lookup links added under each shift's GPS pills convert the recorded GPS pin into a street address on tap. You don't want them — the In/Out pills showing the site tag (green / Off-site / No GPS) stay exactly as they are.

## Changes
1. **src/components/admin/AdminApp.tsx**
   - Remove the `EntryAddressLine` component (~line 5926) and its single usage on the entry row (~line 1057).
   - Remove the `adminLookupEntryAddress` import.
2. **src/lib/entries.functions.ts**
   - Remove the `adminLookupEntryAddress` server function (~lines 648–688).
3. **src/lib/geocode.server.ts**
   - Remove the now-unused `reverseGeocode` helper (forward geocoding for job sites stays untouched).

## Not changing
- The database columns (`clock_in_address` / `clock_out_address`) stay — no destructive migration; they're simply never written or read again.
- GPS pills, the tap-to-fix tag editor, and the geofence audit block are untouched.

## Verification
- Typecheck and build pass.
- Confirm no references to the removed function/component remain.

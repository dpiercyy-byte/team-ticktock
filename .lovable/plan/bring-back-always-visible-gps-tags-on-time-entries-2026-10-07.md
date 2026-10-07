# Bring back always-visible GPS tags on time entries

## What you see today

The GPS tags (the pill showing which job site a clock-in/out matched, or "Off-site" / "No GPS") used to sit directly on each entry row. A recent change moved them behind the "…" menu under "Show GPS tags", so they're hidden until you dig for them.

## What changes

1. **GPS tags back on the row.** Each entry in Entries shows its "In:" and "Out:" GPS pills right under the times again — e.g. `In: Maple Ave` (green when matched to a site), `Out: Off-site` (amber), `No GPS` (grey). Tapping a pill still opens the same editor to fix the tag. The "Show GPS tags" item in the "…" menu goes away since there's nothing to hide.

2. **Street addresses on demand.** The app stores GPS coordinates but has never turned them into street addresses. New: inside the GPS section of an entry, a "Look up address" button converts the clock-in/out coordinates into a street address (via the Google Maps service). The result is saved on the entry, so it shows instantly from then on and never gets looked up twice. If the worker's phone had no GPS fix, it says so instead.

## Technical notes

- `src/components/admin/AdminApp.tsx`: render the two `GeoTagEditor` pills inline on the entry row (like the pre-change layout); remove the `openGps` toggle state and the "Show GPS tags" dropdown item; the expanded GPS audit section stays available only where it adds the address line.
- Migration: add `clock_in_address text` and `clock_out_address text` (nullable) to `time_entries`. No RLS change needed (table already deny-all, accessed via server functions).
- `src/lib/geocode.server.ts`: add `reverseGeocode(lat, lng)` using the existing Google Maps connector gateway (`/maps/api/geocode/json?latlng=...`).
- `src/lib/entries.functions.ts`: new `adminLookupEntryAddress(entryId, which)` — admin-token authenticated, reads stored coordinates, skips the lookup if an address is already saved, otherwise reverse-geocodes and saves it; returns the address.
- No change to worker experience, passive site tracking, payroll, or exports.

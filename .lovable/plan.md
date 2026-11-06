# Fix "can't find address" when adding a job site

## What's happening
Google is answering every lookup (no outage, no key problem), but for your address it replies "no match". This likely isn't new: before yesterday's fix, the app hid this failure and showed "Job site added" anyway. That's why nothing has saved since Oct 21.

## Changes
1. **Smarter lookup.** If the first search finds nothing, try again with "Ontario, Canada" added, and tell Google to favour Canadian results. Short addresses like "99 Castlewood" should then work.
2. **Clear message.** Say why it failed, e.g. "Google couldn't find '99 Castlewood' — add the city or postal code", not a vague error.
3. **Save anyway option.** If it still can't be found, offer "Save without GPS". The site gets saved with no location. Geofence tagging won't work for that site until you edit the address.
4. **Log Google's exact reply** so any future failure is easy to diagnose.

## Technical details
- `src/lib/geocode.server.ts`: add `region=ca` and `components=country:CA`. On `ZERO_RESULTS`, retry once with `, ON, Canada`. Log `json.status`/`error_message`. Return a typed not-found error.
- `src/lib/jobsites.functions.ts`: add an optional `skipGeocode` flag to create/update so lat/lng can be saved as null (check the column is nullable first; add a migration if it isn't).
- Job site dialog in `AdminApp.tsx`: on not-found, show the message plus a "Save without GPS" button.

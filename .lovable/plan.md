# Geo-Verification + Frictionless Job Site Setup

## Admin: dead-simple job site input

Single field with **Google Places address autocomplete**. Admin starts typing "123 Oak St…", picks the suggestion, done. We auto-capture:
- Display name (the address, editable to a friendly label like "Smith Reno")
- Latitude / longitude (no manual coordinate entry, ever)
- Radius (default 100m, slider 50–500m)

New **Job Sites** tab in admin dashboard with a list + "Add Site" button. Each site shows address, radius, and a delete button. That's the whole admin UX — no maps to drag, no pins to drop.

## Worker: invisible geo-verification

On Clock In / Clock Out tap:
1. Browser requests GPS (one-time permission, cached by browser)
2. Capture lat/lng with ~10s timeout
3. Server matches to nearest job site within its radius
4. Stamp the time entry with the matched site (or `null` + flagged "Off-site" if no match, or `null` + flagged "No GPS" if permission denied/timeout)

Worker sees a tiny line under the clock button: "📍 Verified at Oak St" or "📍 Off-site" or "📍 Location unavailable" — informational only. **Never blocks clocking in.** Admin reviews flags.

## Admin: visibility on entries

Entries tab gains two small badges per row:
- ✅ Site name (verified at a known site)
- ⚠️ "Off-site" or "No GPS" (flagged for review)

CSV export includes site name + lat/lng columns.

## Technical details

- **Connector**: Google Maps Platform (Places API New for autocomplete, all via gateway — no exposed keys).
- **New table** `job_sites`: id, label, address, lat, lng, radius_m, created_at. RLS deny-all; accessed only via server fns with admin token.
- **Schema additions** to `time_entries`: `clock_in_lat`, `clock_in_lng`, `clock_out_lat`, `clock_out_lng`, `job_site_id` (nullable FK), `geo_status` ('verified' | 'off_site' | 'no_gps').
- **Server fns**: `listJobSites`, `addJobSite` (geocodes via gateway), `deleteJobSite`, plus updates to existing `clockIn` / `clockOut` to accept lat/lng and resolve nearest site via Haversine in SQL.
- **Worker UI**: wrap existing clock toggle to request `navigator.geolocation.getCurrentPosition` before calling server fn; 10s timeout; pass coords (or nulls) through.
- **Admin UI**: new "Job Sites" tab; Places autocomplete uses `PlaceAutocompleteElement` with the browser key.

## Out of scope (per earlier discussion)

- No background tracking / passive geofence (web app limitation).
- No map UI for drawing fences — address + radius only.
- No blocking workers from clocking in off-site (admin reviews flags instead).

## What I need from you

1. Confirm I should connect the Google Maps Platform connector (managed key, no setup on your side).
2. Confirm default radius of **100m** is right, or pick another default.

# Splitting a Worker's Day Across Two Job Sites

## The problem

Right now a shift is one record with a clock-in tag and a clock-out tag. Any project that matches *either* tag gets charged the **full** shift, so a worker who starts at Job A and finishes at Job B makes both projects look like they paid for a whole day. Labour cost on the Financials tab is inflated on both sides and there is no record of how long they were at each place.

## The fix: segments inside a shift

A shift becomes a container of one or more **segments**, each with its own start, end, and site tag. Hours are charged per segment, so a day can read "3.2 h at 14 Elm, 4.6 h at 88 Bay". Payroll totals stay identical — only the allocation changes.

### 1. "Switch site" on the worker card

While clocked in, the worker sees a **Switch site** button next to Clock out. Tapping it:
- takes a GPS reading, closes the current segment at that moment, and opens a new one tagged to the site they're standing at (same verified / callback / supplier / off-site pill logic used today),
- lets them pick the site manually if GPS is weak or they're off-site,
- shows a small "today so far" strip: each site and the time logged at it.

Clock out closes whichever segment is open. Nothing changes for the common single-site day.

### 2. Automatic prompt when GPS says they moved

While the app is open and a shift is running, the app checks location periodically. If the worker is inside a different job site's geofence than their current segment for a couple of consecutive checks, a sheet appears: **"Looks like you're at 88 Bay Street. Switch?" → Switch / Stay put**. Switching runs the same action as the button, back-timed to when the move was first detected. Dismissing it suppresses the prompt for that site for the rest of the shift. This is a helper, not a requirement — iPhones don't allow reliable tracking with the app closed, so the button remains the source of truth.

### 3. When they forget

If a shift ends with a single segment but the clock-in and clock-out tags point at two different client sites, the hours are **split 50/50** between them and the entry is **flagged for review**. Admin sees a "Needs allocation" marker in Entries; opening the entry shows the two sites with editable hour boxes (defaulting to the 50/50 split) that must sum to the shift length. Fixing it clears the flag and writes an audit-log record.

### 4. Everywhere hours are counted

- Project Financials / Job Workspace labour now sums **segment hours matched to that project**, not the whole entry.
- Payouts, weekly totals, and CSV exports keep using total shift hours — unchanged pay.
- Entry rows in the admin table show a per-site breakdown when a shift has more than one segment.
- Existing entries keep their current behaviour (all hours to the clock-in site); no backfill.

## Technical notes

- New table `public.time_entry_segments` (`entry_id`, `started_at`, `ended_at`, `job_site_id`, `geo_status`, `source: 'clock_in' | 'switch' | 'auto_split' | 'admin'`, lat/lng), deny-all RLS + grants, `updated_at` trigger, audit-log entries on admin edits.
- `clockIn` writes segment 1; new `switchSite` server fn in `src/lib/entries.functions.ts` closes the open segment and opens the next with `classifyPunch` from `src/lib/geo-math.ts`; `clockOut` closes the last one.
- The 50/50 auto-split runs at clock-out (and in `auto-clockout`) when in-tag ≠ out-tag and both are client sites, writing two `auto_split` segments and setting `flagged_review`.
- `buildLabourRows` in `src/lib/workspace-math.ts` gains a segment-aware path: when segments exist, emit one row per segment scoped to the project's site ids; otherwise fall back to today's whole-entry behaviour. `src/lib/workspace.server.ts` fetches segments alongside entries.
- Worker UI: switch button, per-site strip, and the geofence-change prompt in `src/components/worker/WorkerApp.tsx`, reusing the existing offline queue so a switch made without signal syncs later.
- Admin allocation editor in the Entries tab of `src/components/admin/AdminApp.tsx`.
- Unit tests for segment labour math, the 50/50 fallback, and allocation validation.

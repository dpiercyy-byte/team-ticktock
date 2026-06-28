## Goal

Give admins a way to close out a worker who is still on the clock, and have the system auto-close anyone left running past 8 PM. In both cases, the clock-out tag mirrors the clock-in tag (same job site / geo status), so the entry shows matching In/Out chips instead of "no GPS".

## 1. Shared tag logic

When a clock-out happens without GPS coordinates (admin-forced or scheduled), copy the entry's clock-in tag forward:

- `clock_out_geo_status` ← `geo_status`
- `clock_out_job_site_id` ← `job_site_id`

This means the Admin entry list keeps showing the same site on both ends rather than a confusing "Out: No GPS" chip.

Flagging stays the same: if the resulting shift is longer than 14 hours, `flagged_review` is set so admins can spot it.

## 2. Admin-forced clock-out

New server function `adminForceClockOut(token, entryId, clockOutAt?)` in `src/lib/entries.functions.ts`:

- Requires admin auth.
- Loads the open entry; rejects if already closed.
- Uses the provided timestamp or `now()` as the clock-out time.
- Validates clock-out > clock-in.
- Writes `clock_out`, mirrored geo fields, `flagged_review` if >14h.
- Logs an audit event `entry_force_clock_out` with actor=admin, capturing before/after and a `{ reason: "admin_force" }` metadata flag.

Admin UI (`AdminApp.tsx` → `EntriesTab`):

- For any row where `clock_out` is null, show a "Clock out now" button next to the existing edit/delete controls.
- Click opens a small confirm dialog with an optional datetime picker (default = now). Confirming calls the new server fn and refetches the entries list.

## 3. Auto clock-out at 8 PM

New public server route `src/routes/api/public/hooks/auto-clockout.ts` (POST):

- Verifies `apikey` header matches `SUPABASE_PUBLISHABLE_KEY`.
- Loads all `time_entries` where `clock_out IS NULL`.
- For each: sets `clock_out` to today at 20:00 in the app's local timezone (America/Toronto — confirm below), or `now()` if 8 PM has already passed for that entry's date. If `clock_in` is already after the 8 PM cutoff, fall back to `clock_in + 1 minute` so we never write an invalid range.
- Applies the same tag-mirroring + 14h flagging logic.
- Writes one `entry_auto_clock_out` audit row per entry (actor=system) with metadata `{ reason: "auto_8pm" }`.
- Returns `{ closed: n }`.

Cron: schedule via `pg_cron` + `pg_net` to POST the route every day at 20:00 local time (stored in UTC in cron). One job, empty body, `apikey` header.

## 4. Audit + display

- Audit Log tab already renders new actions generically, so the two new action names will appear automatically.
- Entry list shows the In/Out chips as today; because the tags are mirrored, force/auto-closed entries read as "In: SiteA → Out: SiteA". No UI change needed there, but the row's "Clock out now" button is replaced with normal edit/delete once closed.

## Technical details

Files touched:
- `src/lib/entries.functions.ts` — add `adminForceClockOut`; extract a small `mirrorTagsForBlindClockOut(entry)` helper used by both new paths.
- `src/routes/api/public/hooks/auto-clockout.ts` — new server route.
- `src/components/admin/AdminApp.tsx` — "Clock out now" control + confirm dialog in `EntriesTab`, plus wiring through React Query mutation.
- pg_cron job inserted via the SQL insert tool (not a migration) after the route is deployed.

No schema changes. No new tables. RLS untouched (writes go through service-role server code).

## Questions before I build

1. **Timezone for the 8 PM cutoff** — should I use America/Toronto, or a different zone? (Defaults to America/Toronto if you don't say.)
2. **Admin-forced clock-out timestamp** — should the admin always be able to backdate it (datetime picker), or just "close at current time" with one click?

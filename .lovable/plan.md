# Add sub trades to the Schedule

## What you'll see
- Schedule grid shows your workers first, then a **Sub trades** section underneath (e.g. "Ace Electric · Electrician").
- Right under the last row: a **blue "+ Add sub trade" button**, about half your phone's width, centred.
- Tapping it opens a short form: company/name, trade (Electrician, Plumber, HVAC…), optional phone. Save and they appear as a new row.
- Sub rows work exactly like worker rows: tap a day, pick the job, set arrival time and a note. The "Assign crew" dialog (Schedule and job cards) also lists subs so you can book them alongside the guys.
- Tap a sub's name to edit or remove them.
- Subs don't get the app, clock in, or appear in payroll/payouts — this is just for seeing who is where at a glance.

## Technical details
- Migration: `schedule_subs` (id, name, trade, phone, archived_at, created_at) with deny-all RLS + service_role grant. Add nullable `sub_id` to `schedule_assignments`, make `worker_id` nullable, check exactly one of worker_id/sub_id set, unique (sub_id, work_date).
- `schedule.functions.ts`: `adminWeekSchedule` returns subs; `upsertAssignment` accepts `subIds`; new `upsertSub` / `archiveSub`; all admin-token checked and audit-logged. `workerMySchedule` unaffected.
- `SchedulePanel.tsx`: sub rows below workers, sub cells keyed `sub:<id>|date`, blue `w-1/2` add button (primary-blue token) under the last row, add/edit sub dialog. `AssignCrewButton.tsx` lists subs too, with "already at …" conflict hint.

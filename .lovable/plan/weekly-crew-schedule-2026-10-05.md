# Weekly crew schedule

## Recommendation
Build a separate **Schedule** page (a grid of workers by days of the week) rather than putting it inside the worker cards. You see the whole crew's week at once, so you'll notice gaps and double-bookings right away. Inside a single worker card you'd only ever see one person.

```text
            Mon        Tue        Wed      Thu    Fri
Andrew   Brookdale  Brookdale  Castlewood   -      -
         7:00a      7:00a      7:30a
Colin    Castlewood    ...
```

## How it works for you
1. Open **Schedule** from the bottom menu. It opens on this week, with arrows to move between weeks.
2. Tap any empty box. A short list of your active jobs pops up, with the last job you used at the top. Pick one, set an arrival time (quick buttons: 7:00a, 7:30a, 8:00a), and Save. That's 2–3 taps.
3. Tap a filled box to change the job or time, or to remove it.
4. Shortcuts to save time:
   - **Fill the week:** puts the same job and time Mon–Fri for that worker.
   - **Copy last week:** copies the whole crew's schedule from last week, which you then adjust.
   - **Optional note** per day (e.g. "bring tile saw").
5. You can also start from a job card in the active jobs list with an **Assign crew** button. It opens the same picker with that job already selected, and you tick off workers and days.

## What workers see
- A **This week** card on their home screen: each day with the job address, arrival time and note. Today's job is highlighted, with a button to open it in maps.
- Read-only, so workers can't change their schedule.
- Clocking in stays the same. If they're scheduled at a job, the app can suggest that job for the shift so it's already tagged.

## Other suggestions (later, optional)
- Texting workers their week happens only if you ask for it, and may cost money per text.
- Flag a worker in red when they're scheduled but haven't clocked in by their arrival time + 30 min. This builds on the Team today panel.
- Multiple jobs in one day (morning/afternoon). The first version allows only one job per worker per day to keep it simple.

## Questions before building
- One job per worker per day for now: OK?
- Should weekends show, or only Mon–Fri with a toggle?

## Technical details
- New table `schedule_assignments` (id, worker_id, job_site_id, work_date date, arrival_time time, note, created_at, updated_at), unique (worker_id, work_date). Deny-all RLS like the other tables; GRANT to service_role; all access through server functions with admin/worker token checks.
- Job list = `job_sites` where kind = client, not archived and not completed.
- Server fns in a new `src/lib/schedule.functions.ts`: adminWeekSchedule, upsertAssignment, deleteAssignment, fillWeek, copyLastWeek, workerMySchedule. Every change is written to the audit log.
- New admin `SchedulePanel` component + bottom-nav entry; `ThisWeekCard` in WorkerApp; "Assign crew" button on JobCard.
- Clock-in suggestion: pre-select the scheduled site as the planned job; passive geo tracking unchanged.

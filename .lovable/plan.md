# Hide the schedule from the worker view

## What changes
- Workers will no longer see the "My schedule" card on their screen.
- Nothing else changes: you can still build the schedule in admin (More → Schedule), assignments stay saved, and clock-in still tags the day's scheduled job behind the scenes.
- Easy to bring back later — the card is only hidden, not deleted.

## Technical details
- In `src/components/worker/WorkerApp.tsx`, remove the `<WorkerScheduleCard token={session.token} />` render (line ~641) and its import. Leave `WorkerScheduleCard.tsx` and the server functions in place.

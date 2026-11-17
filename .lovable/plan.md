# Smart clock-in / clock-out text reminders

## What you get
- **Missed clock-in text:** if a worker is on the Schedule for today and hasn't clocked in 15 minutes after their arrival time, they get a text like: "Hi Colin, you're scheduled at Brookdale at 7:30. Tap to clock in: <link>". The link opens their clock-in screen.
- **Forgot clock-out text:** if a worker is still clocked in at 4:30 PM, they get "Still working at Brookdale? Tap to clock out: <link>". If they're still clocked in at 6:30 PM, they get one more reminder before the 8 PM auto clock-out.
- **At most one text of each kind per worker per day.** Nobody gets spammed, and nothing goes out on days they aren't scheduled. Clock-out texts go to anyone who is clocked in, scheduled or not.
- **Settings (admin, Settings page):** an on/off switch, the reminder delay (15 minutes), and the clock-out reminder times (4:30 PM and 6:30 PM). The times are my own starting picks, so you can change them.
- **Workers page:** a phone number field on each worker, and a "Send test text" button.

## What you need to do
- Connect a Twilio account and buy one Canadian phone number. That costs about $1.50 a month plus roughly 1–2 cents per text, so the crew might cost about $5 a month in total.
- Add the 4 workers' mobile numbers.

## Technical details
- Migration: add `phone`, an E.164 text field, to `workers`. Add a `reminder_log` table (worker_id, kind, work_date, sent_at, twilio_sid or error; unique on worker_id+kind+work_date), with deny-all RLS and a service_role grant. Store the reminder settings in the existing settings storage.
- `src/lib/reminders.server.ts`: works out who is due in the Toronto time zone, using `schedule_assignments` for missed clock-ins and open `time_entries` for clock-outs. Sends texts through the Twilio connector gateway, records each one in `reminder_log`, and writes an audit log entry.
- New `src/routes/api/public/hooks/send-reminders.ts`, protected by the same secret check as `auto-clockout.ts`. A schedule runs it every 5 minutes from 6 AM to 8 PM.
- Admin server functions to update a worker's phone, save settings and send a test text. All of them check the admin token.
- Tests: the timing rules (sends 15 minutes after arrival, skips anyone already clocked in, sends once per day, sends clock-out reminders only at or after the set times).

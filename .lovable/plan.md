# Fix Colin's Friday time + make the auto clock-out alert actionable

## 1. Colin's Friday (Nov 13) shift
- Right now it reads 8:08 AM – 8:00 PM (auto clock-out). None of your edit attempts reached the server, so the change was blocked on your phone before saving.
- I'll set the clock-out to **3:10 PM** directly (the change is recorded in the audit log). The red alert for that shift clears.

## 2. Fix the time editor so this doesn't happen again
Most likely cause: on the phone, the time box flips 3:10 to **3:10 AM**, which is earlier than the clock-in, so it gets rejected. Or the popup closes when the phone's time picker opens. Either way, the edit is lost without a clear reason.
- Replace the phone's time box with simple taps: hour, minute (00/05/10…) and an **AM / PM** toggle. The PM default comes from the current time.
- Keep the −15 / +15 buttons and the presets.
- If a save is refused, show the reason in the popup (for example "3:10 AM is before clock-in 8:08 AM — did you mean PM?") and keep the popup open.
- Before finishing, I'll test this on a phone-sized screen.

## 3. Tap an alert to jump to the shift
- Each line in the red "Auto clock-outs need review" card becomes a button.
- Tapping it picks that worker, switches to that week, scrolls to the shift, and briefly highlights it.

## 4. Turns green when resolved, with an X to clear it
- After you edit a flagged shift, its line in the card turns **green with "Resolved"** and a check mark. Other lines stay red.
- When every line is resolved, the card turns green: "All auto clock-outs resolved".
- Each resolved line and the card itself get a small **X** to dismiss them. Dismissed items stay hidden on this device.
- Red lines also get an X ("Keep 8:00 PM as is"). It accepts the current time as correct and clears the alert. It's recorded in the audit log.

## Technical details
- Data fix: set clock_out = 2026-11-13 20:10 UTC (3:10 PM Toronto) on entry 85f02bad…. Clear auto_clocked_out and flagged_review, and add an audit_log row.
- QuickTimeEdit (EntryQuickTools.tsx): custom hour/minute/AM-PM picker in place of `<input type=time>`. Show inline errors and keep the popover open on failure. Show server error messages instead of swallowing them.
- AdminApp.tsx EntriesTab: the alert lines call a `focusEntry(id, workerId, clock_in)` that sets the worker and week and scrolls to `data-entry-id`. "Resolved" state = IDs that were auto-flagged this session and are now cleared. Keep them in local state plus localStorage for dismissals.
- New `adminAcknowledgeAutoClockout` server function: clears auto_clocked_out (and flagged_review unless the shift is over 14 hours) and writes to the audit log.
- No change to payroll totals or the worker app.

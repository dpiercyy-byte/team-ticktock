# Add your own trade categories

## What you'll see
- In the Add/Edit sub trade form, a small **"+"** pill sits at the end of the trade pills (Electrician, Plumber, HVAC, Drywall, Painter).
- Tap "+" and a small text box appears with an **Add** button. Type a trade (e.g. "Roofer") and tap Add (or press Enter). It becomes a new pill and is selected.
- Once you save a sub with that trade, the pill shows up every time you add or edit a sub after that. No setup needed.
- The same name typed in different ways ("roofer", "Roofer") counts as one pill.

## Technical details
- Frontend only, in `SchedulePanel.tsx`. Pill list = the default five + every distinct trade on saved subs (case-insensitive, Title Case), plus any typed in this session.
- Nothing new is stored: the trade is saved on the sub record as it is today.

## Increase Paid / Unpaid Tag Visibility

### Goal
Bump the text size and padding on all "Paid", "Unpaid", and "Overdue" status tags across the app so they are easier to read at a glance.

### Locations to update
1. **Admin — Payout worker cards** (`AdminApp.tsx` lines 903–921)
   - Paid badge: `text-[11px] px-1.5 py-0.5` → `text-xs px-2 py-1`
   - Unpaid badge: `text-[11px] px-1.5 py-0.5` → `text-xs px-2 py-1`
   - Tip/short chip: same bump

2. **Admin — Pending / Lifetime payout list rows** (`AdminApp.tsx` lines 1936–1939)
   - Status pill: `text-[11px] px-1.5 py-0.5` → `text-xs px-2 py-1`
   - Dot inside pill: `h-1.5 w-1.5` → `h-2 w-2`
   - Tip/short chip: same bump

3. **Worker — "Last week" pill** (`WorkerApp.tsx` line 1081)
   - Status badge: `text-[10px] px-2 py-0.5` → `text-xs px-2.5 py-1`

### Expected result
All status tags render with `text-xs` (12 px) and slightly more padding, making the paid/unpaid state readable without squinting. No functional changes.
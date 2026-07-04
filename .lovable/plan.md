In the admin panel's worker time-entry cards (`src/components/admin/AdminApp.tsx`), each individual entry currently shows a smaller blue hours total immediately after the clock-in → clock-out time strip (e.g., "8:00 AM – 4:00 PM  8.00 hrs"). Remove that blue `<span>` so only the time range remains.

File to edit:
- `src/components/admin/AdminApp.tsx` (lines 469–473)
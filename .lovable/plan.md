# Dedicated Receipts view

Add a "Receipts" sub-tab inside the Payout section that lists every reimbursement with an attached receipt across all workers and weeks, with filters, thumbnails, and direct download.

## Where it lives

Add a new tab next to Weekly / Pending / Lifetime in the Payout tab → "Receipts". Keeps receipts logically grouped with payment workflows.

## UI

- **Filter row** (top):
  - Worker dropdown (All workers / specific worker)
  - Week dropdown (All weeks / specific week, sorted newest first)
  - Search box (matches description)
  - "With receipt only" toggle (default ON, since this is the Receipts view)
- **Grid of receipt cards** (responsive, 2–4 per row):
  - Thumbnail preview (image inline; PDF shows a generic doc icon)
  - Worker name + week range
  - Description + amount
  - Submitted date
  - Actions: View (opens existing lightbox) · Download (forces file download) · Open in new tab
- **Empty state** when filters produce no results.
- **Summary strip** above the grid: total receipts shown, total amount.

## Download behavior

Clicking Download triggers a real file download (not just opening the public URL in a new tab). Use an `<a download>` link with the existing `receipt_url`. Filename pattern: `{worker}-{week}-{description}.{ext}`.

## Backend

Add one new server function:

- `listAllReceipts({ token, workerId?, weekStart?, withReceiptOnly? })` in `src/lib/reimbursements.functions.ts` — admin-only, returns receipts joined with worker name and week, ordered by created_at desc. Limits to ~500 most recent to keep payload reasonable; older results require filtering by week.

No schema changes. No new storage logic — receipts already live in the public `receipts` bucket with public URLs.

## Files touched

- `src/lib/reimbursements.functions.ts` — add `listAllReceipts`
- `src/components/admin/AdminApp.tsx` — add `<ReceiptsTab />` component, wire into Payout `<Tabs>`
- Reuse the existing receipt lightbox/viewer state and `Paperclip`/`Image` styling already in `PayoutsTab`

## Out of scope

- Bulk zip download (separate ask if you want it later)
- Editing receipts from this view (delete/replace still happens via the per-worker "+ Reimb." dialog)
- Mobile worker app changes

## Goal
Restyle the Receipts tab cards so that status/source badges sit inside the bottom content area instead of overlaying the receipt image, with explicit "Admin" / "Worker" source labels.

## Current state
In `AdminApp.tsx` each receipt card has:
- Top-left overlay: AI-parsed / Edited / Scanning / Scan-failed / Unparsed status pill
- Top-right overlay: "Admin" or "Uploaded by admin" pill
- Bottom section (CardContent): vendor, amount, category/job-site pills, action buttons

## Changes

### 1. Remove overlay pills from the image area
In the receipt card grid map, delete the two `absolute` positioned `<span>` elements that sit inside the `<button>` wrapping the receipt image:
- The top-left `statusLabel` pill
- The top-right `Admin` / `Uploaded by admin` pill

### 2. Add a badge row inside CardContent
Inside the existing flex-wrap badge area (currently holding Category, Job Site, and Bill-client badges), prepend two new pills:
- **Source pill** — "Admin" (secondary/Admin color) when `isAdminReceipt === true`, otherwise "Worker" (outline or muted style) when `isAdminReceipt === false`. This gives the explicit Admin / Worker distinction the user wants.
- **Status pill** — the same `statusLabel` and `statusColor` that was previously at top-left. Keep the same color mapping (green=ok, blue=manual, amber=pending, red=failed, muted=unparsed).

### 3. Keep existing layout and spacing
- Do not change card dimensions, grid columns, or image aspect ratio.
- Keep action buttons and existing extracted-info text exactly as-is.
- No backend or data changes required.

## Out of scope
- No changes to filters, CSV export, edit dialog, upload flow, or AI parsing.
- No new data fields.

## Acceptance criteria
- Receipt image no longer shows any overlay text.
- Every card shows a source pill ("Admin" or "Worker") and a status pill ("AI parsed", "Edited", "Scanning…", "Scan failed", or "Unparsed") in the bottom info area.
- Existing category/job-site/bill-client pills remain present.
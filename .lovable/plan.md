## Goal
Let admins mark a receipt as Client-billable at upload time (matching the edit dialog), and stop asking for the job site twice when one has already been picked.

## Current behavior
- **Admin upload dialog** (`src/components/admin/AdminApp.tsx` ~L2087–2200): shows Description, Amount, one "Bill to job site (optional)" dropdown, receipt attach. If a site is chosen, the server implicitly sets `material_type = "client_billable"`. No visible Regular/Client-billable toggle.
- **Admin edit dialog** (`src/components/admin/AdminApp.tsx` ~L3099–3149): shows an explicit Regular / Client-billable toggle, and when Client-billable is picked it renders a *second* "Bill to client" job-site dropdown — even if the receipt already has a job site attached from upload/parsing. That second picker is the redundancy.

## Changes

### 1. Admin upload dialog — add explicit billable toggle
- Rename the "Bill to job site (optional)" field to "Job site" and keep it as the single site picker.
- Above/next to it add a Regular / Client-billable segmented toggle styled like the edit dialog (Regular default, Client-billable in emerald).
- When Regular is selected, the job site picker stays visible but is treated as informational only (stored as `parsed_job_site_id`, not `billable_job_site_id`).
- When Client-billable is selected, the same job site becomes the billable site and is required to submit (button disabled until a site is chosen).
- Wire the submit call to send both `billableJobSiteId` (only when Client-billable) and, if we extend the server fn, `parsedJobSiteId` for the regular case. Minimal server change: extend `adminAddReimbursement` (or the existing add path used here) to accept an optional `parsedJobSiteId` so the picked site is still recorded even when non-billable. No schema migration — columns already exist.

### 2. Admin edit dialog — remove the duplicate site picker
- Drop the second "Bill to client" `Select` inside the Client-billable branch.
- When the toggle flips to Client-billable, reuse the receipt's existing site (prefer `billable_job_site_id`, fall back to `parsed_job_site_id`) as the billable site on save.
- If no site is set on the receipt at all, show a small inline hint linking the user to fix the site on the receipt itself rather than surfacing another picker in this dialog.
- Save handler sends `billableJobSiteId` = whichever id we resolved; validation only blocks save when Client-billable is on and no site exists on the receipt.

### 3. Worker submit flow
No changes — workers already pick one job site; billability is decided by admins.

## Files touched
- `src/components/admin/AdminApp.tsx` — upload dialog UI + submit payload; edit dialog UI + save payload.
- `src/lib/reimbursements.functions.ts` — extend the admin-add input to accept `parsedJobSiteId`; keep existing `material_type` inference but honor the explicit toggle when provided.

## Out of scope
- No DB migration, no changes to worker UI, no changes to Google Sheets export.

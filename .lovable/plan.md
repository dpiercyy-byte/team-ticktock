## Prefer active job site on receipt cards; drop material-pickup subtitle

### Problem

On admin receipt cards, the job-site badge shows whatever `parsed_job_site_id` resolved to — including supplier locations like `50 Red Maple Rd (Home Depot)` when the worker clocked in there. The card should always name the actual client job the receipt belongs to, using the worker's clock-in/out for that day when the parsed match is a supplier. Also, the extra italic description line ("Material pickup", etc.) under the badges is visual clutter.

### Changes

**1. Server: pick a client job for the receipt (`src/lib/reimbursements.functions.ts`, `src/lib/receipts.functions.ts`)**

Extend the row shape returned by `listReimbursements` and `listAllReceipts` with a new derived field `displayJobSiteLabel` (and `displayJobSiteId`) computed as:

1. If `billable_job_site_id` is set → use that site's label. (Client-billable is always a client job.)
2. Else if `parsed_job_site_id` is set and that `job_sites.kind === 'client'` → use it.
3. Else, resolve from the worker's day:
   - Query `time_entries` for this `worker_id` where the receipt's date (prefer `parsed_date`, fall back to `week_start`/`created_at` day) falls between `clock_in` and `clock_out` (or same calendar day when open).
   - From that entry, prefer `project` (billed job title), else the client-kind site tied to `in_job_site_id`, else `out_job_site_id`.
4. If still nothing → `null` (card shows the existing "No job" dashed badge).

Never surface a supplier label as the display job site. Keep the raw `parsed_job_site_label` in the response for the Edit dialog only.

**2. Admin receipt card (`src/components/admin/AdminApp.tsx`, ~lines 1663–1687)**

- Replace `i.parsedJobSiteLabel` in the priority strip with `i.displayJobSiteLabel`.
- Remove the italic description subtitle block (lines 1685–1687): `{i.parsedVendor && i.description && …}`. The vendor already owns the top row; the free-text description is redundant here.
- Keep the `Bill client · …` badge and category badge as-is.

**3. Worker "My reimbursements" list (`src/components/worker/WorkerApp.tsx`)**

Mirror the same swap: show `displayJobSiteLabel` instead of the parsed supplier label if that list surfaces a job chip. (No change to the input form.)

### Out of scope

- No schema migration; `parsed_job_site_id` still stores the raw geo match for auditing and for the Edit dialog.
- The "Material pickup" off-site reason on time entries stays — only the receipt-card subtitle is removed.
- Time-entry rows and GPS audit footer are untouched.
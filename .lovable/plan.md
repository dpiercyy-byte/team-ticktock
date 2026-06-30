## Goal
1. Let workers attach a **job** to a receipt when they submit a reimbursement.
2. Stop mixing client jobs, suppliers, and archived sites in the admin receipt "Job site" dropdown.

## Changes

### 1. Worker — pick a job on the receipt dialog

**`src/lib/reimbursements.functions.ts`**
- Add `workerListActiveJobSites` — returns active sites (not archived), each with `{ id, label, kind }`. No auth elevation; just `requireWorker`.
- Extend `workerSubmitReimbursement` input with optional `jobSiteId: string | uuid | null`. Persist as `parsed_job_site_id` so it flows through the existing AI-edit and Sheets-sync pipeline (`parse_status` stays unchanged; the AI parser will only fill blanks).

**`src/components/worker/WorkerApp.tsx` (Reimbursements dialog around lines 686–745)**
- Query the new function once when the dialog opens.
- Insert a "Job (optional)" `<Select>` between Description and Receipt photo.
- Group options with `SelectGroup` / `SelectLabel`:
  - "— None —"
  - **Client jobs**
  - **Suppliers**
- Pass the chosen id into `submitFn` as `jobSiteId`.

### 2. Admin — group sites in the receipt edit dropdown

**`src/components/admin/AdminApp.tsx` → `EditParsedDialog` (Job site Select, line ~1701–1710)**
- Replace the flat `sites.map(...)` with three grouped sections using `SelectGroup` + `SelectLabel`:
  - **Client jobs** (active, `kind = client`)
  - **Suppliers** (active, `kind = supplier`)
  - **Archived** (anything with `archived_at`, collapsed at the bottom, label "Archived")
- Use the same grouping for the "Bill to client" select if it ever shows more than client sites (currently filtered — leave as is).
- The dropdown already opens via the shared `sites` prop — no server changes needed.

### Out of scope
- Changing the AI parser to overwrite a worker-provided job.
- Adding the "Client-billable" toggle to the worker UI (admin-only stays).
- Changes to the geo-tag editor (already grouped).
- Schema / migrations.
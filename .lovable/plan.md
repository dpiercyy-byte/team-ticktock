# Guided "Add receipts" flow (admin)

Replace the single scrolling form in the admin Add receipts dialog with a one-question-at-a-time wizard. Each answer auto-advances to the next step. Worker side stays as it is for now.

## Steps

1. **Type** — two big buttons: Regular or Client-billable. Tapping one advances immediately.
2. **Job site** — list of active client jobs as tappable rows; tapping one advances. Required for client-billable; for Regular there is a "No job site" row that also advances.
3. **Attachments** — drag/drop or file picker, still up to 10 files at once. Chosen files listed with remove buttons. A "Next" button advances (the step can't auto-advance since more files may be added).
4. **Details (optional)** — payee, description, and week. A "Skip" button and a "Add receipts" button; both submit, Skip just submits with the fields left as-is (week defaults to the current week).

Then the existing upload + AI parsing runs unchanged, with the same progress counter and toasts.

## Behaviour

- Header shows step title and a small "Step 2 of 4" dot indicator.
- Back button on every step except the first; answers are kept when moving back.
- Switching type back to Regular after picking a job keeps the job (it stays optional).
- Closing the dialog resets everything, same as today; closing is blocked while uploading.
- Submit validation stays: at least one file, and a job site when Client-billable.

## Technical notes

- All changes are inside `AdminAddReceiptsDialog` in `src/components/admin/AdminApp.tsx`; no server function or data changes.
- Add a `step` state (1–4) plus small `StepShell` / progress-dots helpers local to that component; reuse the existing `materialType`, `jobSiteId`, `files`, `payee`, `description`, `weekStart` state and the existing `submit()` untouched.
- Job list replaces the `Select` with buttons over the same `clientJobs` array.
- Dialog keeps `max-h-[90vh]` with the scroll area so the taller job list works on mobile.

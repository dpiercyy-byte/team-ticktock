# Receipts bulk add: upload first, then assign

Rework the admin **Add receipts** dialog into a two-phase flow built for bulk. No notes, no payee, no week question up front.

## Phase 1 — Upload only

- Tapping **Add** opens a dialog whose only content is the file dropzone: drag/drop, click to choose, or camera on mobile.
- Multi-select, up to 10 files (same limits as today: JPG/PNG/PDF, 25MB each).
- Chosen files show as a compact thumbnail strip with remove buttons.
- Single **Continue** button (disabled with 0 files).
- On Continue, uploading starts immediately in the background while assignment begins — the user doesn't wait on a spinner.

## Phase 2 — Assign, one receipt at a time

A card stack: one receipt on screen at a time.

- Big preview of the receipt image (PDFs show a file tile) with a "Receipt 2 of 7" counter and a slim progress bar.
- Below it, a scrollable list of active client jobs as tappable rows, plus a **No job site** row at the top.
- Tapping a job assigns it and auto-advances to the next receipt.
- A small **Regular / Client-billable** toggle sits above the job list, defaulting to Regular and remembered from the previous receipt in the batch (most batches are the same type). Client-billable requires a job, so the No-job row is disabled in that mode.
- **Back** returns to the previous receipt with its answer intact; **Skip** leaves a receipt unassigned and moves on.
- After the last receipt, a short summary ("7 receipts · 5 assigned · 2 no job") with **Done**, which finalizes and closes.

## Behaviour details

- Week is no longer asked; it defaults to the current week silently.
- Payee and notes are removed from this flow — still editable afterwards in the existing "Edit receipt details" dialog.
- Uploads and AI parsing run exactly as today; each receipt's job/type is applied when its upload finishes (or right after, if assignment lands first).
- Failures are surfaced per-file in the summary with the same toast wording as today.
- Closing is blocked while uploads are still in flight; otherwise closing resets everything.
- Worker-side receipt upload is untouched for now.

## Technical notes

- All UI changes stay in `AdminAddReceiptsDialog` in `src/components/admin/AdminApp.tsx`. No server function, schema, or export changes.
- Replace the current flat form state with a `phase: "upload" | "assign" | "summary"` plus an `items` array holding `{ file, previewUrl, status, uploadResult, jobSiteId, materialType, error }`.
- Upload loop kicks off on Continue (concurrency 2) reusing `prepareUpload`, `withRetry`, `uploadFn`, and `addFn`; `addFn` for an item is called once both its upload has resolved and the user has answered, so the existing single-call create path stays unchanged.
- Previews via `URL.createObjectURL`, revoked on close.
- Job rows come from the same `clientJobs` array that currently backs the `Select`.
- Remove now-unused `payee`, `description`, `extraOpen`, `weekStart` UI (keep a `weekStart` constant for the payload) and the `ChevronDown` import if unused.

## Verification

- Typecheck/build passes.
- Admin → Receipts → **Add**: upload 3 files, confirm assignment cards appear immediately, tapping a job advances, Back keeps answers, and all 3 land with the right job and billable flag.

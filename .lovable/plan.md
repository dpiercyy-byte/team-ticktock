# Receipts bulk-add: verify and ship

The rebuilt flow is present in the code today: the admin **Add receipts** dialog is a three-phase state machine (`upload` → `assign` → `summary`) with a multi-file dropzone, background uploads, a one-at-a-time assign stack, and a final batch summary. Nothing about it is missing from the source, so the most likely reason you don't see it is that the version you're using (published site, or a cached tab) predates the change.

## Steps

1. Drive the admin Receipts tab in the running preview and open **Add** to capture what the dialog actually renders. This confirms whether the new flow is live in preview or being blocked by an error.
2. If the preview shows the old single form, fix the actual defect found in step 1 (likely a stale render path or a second dialog still wired to the Add button).
3. If the preview shows the new flow, the gap is deployment only — publish so the live site picks it up, and note the hard-refresh step for the phone.

## Technical notes

- Dialog lives in `src/components/admin/AdminApp.tsx` (`AdminAddReceiptsDialog`, ~line 3484); it is the only component wired to the Receipts **Add** button (`aria-label="Add receipts"`).
- Verification uses Playwright against `http://localhost:8080` with screenshots of the opened dialog.
- No schema or server-function changes are expected.

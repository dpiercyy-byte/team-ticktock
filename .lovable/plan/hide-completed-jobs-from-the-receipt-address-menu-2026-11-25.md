# Hide completed jobs from the receipt address menu

## What went wrong
When we moved the 7 old archived jobs into the Completed tab, they became "not archived" again. The receipt address menu only hides archived jobs, so every completed job (22 in total, including those 7) now shows in it.

## The fix
- The receipt address menu will only show **active** jobs (plus suppliers), not completed ones. This applies to workers uploading receipts and to the admin receipt screens.
- The automatic receipt reader will also only match receipts to active jobs.
- Nothing gets deleted. Completed jobs stay in the Completed tab, and receipts already tagged to them keep their address.
- If you reopen a completed job, it comes back in the menu.

## Technical details
- `src/lib/reimbursements.functions.ts` `workerListActiveSites`: add `.is("completed_at", null)`.
- `src/lib/receipts.functions.ts` (AI parse site list, ~line 302) and any admin receipt site pickers: same filter.
- Check validation for billable site selection still accepts already-tagged completed sites when editing an existing receipt.

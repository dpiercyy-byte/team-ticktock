## Goal
Let admins edit the "Note" (description) field of any receipt from the existing **Edit receipt details** dialog. Today the dialog exposes vendor/date/amounts/category/job site/material type but not the note the worker (or admin) typed at upload time, so it can only be changed by deleting and re-creating the receipt.

## Changes

1. **`src/lib/receipts.functions.ts` — `updateParsedReceipt`**
   - Add `description: z.string().trim().max(500).nullable().optional()` to the input validator.
   - When provided, set `patch.description = data.description` (empty string → `null`).
   - Existing `syncRow(...)` call already writes `description` to the Google Sheet, so the edited note flows to Sheets automatically.

2. **`src/components/admin/AdminApp.tsx` — `EditParsedDialog`**
   - Add a `description` state, initialise it from `item.description` in the existing `useEffect`.
   - Render a new **Note** `<Textarea>` (2–3 rows) at the bottom of the form, above material type.
   - Include `description: description.trim() || null` in the `updateFn` payload.

3. **Receipt card display (optional polish)**
   - The card already shows the note as `"…"` under vendor (line 1541) when `parsedVendor !== description`. No change needed; it will reflect edits after the list re-fetches.

## Out of scope
- Worker-side editing of their own note (still delete + re-add).
- Renaming the column "Description" → "Note" in code or Sheets (kept as-is to avoid breaking the existing sheet header).

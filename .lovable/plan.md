## Goal

1. Make the Receipts tab's Worker dropdown the single place to pick who a receipt belongs to — including admin uploads — and drop the separate Worker/Admin toggle.
2. Fix the AI receipt scan so the initial scan and the re-scan actually populate vendor / date / totals / category / job site reliably.

---

## 1. Worker dropdown change (Receipts tab)

In `ReceiptsTab` inside `src/components/admin/AdminApp.tsx`:

- Remove the standalone `kind` filter (`All / Worker / Admin` segmented select) and its state.
- Change the Worker dropdown options to:
  - `All` (everyone, includes admin)
  - `Admin` (all `is_admin_receipt = true` rows, grouped together — uses sentinel value `"__admin__"`)
  - A visual separator
  - Each worker (existing list)
- Update the `filtered` logic so `workerId === "__admin__"` keeps only `i.isAdminReceipt`, and a real worker id keeps `!i.isAdminReceipt && i.workerId === id`.
- Keep the `payeeLabel` shown on admin cards as-is; no schema change.

No other filters change. Upload dialogs are unchanged.

## 2. AI parsing fix

The gateway requests succeed (HTTP 200) but outputs are tiny (~110 tokens), which matches the pattern of Gemini being handed an image URL it can't fetch — it returns mostly `null` fields. The fix is to send the image bytes inline instead of a URL, mirror the PDF branch, and tighten the response handling.

In `src/lib/receipts.functions.ts → aiParseReceipt`:

- Always fetch `receiptUrl` server-side and inline the bytes:
  - PDF → existing `type: "file"` base64 branch (keep).
  - Image → switch from `image_url: { url }` to `image_url: { url: "data:<mime>;base64,<...>" }` so the model receives the actual pixels, not a URL it may not be able to read.
  - If the fetch fails, mark `parse_status: "failed"` with a clear `parse_raw.error` and stop.
- Detect truncation/empty output: if `choices[0].finish_reason === "length"` or the `content` is empty/non-JSON, mark `failed` with the reason instead of silently writing all-null fields.
- Strip accidental markdown fences (```json … ```) before `JSON.parse` so a model that ignores `response_format` still parses.
- Coerce numeric strings ("12,34" / "$12.34") through a small `toNum` helper so European decimals and currency symbols don't become `null`.
- Tighten the prompt: explicitly ask for raw numbers (no currency symbols, `.` decimal), ISO date `YYYY-MM-DD`, and to set `confidence` honestly so the UI badge is meaningful.

In `runParseForReimbursement`:
- Set `parse_status: "pending"` (already done), and on any thrown error keep current `failed` write but also include the upstream message snippet for the admin to see in the row tooltip.

In `parseReceipt` (rescan) and `parseUnprocessed`:
- No signature changes. They already call `runParseForReimbursement`, so the fix propagates to both initial scan and rescan.
- For `parseUnprocessed`, also include rows where `parse_status = 'failed'` (currently only `is null`), so the bulk button actually retries failed scans, which is what users expect from a "scan all" action.

## Out of scope

- No DB schema changes.
- No changes to Google Sheets sync columns or upload dialogs.
- No model swap; staying on `google/gemini-3-flash-preview`.

## Files touched

- `src/components/admin/AdminApp.tsx` — Receipts tab filter UI + logic.
- `src/lib/receipts.functions.ts` — `aiParseReceipt`, `runParseForReimbursement`, `parseUnprocessed`.

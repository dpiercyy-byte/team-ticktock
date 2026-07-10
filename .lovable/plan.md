# Fix stuck "scanning" receipts

## Root cause

In `src/lib/reimbursements.functions.ts` there are three submit paths (worker submit, admin submit, worker-admin submit). Each triggers the AI parse like this:

```ts
runParseForReimbursement(inserted.id).catch((e) => console.error(...));
```

No `await`. On Cloudflare Workers (our runtime), any promise still pending when the handler returns is terminated — background work only survives via `ctx.waitUntil`, which isn't wired up here. So:

- AI parse never finishes → `parse_status` stays `pending` → UI shows "Scanning…" indefinitely.
- `syncRow(...)` (Google Sheets append) runs inside the same function, so the new row never reaches the sheet either.
- Manual "Rescan" calls `parseReceipt`, which awaits properly, so it works.

## Fix (two layers, both small)

### 1. Await the parse in the submit handlers — primary fix

Change the three call sites in `src/lib/reimbursements.functions.ts` from fire-and-forget to `await`. Wrap in try/catch so a parse failure never blocks the reimbursement submission itself (the row is already inserted; parse failure just sets `parse_status: "failed"` inside `runParseForReimbursement`).

```ts
try {
  const { runParseForReimbursement } = await import("./receipts.functions");
  await runParseForReimbursement(inserted.id);
} catch (e) {
  console.error("parse trigger", e);
}
```

Cost: submit response takes ~1–4s longer while Gemini parses and Sheets sync runs. Benefit: by the time the client refetches, `parse_status` is `ok` (or `failed`) and the Sheet row exists. This matches how manual "Rescan" already works reliably.

### 2. Client-side status poll — safety net

Even with (1), a very slow Gemini response or a transient Sheets error could still leave a row in `pending`. Add a lightweight poll in the receipts list / reimbursement card UI:

- When a row's `parse_status === "pending"`, invalidate the receipts query every ~4s (max ~6 retries / ~25s) via `queryClient.invalidateQueries`.
- Stop polling as soon as the row flips to `ok` or `failed`.
- No new endpoint needed — the existing list query already returns `parse_status`.

This makes the UI self-heal without the user pressing "Rescan".

## Files touched

- `src/lib/reimbursements.functions.ts` — three call sites: worker submit (~line 123), admin submit (~line 194), worker-admin submit (~line 321). Change fire-and-forget to awaited try/catch.
- One UI file that renders the receipts list with the "Scanning…" badge (likely the Receipts tab in `src/components/admin/AdminApp.tsx` or a dedicated receipts component) — add the pending-row polling effect.

## What we're intentionally NOT changing

- `runParseForReimbursement` itself — it already awaits Gemini and the Sheets sync correctly.
- The `parseReceipt` server function — manual rescan keeps working as-is.
- The Google Sheets sync logic — once the parse actually completes, the existing `syncRow` call handles the append.

## Verification

- Submit a new receipt as a worker → within a few seconds the card shows parsed vendor/total, not "Scanning…".
- Check the linked Google Sheet → the new row appears without a manual rescan.
- Simulate a Gemini failure (bad image) → row flips to `failed`, not stuck on `pending`.

# Fix receipts stuck on "Scanning…"

## What's actually wrong

The Receipts list auto-refresh is keyed off the wrong field. The list refetches every 4 seconds only while some item has `parse_status === "pending"`, but the server returns that field as `parseStatus` (camelCase) — the card itself reads `i.parseStatus` correctly. So the condition is never true: the polling never starts, and a card that rendered while scanning keeps showing "Scanning…" forever until you manually reload or switch tabs. The database side is fine — no rows are actually stuck in `pending` right now, which confirms the scan completes and only the UI is frozen.

A second, smaller risk: scanning runs inline inside the save request. If that request is cut short (slow AI response, network drop, many receipts at once), the row is left marked `pending` with nothing to retry it, which would then genuinely stick.

## Fix

1. **Correct the polling key.** Poll on `parseStatus` instead of `parse_status` so the list refreshes every few seconds while any receipt is still scanning, and stops once they're all done.
2. **Refresh after the upload dialog closes.** Invalidate the receipts query when the bulk-add dialog finishes so freshly added receipts appear with live status instead of a frozen snapshot.
3. **Add a stale-scan safety net.** Treat a receipt that has been `pending` for more than ~2 minutes as stalled: show it as "Scan failed" with the existing retry action instead of an endless spinner, and include stalled rows in the "Scan N" bulk re-scan count so one tap fixes them.

## Technical notes

- `src/components/admin/AdminApp.tsx` — `refetchInterval` at the `["all-receipts"]` query (~line 2612); card status at ~line 2929; `unparsedCount` at ~line 2663.
- `src/lib/receipts.functions.ts` — `parseUnparsedReceipts` filter widens from `parse_status is null / failed` to also include `pending` rows older than 2 minutes.
- No schema changes; `parsed_at`/`created_at` already give the staleness signal.

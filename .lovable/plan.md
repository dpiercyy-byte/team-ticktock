# Why the sheet shows $1,600 and $850

Nothing was written to the Cash Tracking sheet tonight. The two rows you're looking at are **last week's** rows, not tonight's.

What the records show:

- Tonight (Aug 10) you marked the **Aug 2–8** week paid: Colin $1,800, JR (Edgardo) $740, both "paid by Dylan". Those amounts are stored correctly in Clockwise.
- The last two rows in Dylan's column are dated **Aug 4** and say "Colin July 26 – August 1, 2026" (-$1,600) and "Jr July 26 – August 1, 2026" (-$850). Those match exactly the **July 26–Aug 1** payouts marked paid on Aug 4 — the right amounts for that week.
- The Cash Tracking export switch in Settings is currently **off**, and there is no export entry in the audit log for tonight, so the app added no row for the $1,800 / $740 payouts.

So it isn't a wrong-amount bug — it's a silent no-op. The real defect is that when the export is off (or the sheet isn't configured), "Mark paid" still shows a plain success toast, so it looks like a row was written.

## Fix

1. **Make the export state visible.** `markWeekPaid` returns a reason when it skips (`disabled` / `not configured` / `no payer selected`) instead of silently returning nothing, and the mark-paid toast says either "added to Dylan's column (row N)" or "Marked paid — Cash Tracking export is off, no row added."
2. **Warn in the dialog.** When a payer is selected but the export is off or unconfigured, the Mark-paid dialog shows an inline note with a link to Settings, so it's obvious before you confirm.
3. **Turn the export on** and confirm it against the live sheet, so the next mark-paid writes a real row.
4. **Backfill tonight's two rows** into Dylan's block: -$1,800.00 / Aug 10 / "colin aug 2 to 8" and -$740.00 / Aug 10 / "jr aug 2 to 8" — matching the sheet's existing wording style. Confirm before this is written.
5. **Comment wording**: use the sheet's native short style (`colin aug 2 to 8`) rather than the long "July 26 – August 1, 2026" form.

## Technical notes

- `src/lib/payout.functions.ts`: `markWeekPaid` returns `sheetSkipped: 'disabled' | 'unconfigured' | null` alongside `sheetRow` / `sheetError`.
- `src/components/admin/AdminApp.tsx`: both mark-paid handlers (payout tab and entries tab) branch on `sheetSkipped`; the dialog reads cash-export settings via the existing `getCashExportSettingsFn` to show the inline warning.
- Worker name used in the comment is lowercased first name, already handled by `cashCommentLabel` in `src/lib/payout-math.ts`; only the display casing changes.
- Backfill is a one-time write into the first empty rows of the Dylan block, using the same append path as the live export.

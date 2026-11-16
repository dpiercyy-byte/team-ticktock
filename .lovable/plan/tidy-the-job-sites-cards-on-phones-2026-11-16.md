# Tidy the Job Sites cards on phones

## What's wrong in the screenshot
- The "Completed" tag gets cut off ("Compl", "Co") because the long address name and the tag are squeezed onto one line.
- The "Reopen" button and archive icon sit beside the card text, stealing about a third of the width, so addresses get cut short too.
- The radius slider is cramped next to them.

## The fix (phone layout only; computer view stays the same)
1. **Top row:** job name on the left, the small "Completed" tag on the right — the name shortens with "…" if needed, the tag is never cut off.
2. **Second row:** full address, with room to show more of it.
3. **Bottom row:** radius slider on the left, "Reopen" (or "Complete") and the archive icon on the right, all on one line under the address.
4. Same treatment for Active, Suppliers and Archived lists (Restore / Delete move to the bottom row too).

Nothing about how sites save, complete, or archive changes — it's just rearranging the card.

## Technical details
- `src/components/admin/AdminApp.tsx` job-site list item (~lines 5770–5900): change `li` from a single flex row to a stacked column; title row `flex justify-between` with `truncate` on the label span and `shrink-0` on the badge; move the action button group into the radius row (`flex items-center justify-between`), using `sm:` classes to keep the current side-by-side layout on wider screens.

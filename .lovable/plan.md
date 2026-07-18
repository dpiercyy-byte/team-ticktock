## Goal
Move the "+ Add receipts" action off the floating bottom-right FAB and into a compact icon button in the Receipts header row, next to the existing CSV download icon.

## Changes (all in `src/components/admin/AdminApp.tsx`, Receipts tab)

1. **Remove the floating FAB**
   - Delete the `fixed bottom-6 right-6` "+" button that currently opens the Add receipts dialog.

2. **Add a compact "+" icon button in the summary row**
   - In the row that shows "34 receipts · Total: $4719.44" and the CSV download icon, add a `Plus` icon button (ghost/icon variant, same size and styling as the CSV button) immediately to the right of the CSV icon.
   - Clicking it opens the same `AdminAddReceiptsDialog` the FAB used to open.
   - Include an `aria-label="Add receipts"` and a tooltip/title for accessibility.

3. **No behavior changes**
   - Dialog contents, submit flow, and material-type toggle stay exactly as they are.
   - No server-function or schema changes.

## Out of scope
- Worker UI, other tabs, or any change to receipt cards.

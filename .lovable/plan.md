Add an "Apps" back link to the Clockwise Admin header so admins can return to the app chooser, matching what Ledger already has.

## Change
In `src/components/admin/AdminApp.tsx` (AdminDashboard header, ~line 172), add a `<Link to="/apps">` with an `ArrowLeft` icon + "Apps" label to the left of the Clockwise logo/title block, separated by a thin vertical divider — visually consistent with `LedgerHeader.tsx`.

No other behavior changes; sign-out stays on the right.
# Payout > Weekly header cleanup

Scope: `PayoutsTab` weekly view in `src/components/admin/AdminApp.tsx` (~lines 1083–1148). No other tabs touched.

## Changes

1. **Remove duplicate week controls**
   - Delete the `relativeWeekLabel` badge under the date range (lines ~1092–1095) so only `< June 28 – July 4, 2026 >` + calendar icon remain.
   - Delete the entire "This week / Last week" chip toggle block (lines ~1134–1148).

2. **Consolidate CSV exports into one dropdown**
   - Replace the two full-width buttons (`Time entries CSV`, `Payout CSV`) with a single secondary `Export ▼` button using the existing `DropdownMenu` primitive.
   - Dropdown items: "Time entries CSV" → `downloadCsv`, "Payout CSV" → `downloadPayoutCsv`.
   - Place it inline with the date row (right side on desktop, wraps under on mobile), sized `sm` / `variant="outline"` so it no longer dominates the layout.

## Result

The weekly header collapses to a single row: `<  June 28 – July 4, 2026  >  📅   Export ▼`, with the "Unpaid" status pill (already handled elsewhere) untouched. Worker payout cards move up the screen.

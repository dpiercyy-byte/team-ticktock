# Swap tabs + group pending payouts by week

## 1. Swap Payout and Job Sites in the bottom bar
New order: Entries, Payout, Job Sites, then the rest unchanged. Desktop tab order follows the same.

## 2. Group Pending payouts by week
- Cards grouped under a week heading, e.g. "This week · Nov 16 – Nov 22", "Last week · Nov 9 – Nov 15", then older weeks by date ("Nov 2 – Nov 8").
- Newest week at the top, older weeks below.
- A faint thin line separates each week group.
- Each heading shows that week's total owed on the right.
- Cards, Mark paid, Undo, tap-to-open-timesheet and "Show paid weeks" all work exactly as now.

## Technical details
- `AdminBottomNav.tsx`: swap the `sites` and `payouts` entries; `ADMIN_TABS` in `AdminApp.tsx`: same swap.
- `PendingPayoutsView`: group `items` by `weekStart`, sort groups descending, render header + `border-t border-border/50` between groups; reuse existing card markup. Frontend only, no data changes.

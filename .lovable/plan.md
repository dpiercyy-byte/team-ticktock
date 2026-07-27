## Goal

Replace the Clockwise admin's scrollable top tab strip with a docked bottom navigation bar that mirrors Ledger's footer nav: icon in a rounded pill above a small label, active state tinted, full-width bar with blur, border-top, and safe-area padding.

## Layout

Bottom bar shows 5 items plus a More menu:

```text
[ Entries ] [ Payout ] [ Receipts ] [ Workers ] [ Sites ] [ More ]
```

More opens a sheet/popover containing Audit Log and Settings. Selecting either switches the active tab and marks More as active while one of those tabs is showing.

Icons: Clock (Entries), DollarSign (Payout), Receipt (Receipts), Users (Workers), MapPin (Sites), MoreHorizontal (More); Settings and ShieldCheck inside the More sheet.

## Changes

- New `src/components/admin/AdminBottomNav.tsx` — the docked nav, driven by the existing `activeTab` / `setActiveTab` state, matching `LedgerBottomNav`'s markup and sizing.
- `src/components/admin/AdminApp.tsx` — remove the `TabsList` / `TabsTrigger` strip and its scroll-fade overlay; render `AdminBottomNav` after the tab panels. Keep `Tabs`, `TabsContent`, and the existing swipe navigation untouched, so swipe order still follows `ADMIN_TABS`. Add bottom padding to the content container so the last rows clear the nav.
- `src/styles.css` — add Clockwise equivalents of the `.l-nav` / `.l-nav-item--active` rules using the app's existing semantic tokens (primary tint for the active pill), scoped so they don't affect `.ledger-scope`.

The top `AppSwitcherBar` (Clockwise / Ledger toggle + Sign out) stays where it is.

## Notes

Worker app tabs are not touched; this covers the admin dashboard tabs only.

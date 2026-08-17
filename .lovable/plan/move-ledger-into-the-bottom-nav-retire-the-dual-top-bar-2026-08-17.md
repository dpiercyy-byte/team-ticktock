# Move Ledger into the bottom nav, retire the dual top bar

## What changes

**Admin (Clockwise) bottom nav** becomes:

Entries · Payouts · Receipts · **Ledger** · More

- The Workers slot is replaced by **Ledger**, which navigates to `/ledger`.
- **Workers** and **Sites** move into the **More** menu, alongside Audit Log and Settings.
- The dual Clockwise/Ledger top bar is removed from the admin dashboard.
- Sign out moves into the More menu (bottom item) so it stays reachable.

**Ledger** keeps its nav (Jobs · Pipeline · Calendar · People · More) and also loses the top bar. Its **More** screen gains a **Clockwise** link back to the admin dashboard, plus **Sign out**, so the two apps stay connected without the top bar.

Nothing about data, permissions, or tab content changes — only navigation placement.

## Technical notes

- `src/components/admin/AdminBottomNav.tsx`: MAIN becomes entries, payouts, receipts, ledger, More; the ledger item renders a router `Link to="/ledger"` instead of a tab button (icon `BookOpen`). MORE becomes workers, sites, audit, settings, plus a sign-out row; accept an `onLogout` prop.
- `src/components/admin/AdminApp.tsx`: drop `<AppSwitcherBar />`, pass `onLogout` to `AdminBottomNav`. Keep all `TabsContent` panels; `ADMIN_TABS` swipe order updates to the four remaining swipeable main tabs (workers/sites still selectable from More).
- `src/routes/ledger.tsx`: drop `<AppSwitcherBar />`.
- `src/routes/ledger.more.tsx`: add a Clockwise link (`/admin` when an admin token exists, else `/`) and a Sign out action using `clearAdminToken`/`clearWorkerSession`.
- `src/components/AppSwitcherBar.tsx` becomes unused and is deleted.
- Existing tap-target baselines for admin screens will shift; regenerate the affected ones.

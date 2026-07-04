## Goal
Replace the "Choose an app" screen with a persistent full-width top strip that toggles between Clockwise and Ledger. Logging in as admin (or worker) lands directly on Clockwise.

## Changes

### 1. New component: `src/components/AppSwitcherBar.tsx`
A full-width, sticky top strip split into two equal halves:
- Left half → Clockwise (links to `/admin` for admin, `/` for worker)
- Right half → Ledger (`/ledger`)
- Active half: dark background (`bg-slate-900 text-white`), inactive: light (`bg-white text-slate-600 hover:bg-slate-50`)
- Includes a small sign-out button on the far right (icon-only on mobile) so users don't lose the logout that lived on `/apps`
- Detects active app from `useRouterState().location.pathname` (starts with `/ledger` → Ledger active, else Clockwise)

### 2. Mount the bar
Render `<AppSwitcherBar />` at the top of:
- `src/components/admin/AdminApp.tsx`
- `src/components/worker/WorkerApp.tsx` (only when a worker session exists — keep the login screen clean)
- `src/routes/ledger.tsx` (above `<LedgerHeader />`; consider removing the "Apps" back-link from `LedgerHeader` since the strip replaces it)

### 3. Remove the apps chooser
- Delete `src/routes/apps.tsx`
- Update post-login redirects to skip `/apps`:
  - Admin login → `/admin`
  - Worker login → `/` (already the worker app)
  - Ledger login flow → `/ledger`
- Search for any `navigate({ to: "/apps" })` / `<Link to="/apps">` references and repoint them (e.g. the "Apps" back link in `LedgerHeader.tsx` — remove it, since the strip covers navigation).

### 4. Keep behavior identical otherwise
No business logic, auth, or data changes. Only presentation + routing redirects.

## Open question
When a **worker** (non-admin) is signed in, should the Ledger half be:
- (a) Hidden entirely (workers only see Clockwise, no strip needed), or
- (b) Visible but disabled/greyed, or
- (c) Visible and clickable (Ledger enforces its own auth)?

Default assumption: **(a)** — hide the strip for workers so their mobile view stays uncluttered; show the strip only for admins. Let me know if you'd prefer (b) or (c).

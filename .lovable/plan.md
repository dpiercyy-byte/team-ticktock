# Payout tabs match the bottom bar + faint blue fill on chosen tab

## What changes
1. **Chosen tab gets a faint blue fill** — in the bottom bar (Entries, Payout, Receipts, Schedule, More), the tab you're on gets a light blue background inside its blue outline instead of white.
2. **Payout's Pending / Weekly / Lifetime tabs restyled** to match the bottom bar:
   - Each tab gets the same faint outline and rounded shape.
   - On a computer, hovering glows the outline slightly.
   - The chosen tab has the blue outline, faint blue fill, and a small "puff up" when picked.
   - Tab order and default (Pending first) stay the same. Nothing else on the page changes.

## Technical details
- `src/styles.css`: add `background-color: color-mix(in oklab, var(--primary) 8%, transparent)` to `.c-nav-tab--active`; add `.c-subtab` variant reusing the same hover/active/inflate rules, triggered via `[data-state=active]` (Radix Tabs) with smaller scale (~1.04) so it fits inline.
- `src/components/admin/AdminApp.tsx` (~line 2325): give the Payout `TabsList` a transparent background with gap, and each `TabsTrigger` the `c-subtab` class with `rounded-2xl border border-border/50`. Shared `Tabs` component untouched so other tabs in the app don't change.

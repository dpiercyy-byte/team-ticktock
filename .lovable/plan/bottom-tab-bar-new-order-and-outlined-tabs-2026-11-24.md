# Bottom tab bar: new order and outlined tabs

## Tab order
Bottom bar: **Entries, Payout, Receipts, Schedule, More**.
More menu: Job Sites, Workers, Audit Log, Settings, Ledger, Sign out.

## Look
- Every bottom tab sits inside its own faint rounded outline.
- **Desktop:** when the mouse is over a tab, the outline and background get slightly brighter (soft blue glow).
- **Phone:** the tab you're on is a little bigger than the others (about 6%), with a slightly stronger outline. Switching tabs gives a short, springy "puff up" so it's easy to see where you are.
- The More button gets the same outline. When you're on a page inside More, More shows the puffed-up look.

## Technical details
- `AdminBottomNav.tsx`: change the MAIN and MORE arrays, and give each item `border border-border/50 rounded-2xl` plus a `c-nav-tab` class.
- `styles.css`: add `.c-nav-tab` with transitions, a `@media (hover:hover)` hover rule (border-primary/40 + faint primary background/shadow), and an active rule `transform: scale(1.06)` with a keyframe "inflate" animation. Uses theme colors only, and respects reduced-motion.
- `AdminApp.tsx`: change the `ADMIN_TABS` order to match.

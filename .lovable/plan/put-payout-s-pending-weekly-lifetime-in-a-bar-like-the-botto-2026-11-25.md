# Put Payout's Pending / Weekly / Lifetime in a bar like the bottom menu

## What changes
- The three Payout tabs sit inside a bar that looks like the bottom menu: a soft off-white background, a thin border, and a faint shadow, so it stands apart from the payout list below.
- The bar stretches across the top of the Payout page, and the three tabs share its width evenly.
- The tabs keep their current look: faint outline, hover glow, and blue fill and puff when chosen.
- Nothing else on the Payout page changes.

## Technical details
- `src/styles.css`: add a `.c-subnav` class with the same background mix as `.c-nav`, `1px solid var(--border)`, `rounded-2xl`, and a soft downward shadow.
- `src/components/admin/AdminApp.tsx` (Payout `TabsList`): add `c-subnav grid w-full grid-cols-3 p-1.5`, and keep the triggers' `c-subtab` classes.

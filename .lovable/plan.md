# Bringing Ledger's look to Clockwise

## What I found

Ledger's entire visual identity lives in **one place**: a `.ledger-scope` block in `src/styles.css` (~340 lines). Every rule is namespaced under that class, so nothing about Ledger currently leaks into Clockwise — and nothing in Clockwise depends on it.

The pieces that make Ledger feel the way it does:

- **Typography** — Bricolage Grotesque for headings, Manrope for body, tight letter-spacing (-0.01em body, -0.03em headings), tabular numerals for figures. Both fonts are already loaded globally in the root route, so Clockwise can use them today at zero cost.
- **Surfaces** — two card treatments (`l-sheet` 28px radius, `l-card` 20px radius) with soft layered shadows instead of borders, plus a subtle press-scale on tap.
- **Small parts** — status chips (`l-chip`), uniform trade pills (`l-pill`, fixed 32px height so wording length doesn't shift the row), an uppercase tracked eyebrow label, rounded soft inputs, and segmented controls.
- **Palette** — warm off-white background with a terracotta accent. This is the part we're *not* taking; Clockwise keeps its blue.

**Feasibility: low risk.** Clockwise has only ~6 hardcoded color utility spots to check, no conflicting global styles, and the change is purely presentational — no data, auth, or server code is touched.

## The plan

**1. Create a shared surface layer**
Extract the font, radius, shadow, chip, pill, eyebrow and input rules from `.ledger-scope` into a neutral `.cw-scope` block in `src/styles.css`. Colors stay tied to Clockwise's existing semantic tokens (primary blue, background, border) — only the *shape, type, and depth* come from Ledger. Ledger's own scope is untouched and keeps working exactly as it does now.

**2. Apply it in two spots**
Add the scope class to the admin shell and the worker shell wrappers. That single class propagates the new look through every tab, dialog, and card underneath.

**3. Adopt the surfaces where it counts**
- Stat cards, entry rows, receipt cards, worker/site cards → Ledger's shadow-and-radius card instead of bordered boxes
- Status/state labels → the chip treatment
- Filter and toggle groups → the soft segmented control
- Dollar and hour figures → tabular numerals so columns line up
- Search and select inputs → rounded soft inputs

**4. Reversibility**
The whole thing is gated on one class name. Removing it from the two shell files restores today's appearance instantly — no other file needs reverting.

## What stays the same

- Clockwise's blue accent and all semantic color tokens
- Every layout, tab order, and workflow
- All backend, auth, sync, and export behavior
- Ledger itself — completely unchanged

## Technical notes

New `.cw-scope` block in `src/styles.css` mirroring the structural half of `.ledger-scope`, using `var(--primary)` / `var(--border)` rather than the `--l-*` warm tokens. Applied at the root `div` of `src/components/admin/AdminApp.tsx` and `src/components/worker/WorkerApp.tsx`. The handful of hardcoded `bg-gray-*` / `bg-slate-*` utilities in `AdminApp.tsx` get swapped for semantic equivalents so the scope applies cleanly. `AdminBottomNav.tsx` already mirrors Ledger's footer nav and needs no change. Fonts require no new loading. Verified with a typecheck and a preview pass over both admin and worker screens.

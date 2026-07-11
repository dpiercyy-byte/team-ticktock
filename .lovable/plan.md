## Goal
Replace the current fade+nudge tab transition with a true finger-following carousel: as you drag, the current tab moves with your finger and the neighboring tab peeks in from the edge; release snaps to the next tab (or back) based on distance and velocity.

## Approach

Rewrite `src/components/ui/swipeable-tabs.tsx` around a single horizontal track that holds three lanes — previous / current / next — and translates in real time under the finger. No new dependency; `react-swipeable` is replaced with native pointer events so we can read live delta, not just an end gesture.

### 1. Carousel container
New `SwipeCarousel` component:
- Props: `items: readonly string[]`, `current: string`, `onChange(next)`, `renderPanel(key) => ReactNode`.
- Layout: outer `overflow-hidden`, inner track `flex` with three absolutely-sized lanes at `100%` width each, translated via `transform: translate3d(...)`.
- Renders only prev / current / next (or nulls at the ends) — cheap, keeps DOM small.

### 2. Live drag tracking
Native `pointerdown` / `pointermove` / `pointerup` on the track:
- On `pointerdown`: capture start X/Y, mark axis undecided.
- On first `pointermove`: if `|dx| > |dy|` and `|dx| > 6px`, lock to horizontal, `setPointerCapture`, disable transitions, prevent vertical scroll hijack. Otherwise release and let the page scroll.
- While dragging: set `translateX = -currentIndex * width + dx`. Rubber-band (`dx * 0.35`) when at the first tab dragging right or last tab dragging left.
- Respect `data-swipe-ignore` — if the gesture starts inside one of those scrollers, bail out (same rule that already protects nested horizontal lists).

### 3. Release physics
On `pointerup` / `pointercancel`:
- Commit if `|dx| > width * 0.25` OR `|velocity| > 0.5 px/ms` in a valid direction.
- Re-enable a short `transform 260ms cubic-bezier(0.22, 1, 0.36, 1)` transition, translate to the committed lane, then call `onChange(nextKey)`.
- If not committed, animate back to the current lane.
- After the transition ends, snap the track back to the middle lane (no visible jump) so prev/current/next stay centered for the next drag.

### 4. Click-driven changes
When `current` changes from outside the drag (tab pill click, route push), animate the track from its current offset to the new lane using the same easing so click and swipe feel identical.

### 5. Wire-up
- `src/routes/ledger.tsx`: replace the `useSwipeableTabs` + `SwipeTabPanel` pair with `<SwipeCarousel items={LEDGER_TABS} current={location.pathname} onChange={(to) => navigate({ to })} renderPanel={(key) => key === location.pathname ? <Outlet /> : null}>`. For non-active lanes we render a lightweight placeholder (empty div) — TanStack owns the actual route content, so only the active lane shows real data; the neighbor lanes show a blurred/blank surface during the drag, which is standard carousel behavior when panels are route-owned.
- `src/components/admin/AdminApp.tsx`: same swap, but here we control all tab bodies so `renderPanel` returns the real content for prev/current/next — full peek-in effect.

### 6. Ledger caveat & fallback
Because TanStack Router only mounts the active route, Ledger's neighboring lanes can't show real content mid-drag. Two options:
- **A (default in this plan):** neighbor lanes render an empty surface (`bg-slate-50`) during drag; content appears when the route commits. Cheap, no route changes.
- **B (optional, not in this plan unless you want it):** pre-render Ledger sub-tabs as internal components inside `ledger.tsx` instead of child routes, so all three lanes have live content like AdminApp does.

Admin (option A/B not needed — content is already local) gets the full effect either way.

### 7. Styles & accessibility
- Delete `.swipe-panel--forward` / `--back` keyframes from `src/styles.css`; add a `.swipe-carousel-track` transition class instead.
- Keep `@media (prefers-reduced-motion: reduce)`: disable the release transition, still allow the drag to follow the finger but snap instantly on release.
- Preserve `touch-action: pan-y` on the outer container so vertical scroll works until horizontal is locked.

## Files touched
- `src/components/ui/swipeable-tabs.tsx` — replace with `SwipeCarousel` (pointer-event based, live drag).
- `src/styles.css` — swap the two swipe keyframes for a single track transition class + reduced-motion guard.
- `src/components/admin/AdminApp.tsx` — use `SwipeCarousel` with real prev/current/next content.
- `src/routes/ledger.tsx` — use `SwipeCarousel` with `<Outlet />` in the active lane.

## Not changing
- Tab structure, routes, or `data-swipe-ignore` opt-outs.
- Desktop click behavior (still animates via the same track, just triggered by click).
- Any business logic, data fetching, or backend code.

## Verification
- Drag slowly on mobile: current tab follows finger, next/prev peeks in from the opposite edge.
- Short flick past ~25% or fast velocity → commits to next tab.
- Small drag → springs back, no tab change.
- Drag at first/last tab beyond the edge → rubber-bands, releases back.
- Vertical scroll inside a tab still works; horizontal scrollers marked `data-swipe-ignore` still scroll horizontally.
- Reduced-motion OS setting → drag still follows finger, release snaps instantly.

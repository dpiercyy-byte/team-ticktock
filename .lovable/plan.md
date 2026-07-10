## Goal
Replace the abrupt tab swap with a smooth slide/fade transition when swiping between tabs on mobile (both Clockwise admin and Ledger).

## Approach

Use a lightweight CSS-based transition keyed on the active tab/route, so the outgoing panel slides/fades out and the incoming one slides in from the swipe direction. No new heavy dependency — Framer Motion is not needed; we can use CSS `@keyframes` already in `src/styles.css` plus a directional class toggled by the swipe handler.

### 1. Track swipe direction
Extend `useSwipeableTabs` in `src/components/ui/swipeable-tabs.tsx` to expose the last transition direction (`"left" | "right"`) alongside the current value. When `onChange` fires from a swipe, record which way it went; when the change comes from a tab click, default to a neutral fade.

### 2. Animated panel wrapper
Add a `SwipeTabPanel` component (same file) that:
- Accepts a `key` (active tab id) and `direction`.
- Wraps children in a div that applies one of two new keyframe animations (`slide-in-left`, `slide-in-right`) on mount, plus a subtle fade. Re-mounts on key change so the animation replays.
- Duration ~220ms, `cubic-bezier(0.4, 0, 0.2, 1)` to match existing motion tokens.

Add the keyframes to `src/styles.css` (alongside existing `slide-in-right` — we'll add `slide-in-left` and reuse the fade timing).

### 3. Wire it in
- **Clockwise admin** (`src/components/admin/AdminApp.tsx`): wrap each `TabsContent` body (or a single wrapper around the switched content) with `SwipeTabPanel` keyed on the active tab value.
- **Ledger** (`src/routes/ledger.tsx`): wrap `<Outlet />` in `SwipeTabPanel` keyed on `location.pathname`, using the direction from `useSwipeableTabs`.

### 4. Respect reduced motion
Guard the animation with `@media (prefers-reduced-motion: reduce)` in `styles.css` so it collapses to an instant change for users who opt out.

## Files touched
- `src/components/ui/swipeable-tabs.tsx` — expose direction, add `SwipeTabPanel`.
- `src/styles.css` — add `slide-in-left` keyframe + reduced-motion guard.
- `src/components/admin/AdminApp.tsx` — wrap tab content with `SwipeTabPanel`.
- `src/routes/ledger.tsx` — wrap `<Outlet />` with `SwipeTabPanel`.

## Not changing
- Tab structure, routes, or swipe boundaries (`data-swipe-ignore` scrollers stay as-is).
- Desktop behavior — the same subtle transition applies on click but is short enough to feel snappy.

## Verification
- On mobile viewport, swipe left/right between Clockwise tabs → new tab slides in from the swipe direction.
- Same in Ledger.
- Clicking a tab → gentle fade, no jarring jump.
- With reduced-motion enabled at the OS level → instant swap, no animation.

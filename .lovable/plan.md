## Plan: Swipe Navigation Between Main Tabs

### Goal
Let users switch between main tabs in both Clockwise admin and Ledger by swiping left/right anywhere on the page, including the tab bar. Use `react-swipeable` for reliable gesture detection.

### Scope
- Clockwise admin tabs: Time Entries → Payout → Receipts → Workers → Job Sites → Audit Log → Settings.
- Ledger tabs: Executive → Active → Closed → Sync.
- Whole-page swipe zone, including the tab bar.

### Implementation Steps

1. **Install dependency**
   - `bun add react-swipeable`.

2. **Create a reusable swipeable-tabs wrapper**
   - New file: `src/components/ui/swipeable-tabs.tsx`.
   - Wraps the shadcn `Tabs` component and accepts:
     - `tabs`: ordered list of tab values.
     - `value` / `onValueChange`: controlled tab state.
     - `children`: `TabsList` + `TabsContent` blocks.
   - Uses `useSwipeable` on a full-page container with:
     - `trackMouse: false` (touch only).
     - `delta: 60` (px) — enough to avoid accidental scroll triggers.
     - `preventScrollOnSwipe: false` for vertical swipes so page scrolling stays natural.
     - `onSwipedLeft`: move to next tab.
     - `onSwipedRight`: move to previous tab.
   - Adds a subtle `translateX` + `opacity` animation on the active `TabsContent` so the page appears to slide with the swipe.

3. **Integrate into Clockwise admin (`AdminApp.tsx`)**
   - Convert the existing uncontrolled `Tabs defaultValue="entries"` to controlled `Tabs value={activeTab} onValueChange={setActiveTab}`.
   - Wrap the `Tabs` component with `SwipeableTabs`, passing the ordered tab values.
   - Keep the existing tab list styling; the swipe container sits around the whole page content.

4. **Integrate into Ledger (`LedgerHeader.tsx` + `ledger.tsx` layout)**
   - Ledger currently uses `Link` navigation in `LedgerHeader`. Convert it to a controlled tab-like state or keep route-based navigation and map swipe to `navigate()`.
   - Recommended approach: keep route-based navigation (each tab is its own route) and use `useSwipeable` in the Ledger layout to call `navigate({ to: nextTab })` on swipe.
   - Update `LedgerHeader` so the active pill still reflects the current route.

5. **Handle the tab-bar horizontal-scroll conflict**
   - The Clockwise admin tab list currently uses `overflow-x-auto` and scrolls horizontally on narrow screens.
   - With whole-page swipe enabled, swiping on the tab bar would normally scroll the tab list instead of switching tabs.
   - Mitigation options (pick one):
     - **Option A (recommended)**: Make the tab list non-scrollable — allow tabs to wrap to a second line on very small screens, or shrink font/padding so all tabs fit.
     - **Option B**: Detect scroll boundaries inside the swipe handler — only allow tab switch when the tab bar is scrolled fully to the left/right edge. This is more complex and can feel inconsistent.
   - The plan will start with Option A for simplicity; if wrapping looks bad, we can switch to Option B.

6. **Protect internal horizontal scrollers**
   - Add a guard in the swipe handler: if the touch starts inside an element with horizontal overflow (`scrollWidth > clientWidth`) and the user is scrolling it, do not switch tabs.
   - Apply this to known horizontal containers (e.g., wide tables, image galleries, the tab list if Option B is chosen).

7. **Visual polish**
   - Add a short CSS transition on `TabsContent` so the active panel slides in slightly from the swipe direction.
   - Keep it subtle — 150–200 ms, ease-out — so it doesn’t feel slow.

8. **Testing**
   - Verify on mobile viewport (≈ 400 px width).
   - Confirm vertical scrolling still works inside long lists.
   - Confirm dialogs, date pickers, and receipt upload dropzone are not broken by swipe.
   - Confirm the tab bar still works via tap.

### Technical Details
- **Controlled tabs**: shadcn `Tabs` supports `value` + `onValueChange`; we’ll use that so swipe can drive state.
- **Route-based Ledger tabs**: `useNavigate` from `@tanstack/react-router` will map swipe direction to the next/previous route in the `tabs` array.
- **react-swipeable config**: `trackTouch: true`, `trackMouse: false`, `delta: 60`, `preventScrollOnSwipe: false`, `swipeDuration: 500`.
- **Conflict guard**: `event.target.closest('[data-swipe-ignore]')` or a ref check on horizontally scrollable parents.

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Tab bar horizontal scroll conflicts with swipe | Make tab list wrap or shrink; or add scroll-boundary detection. |
| Accidental tab switches while scrolling vertically | Use `delta` threshold and `preventScrollOnSwipe: false`; require mostly horizontal movement. |
| Internal carousels/drawers break | Mark those containers with a data attribute the swipe hook ignores. |
| Route-based Ledger tabs flash on swipe | Preload adjacent routes and keep animation subtle. |

### Deliverables
- `src/components/ui/swipeable-tabs.tsx` (reusable wrapper)
- Updated `src/components/admin/AdminApp.tsx`
- Updated `src/components/ledger/LedgerHeader.tsx` and `src/routes/ledger.tsx`
- Optional tab-list wrapping adjustment in `AdminApp.tsx`

Does this plan look good? If you approve, I’ll implement it.
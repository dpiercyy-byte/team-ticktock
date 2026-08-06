# Fix: payout list hidden behind the bottom tab bar on iPhone

## Why it happens

The admin screen reserves a fixed 96px of empty space at the bottom of the page (`pb-24`) so content can scroll clear of the floating tab bar.

Measured in the preview, the tab bar is already ~76px tall with no home-indicator inset. On an iPhone 17 in Safari, the bar additionally pads itself by the home-indicator safe area (~34px), making it ~110px tall — taller than the 96px of space the page reserves. So the last ~15-25px of the Weekly payout list (the bottom of Edgardo's card / the last card in the list) sits underneath the bar.

The Weekly payout panel itself adds no bottom padding of its own, so it relies entirely on that too-small shell value. Some other tabs (e.g. Receipts) happen to add their own `pb-24`, which is why the problem shows up on payouts and not everywhere.

## The fix

- In the admin dashboard shell (`src/components/admin/AdminApp.tsx`), replace the fixed `pb-24` with a safe-area-aware value: `pb-[calc(env(safe-area-inset-bottom)+7.5rem)]`. That guarantees the reserved space always exceeds the real bar height on every device, including notch/home-indicator phones.
- Remove the now-redundant nested `pb-24` on inner tab panels that already sit inside the shell, so tabs don't get double padding and inconsistent spacing.
- Verify the Weekly payout list, Pending and Lifetime views all scroll fully clear of the bar at 393x852 (iPhone-class width).

## Scope

Presentation only — no changes to payout math, mark-paid flow, or Sheets export.

# Fix: expanding one payout card stretches its neighbour

## What's happening

The payout cards sit in a two-column grid. Grid items in the same row stretch to match the tallest one by default, so expanding one card makes the card beside it grow to the same height with empty space — nothing extra is actually rendered in it.

## Fix

In the payout cards grid in `src/components/admin/AdminApp.tsx` (the `grid gap-3 sm:gap-4 md:grid-cols-2` wrapper around the worker payout cards), add `items-start` so each card sizes to its own content. Cards then keep their collapsed height regardless of a neighbour being expanded.

No data, layout, or styling changes beyond that one class.

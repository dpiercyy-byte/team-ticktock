# Clearer day headers and line-style In/Out tags

## 1. Make the blue tint on day headers visible
The tint is there now, but it's so faint (about 7% blue) that it looks grey on a phone. Raise it to a clear light blue and add a thin blue line under the header so it reads as blue right away.

## 2. Replace In/Out pills with a vertical line
- Remove the pill outline around the In and Out tags.
- Each tag becomes: a short colored vertical line on the left, then "In · 19 Raeburn Ave" as plain text.
- Same height and left edge for both rows, whatever the address length. Long addresses run on (or wrap) instead of making the tag a different size.
- Colors stay the same: green line for verified, yellow for callback / off-site, blue for supplier, grey for no GPS / set tag.
- Tapping a tag still opens the same edit menu.

## Technical details
- `src/styles.css`: `.cw-day-head` tint 7% to about 14%, plus `border-bottom: 1px solid color-mix(primary 25%)`.
- `GeoTagEditor` in `AdminApp.tsx`: swap each `<Badge variant="outline">` trigger for a `span` like `inline-flex items-center gap-1.5 border-l-2 pl-2 text-[11px] leading-4` with `border-success` / `border-warning` / `border-primary` / `border-muted-foreground` and matching text color. Keep the icon, the prefix and the popover behavior.

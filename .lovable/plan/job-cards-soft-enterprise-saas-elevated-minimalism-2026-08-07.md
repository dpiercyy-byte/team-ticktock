# Job Cards — Soft Enterprise SaaS / Elevated Minimalism

Redesign the job cards on the Ledger main page (and anywhere JobCard is reused) into calm glass panels on a cool off-white canvas, and strip them down to the essentials.

## Visual direction

- Page canvas becomes a very soft, cool off-white (#F8FAFC) instead of the current warm cream, with the sticky search bar matching it so it blends while scrolling.
- Cards become translucent white glass: ~80% white fill, 12px backdrop blur, a 1px semi-transparent white edge, and a hyper-diffused shadow replacing the current one.
- Press state stays subtle (slight scale/opacity), no hard shadow jump.

## Card content

Kept:
- The Active/status pill, exactly as it is today.
- Budget amount, top right.
- Trade pills (unchanged styling).

Removed:
- The progress/journey bar.
- "N on site" / "No one on site" row.
- The "$X owing" / "Paid in full" amount.

Changed:
- The card title becomes the street number and name pulled from the job address (for example "148 Maple Ave"), instead of the job name.
- The client name and the full address sit under it in a muted, soft gray; the address keeps its pin icon.

## Typography and spacing

- Inner padding increases so cards feel spacious (roughly 20px mobile / 24px desktop).
- Title: dark slate gray, crisp, semi-bold, slightly tighter tracking.
- Client name and address: muted soft gray, smaller, with a little more breathing room between lines.

## Technical notes

- `src/styles.css`: in the `.ledger-scope` token block set `--l-bg` to the cool off-white and add glass tokens; rewrite `.ledger-scope .l-card` with `background: rgba(255,255,255,0.8)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255,255,255,0.6)`, and `box-shadow: 0 10px 40px -10px rgba(0,0,0,0.04), 0 4px 6px -2px rgba(0,0,0,0.01)`. Only the standard `backdrop-filter` property is written (no `-webkit-` twin). Also retune `--l-surface-2`, `--l-line`, and `.l-sticky-search` so the cool palette stays consistent.
- `src/components/ledger/JobCard.tsx`: drop the `JobJourney`, workers-on-site, and owing blocks; add a small `streetLine(address)` helper that takes the portion of the address before the first comma (falling back to the job name when the address is empty) and renders it as the heading.
- `JobJourney` stays in the codebase for the job detail page; only the card usage is removed.

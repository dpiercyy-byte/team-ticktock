# Mirror the entries status styling on payout cards

## Current state

- Entries tab worker cards use a full status treatment: a 3px coloured left bar **plus** a very light tint of that same colour across the card (green paid / amber unpaid / red overdue).
- Weekly payout cards already have a coloured left bar (green when paid, amber when owing) but **no tint**, so they read as plainer than the entries cards.
- Lifetime payout cards have no bar and no tint at all.

## Changes

1. **Weekly payout cards** — keep the existing green/amber left bar and add the matching soft tint (same 4% colour mix used in Entries) so the whole card carries the status colour, exactly like the entries cards.
2. **Lifetime payout cards** — add the same left bar treatment, using green (all-time earnings are cash already accounted for) so the payout section looks consistent across both tabs.
3. **Pending payouts list** — already uses the coloured bar; add the matching tint so all three payout surfaces share one visual language.

No changes to data, totals, or logic — presentation only.

## Technical notes

- Edits are confined to `src/components/admin/AdminApp.tsx`.
- Reuse the existing token pattern: `border-l-4 border-l-[var(--success|warning|destructive)]` with `bg-[color-mix(in_oklab,var(--...)_4%,transparent)]`; no hardcoded colours.

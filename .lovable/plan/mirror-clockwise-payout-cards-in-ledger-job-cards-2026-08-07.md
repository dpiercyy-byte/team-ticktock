# Mirror Clockwise payout cards in Ledger job cards

Ledger job cards currently use the glass treatment (translucent surface, blur, hairline white edge). Clockwise payout cards are opaque cards with a soft shadow, an avatar circle, a status pill, a values body, and a tinted footer strip. Ledger will adopt that anatomy exactly.

## New job card anatomy

```text
┌ green/amber left accent bar ─────────────────────┐
│ (AB)  123 Maple Street            [ Reimb-slot ] │  header
│       ● Active   pill                            │
├──────────────────────────────────────────────────┤
│ Client            Acme Renovations               │  body rows
│ Address           123 Maple St, Toronto          │
│ Trades            Framing · Drywall  +2           │
├──────────────────────────────────────────────────┤
│ Budget                              $48,500      │  footer strip
└──────────────────────────────────────────────────┘
```

- Header: initials avatar (from the street name), street number + street name as the bold title, status pill underneath (green tinted for Active, amber for everything else).
- Body: label/value rows in the Clockwise payout style (medium label, muted sub-line, right-aligned tabular value).
- Footer: muted tinted strip with a top border showing Budget in bold success-colored tabular numerals; hidden when budget is 0.
- Left accent bar and 4% tint retained: green for Active, amber otherwise.

## Technical notes

- Rewrite `src/components/ledger/JobCard.tsx` to use the shadcn `Card`/`CardHeader`/`CardContent` structure with the same class recipe as the payout cards in `src/components/admin/AdminApp.tsx` (~line 2084), wrapped in the existing `Link`.
- Drop `l-card`, `l-pill`, and `l-muted` from the card in favour of Clockwise equivalents; add a `cw-scope`-equivalent surface for Ledger so `--cw-radius-card`/`--cw-shadow-card` apply. Simplest path: add a `.ledger-scope .l-card--cw` rule in `src/styles.css` that mirrors `.cw-scope .cw-card` (opaque `var(--card)`, 18px radius, Clockwise shadow, no blur, no glass edge) and use it on the job card.
- Keep the `compact` prop behaviour (compact hides the trades row).
- No data, routing, or query changes.

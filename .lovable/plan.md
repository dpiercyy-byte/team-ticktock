# Collapsible worker payout cards

Turn each worker card on the Payout → Weekly tab into a card that is condensed by default and expands on click.

## Condensed view (default)

- Worker initials + name
- Status pill:
  - Paid: green pill reading `Paid on MM/DD/YYYY` using the actual paid date
  - Unpaid (with a balance): existing amber "Unpaid" pill
- Two totals side by side, both in green:
  - **Total owed** — the computed amount (labour + reimbursements)
  - **Total cash paid** — what was actually handed over, tip included. Shown only when the week is marked paid; otherwise a dash.
- A chevron indicating the card can be opened.

## Expanded view

Everything the card shows today, unchanged:

- Labour line (hours × rate) and its amount
- Reimbursements line, count, and the itemised list
- Tip / short pill when the cash paid differs from the owed amount
- "Reimb." add button
- Footer with Total owed and the Mark paid / Mark unpaid button

## Technical notes

- Change is confined to the weekly payout card block in `src/components/admin/AdminApp.tsx`; no server or data changes.
- "Total cash paid" uses the existing `actualPaid` field, which already equals amount + tip; no recalculation needed.
- Expansion state is local per card (a set of expanded worker ids), collapsed on load and when the week changes.
- Header stays clickable as a button for keyboard/touch accessibility; the "Reimb." and Mark paid buttons stop click propagation so they don't toggle the card.
- Paid date formatted `MM/DD/YYYY` from `paidAt`.
- Pending and Lifetime tabs are untouched.
- Visual regression tap baselines for `admin-payout-*` will need refreshing since collapsed cards expose fewer buttons.

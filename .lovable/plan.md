## Goal
Make Weekly Payouts feel like the rest of the admin app — each worker as its own self-contained card with clear hierarchy — instead of a flat divided list where every row blends into the next.

## Current problem
`PayoutsTab` renders all workers as `<li>` rows inside one shared `Card` separated only by hairline dividers. Labour, reimbursement count, sub-list of reimbursements, and total are all stacked as plain text rows, which makes the section read as one long unsightly block with no visual isolation between workers.

## Redesign (frontend only, `src/components/admin/AdminApp.tsx` ~lines 805–852)

Replace the single divided `<ul>` with a responsive **grid of worker cards** (1 col mobile, 2 col `md`, matching the spacing language used elsewhere in the admin app).

Each worker card:

```text
┌─────────────────────────────────────────────┐
│  ⬤  Jane Doe                    [+ Reimb.]  │  ← header: avatar initials + name + action
├─────────────────────────────────────────────┤
│  Labour              32.50 hrs × $28.00     │  ← muted label row
│                                  $910.00    │  ← right-aligned tabular amount
│  Reimbursements                  3 items    │
│                                   $84.20    │
│   • Gas — Shell                    $42.10   │  ← collapsible / subtle inset list
│   • Lunch w/ client                $42.10   │
├─────────────────────────────────────────────┤
│  Total owed                       $994.20   │  ← emphasized footer strip
└─────────────────────────────────────────────┘
```

Concretely:
- Wrap each worker in its own `<Card>` (same component used in Entries/Workers tabs) instead of `<li>` inside a shared card.
- `CardHeader`: initials badge (rounded circle, `bg-secondary text-secondary-foreground`) + worker name (`text-base font-semibold`) on the left; `Reimb.` button on the right.
- `CardContent`: two stat rows for Labour and Reimbursements using the existing label/value pattern — muted left label, large tabular right value. Reimbursement sub-list stays but rendered as a subtle inset block (`bg-muted/40 rounded-md p-2 text-xs`) instead of a left-border list, so it visually nests inside the card.
- Footer strip: a full-width band (`bg-muted/60 border-t -mx-6 px-6 py-3`) with "Total owed" left, bold amount right — gives each card a clear terminal accent that matches how summary totals are shown elsewhere.
- Empty state: keep the "No workers yet." message but render it inside a single dashed-border placeholder card to match other empty states.

## Out of scope
- No business-logic, data, or server-function changes.
- No changes to the reimbursement dialog or receipt viewer.
- No new design tokens; reuse existing semantic tokens (`muted`, `secondary`, `border`, `foreground`).

## Files touched
- `src/components/admin/AdminApp.tsx` — `PayoutsTab` render block only (lines ~805–852).

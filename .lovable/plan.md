## Goal
1. Replace the "Reimb" label with "Reimburse" in the time-entries stat row.
2. Make the "Total" stat card visually dominant over Hours / Wages / Reimburse without breaking the calm, unified card style.

## Changes

### 1. Label copy change
File: `src/components/admin/AdminApp.tsx` (line ~402)
```tsx
<Stat label="Reimburse" value={fmtMoney(weekReimb)} />
```

### 2. "Total" card visual emphasis — choose one direction

All options keep the same card component, padding, and border radius so the grid stays balanced. Only the **Total** card receives the treatment.

**Option A: Primary-tinted value (default recommendation)**
- Render the Total value in `text-primary`.
- Add a small `DollarSign` or `Sigma` icon in a `bg-primary/10 text-primary` chip beside the label.
- Keeps the card surface identical; the eye is drawn to the blue number.

**Option B: Soft left accent bar**
- Add a `border-l-4 border-primary` class to the Total card.
- Slightly tint the card background with `bg-primary/[0.03]`.
- Label stays muted; value stays default foreground. The accent bar signals "this is the summary."

**Option C: Elevated summary card**
- Apply a subtle shadow (`shadow-sm` or `shadow-md`) and a very light primary background tint.
- Increase the value size from `text-2xl` to `text-3xl` on the Total card only.
- Most prominent of the three, but still within the existing color system.

## Implementation notes
- The `Stat` component currently takes only `label` and `value`. To support the chosen option we will extend it with an optional `variant?: 'default' | 'total'` prop (or optional `icon` / `accent` props) and pass `variant="total"` only on the last `<Stat>`.
- No changes to data logic, layout grid, or other cards.
- After you pick an option, I will implement it and run the typecheck.
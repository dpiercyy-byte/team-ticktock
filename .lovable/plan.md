## Unify worker-name typography across admin tabs

Adopt the **Payout > Weekly** card treatment (`font-bold text-lg`) as the canonical style for every worker-name render in the admin UI. Apply it consistently in cards; in dropdown items use the same weight/family (`font-bold`) at the size that fits the trigger.

### Changes in `src/components/admin/AdminApp.tsx`

| Location | Line | Current | New |
|---|---|---|---|
| Payout > Weekly card name | 1177 | `font-bold text-lg` | unchanged (canonical) |
| Payout > Lifetime card name | 2472 | `font-semibold text-base` | `font-bold text-lg` |
| Workers tab card name | 790 | `font-semibold` | `font-bold text-lg` |
| Entries worker-select items | 343 | `font-bold text-sm` | `font-bold text-lg` |
| Receipts worker-filter select items | 1535 | (default) | wrap in `<span className="font-bold text-lg">` |
| Flagged-entries worker name | 315 | `font-medium` | `font-bold text-lg` |
| Reimbursement dialog titles | 1201, 1259, 844, 863 | default | leave (Dialog title component already has its own scale — outside "worker name" list context) |

All existing layout, truncation (`truncate`), and container widths stay the same. Only the class strings on the name element change.

No schema, server-function, or worker-side changes.

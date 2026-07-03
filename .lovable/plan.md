## Admin Tabs Styling Audit

Scope: `src/components/admin/AdminApp.tsx` — Time Entries, Payout, Receipts, Workers, Job Sites, Audit Log, Settings. Read-only audit; no code changes proposed here.

### 1. Top tab bar (consistent ✓)
`TabsTrigger` uses default shadcn styling across all 7 tabs. No drift.

### 2. Worker name typography (consistent ✓)
Recently unified to `font-bold text-lg` in: Entries selector, Receipts filter, Workers cards, Payout Weekly + Lifetime cards, Flagged worker row.

### 3. Card header patterns (inconsistent ⚠)
| Tab | Pattern |
|---|---|
| Payout Weekly | `CardHeader … py-4` + avatar + name |
| Payout Lifetime | `CardHeader … py-4` + name only (no avatar) |
| Workers | `CardHeader pb-3` + name |
| Settings | `CardHeader` (default) + `CardTitle` |
| Audit | `CardHeader` + `CardTitle` |
| Entries / Receipts | No CardHeader — content only |

Drift: Payout Lifetime cards lack the avatar that Payout Weekly and Workers use; header padding varies (`py-4` vs `pb-3` vs default).

### 4. Card body padding (inconsistent ⚠)
- Entries list: `p-0` (table-like)
- Receipts grid: `p-3 space-y-2.5`
- Payout Weekly: `pt-0 pb-4 space-y-3`
- Payout Lifetime: `pt-0 pb-4 space-y-3`
- Workers: `pt-0 gap-3`
- Weekly pending rows: `p-3 sm:p-4`

No single spacing scale — receipts and pending rows use `p-3`, payout uses `pb-4`, workers uses `pt-0` only.

### 5. Empty / loading states (mostly consistent ✓, one drift)
Most tabs: `Card` + `p-6` loading / `border-dashed p-10 text-center`. Entries tab loading state does not follow this — worth confirming.

### 6. Stat / KPI numbers (inconsistent ⚠)
- Entries stat cards: `text-2xl font-bold tabular-nums`
- Payout totals header: `text-2xl font-bold tabular-nums`
- Payout Lifetime per-card total: `text-base font-bold`
- Payout Weekly per-card total: `text-base font-bold`
- Weekly pending row total: `font-bold` (no size)

Per-card totals use `text-base` while headline totals use `text-2xl`; the pending row omits an explicit size class.

### 7. Section-level tabs (inconsistent ⚠)
Payout uses inner `TabsList` (Weekly / Pending / Lifetime). Job Sites detail dialog uses inner tabs (Paste / Search). Both use default styling — consistent with each other, but Receipts/Workers filter bars use plain flex rows rather than tabs for similar segmentation.

### 8. Selectors / filter controls (inconsistent ⚠)
- Entries worker selector: full-width `bg-gray-100 h-12 rounded-lg` (recently restyled)
- Receipts worker filter: standard shadcn `SelectTrigger` (small, bordered)
- Payout tabs: standard `TabsList`

The Entries selector is now visually distinct from every other filter in the admin.

### 9. Color accents (consistent ✓)
Warning uses `border-warning/40 bg-warning/5`. Status border-l accents on Payout weekly cards. No rogue hex values spotted.

---

### Suggested unification (optional next step — awaits your approval)

If you want me to fix these, a follow-up plan would:

1. Add avatar + matching `py-4` header to Payout Lifetime cards.
2. Standardize card body padding to one scale (proposal: header `py-4`, body `p-4 space-y-3`).
3. Bump per-card totals to `text-lg font-bold` and give pending-row total an explicit size.
4. Restyle Receipts worker filter to match the Entries `bg-gray-100 h-12` selector for cross-tab parity — or revert Entries selector to standard `SelectTrigger` if you prefer the shadcn look everywhere.
5. Give Entries a `CardHeader` for loading/empty parity with other tabs.

Tell me which of these to apply (all, some, or none) and I'll switch to build mode.

## Worker clock-in page UI polish

Tighten the visual hierarchy on the worker home screen so the page reads as one cohesive card-based flow.

### Changes (presentation only, in `src/components/worker/WorkerApp.tsx`)

1. **Bigger clock button**
   - Increase the Clock In / Clock Out circle from `h-40 w-40` to `h-56 w-56` (≈40% larger).
   - Bump label from `text-lg` to `text-xl` and keep the existing gradient / destructive styling, shadow, and active:scale press feedback.

2. **Verified-location bubble**
   - Wrap the `lastGeo` line in a pill-style card: rounded-full, `bg-card border border-border px-4 py-2 shadow-sm`, with the existing icon + colored text inside.
   - Same treatment (slightly different accent) for the "Heading to:" planned-job line so both location chips share one visual language.
   - Move the "Currently Working / project" block into a small centered stack that visually pairs with the bubble below the timer.

3. **Remove "Tap to refresh"**
   - Delete the button entirely. Auto-refresh already runs every 30s via `refetchInterval`. The pull-to-refresh behaviour on mobile remains.
   - Keep `isFetching` import only if still used; otherwise drop it from the `useQuery` destructure.

4. **Additional cohesion tweaks**
   - Tighten vertical rhythm: replace the page-level `gap-8` with `gap-6` and use consistent spacing between the status text, button, and location bubble.
   - Convert the "Add reason for off-site clock-in" link into a subtle warning-tinted pill (`bg-warning/10 text-warning rounded-full px-3 py-1.5`) so it matches the bubble language instead of looking like a stray underlined link.
   - Give the bottom Today / This Week strip a subtle top divider treatment using `bg-card` + soft inner padding so it feels like a summary card rather than a flat footer (no structural change, just spacing + a small `rounded-t-2xl` lift on mobile).

### Out of scope
- No backend, server function, or data changes.
- No changes to reimbursements section, dialogs, or admin views.
- No new colors — only existing semantic tokens (`--card`, `--border`, `--success`, `--warning`, `--primary`, `--muted-foreground`).

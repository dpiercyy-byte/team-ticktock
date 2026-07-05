## Goal
Soften the AppSwitcherBar toggle strip and remove the redundant "Clockwise Admin" header label.

## Changes

### 1. AppSwitcherBar visual refresh (`src/components/AppSwitcherBar.tsx`)
- Replace hardcoded `bg-slate-900` / `bg-white` with design-system semantic tokens
- Active half: `bg-primary text-primary-foreground` (soft medium-blue instead of harsh black)
- Inactive half: `bg-secondary text-secondary-foreground` (subtle gray-blue instead of flat white)
- Reduce height: from `h-11 sm:h-12` to `h-10 sm:h-11`
- Add rounded corners inside a padded container: wrap each half in `rounded-lg` or `rounded-full` pills with a small gap, giving a segmented-control feel instead of a solid bar
- Outer wrapper: keep `sticky top-0` but switch from `border-b border-slate-200 bg-white` to `bg-background border-b border-border` so it respects the theme
- Sign-out button: soften from `border-l border-slate-200` to `border-l border-border`, keep it subtle

### 2. Remove "Clockwise Admin" header (`src/components/admin/AdminApp.tsx`)
- Delete the `<h1 className="font-bold truncate">Clockwise Admin</h1>` element inside the dashboard header
- Keep the icon, session-expiry subtitle, and the rest of the header layout intact

## Result
The strip feels lighter, the active state uses the project's blue instead of black, edges are rounder/pill-shaped, and the admin page loses the duplicate "Clockwise" label since the strip already communicates the app name.
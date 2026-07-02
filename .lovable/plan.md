## Goal
Increase visual prominence of worker names in two admin UI locations for instant eye-seeking priority.

## Changes

### 1. Time Entries — Worker dropdown
In `AdminApp.tsx`, wrap worker-name `SelectItem` labels with a styled `<span>` (e.g. `font-bold text-sm`) so names stand out inside the dropdown list.

### 2. Payout tab — Worker cards  
In `AdminApp.tsx` payout card header (line ~1158), bump the worker name style from `font-semibold text-base` to `font-bold text-lg` (or `text-lg` if space is tight). Optionally enlarge the initials avatar slightly for proportional balance.

## Scope
- Only touches `src/components/admin/AdminApp.tsx` (presentation layer)
- No backend or logic changes
- ~5–8 lines of styling edits
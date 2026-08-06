# Ledger home: clean, search-first job list

Strip the Ledger home screen down to one thing: a sticky search bar and a scrollable list of Active job cards.

## What changes

**Removed from home**
- Greeting header block, stat strip (Active / Needs action / Total)
- Overdue tasks, Follow-ups, Pipeline chip row
- "On site now", "Requires action", "Outstanding" sections

These stay reachable elsewhere (Pipeline tab, Jobs tab, job detail) — nothing is deleted from the app, only from the home screen.

**Kept / added**
- Sticky search bar pinned at the top of the home screen, always visible while scrolling.
- Below it, a scrollable list of Active job cards (existing `JobCard`), one per row on mobile, two-up on wider screens.
- A small "New Job" action kept as a compact button next to the search bar so job creation isn't lost.

## Search behaviour

- Empty query: show Active jobs only (status Active or Scheduled).
- Typing: live-filters as you type across **all** jobs — name, client name, and address — so completed/past jobs surface when their address matches.
- Results grouped simply: matching active jobs first, then a subtle "Past jobs" divider with the remaining matches (Completed and other non-active statuses).
- No matches: a single quiet "No jobs match" line.

## Technical notes

- Only `src/routes/ledger.index.tsx` is rewritten; `JobCard`, `LedgerShell`, nav, and all data functions are untouched.
- Data comes from the existing `ledgerJobsQuery()`; the `todayQuery` and `overdueTasksQuery` calls are dropped from this route (still used by Pipeline/other routes).
- Sticky bar uses `sticky top-0 z-30` inside the shell with the existing `l-input` styling and a background so cards scroll under it cleanly.
- Filtering is local `useMemo` over the loaded jobs — no new server work.
- Home route `head()` metadata updated to match the new purpose.

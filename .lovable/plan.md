# Clockwise OS — Phase 1

Replace the current `/ledger` placeholder with a new admin-only experience built around a single primary object: **the Job**. Fully standalone this phase — no wiring into `job_sites` / `time_entries` yet.

## Design language

Calm, premium, focused. Inspired by Linear, Notion, Apple Health, Arc.
- Off-white canvas, subtle 1px borders, soft shadows, generous whitespace
- Bricolage Grotesque for display, Manrope for body (already loaded)
- Rounded-2xl cards, large touch targets, subtle spring-ish transitions
- Every screen answers "what's next?" — no dashboards, no tables

## Data model (new tables, standalone)

```text
clients            (name, email, phone, notes)
jobs               (client_id, name, address, lat, lng, project_type,
                    trades text[], status, budget_cents, progress,
                    archived_at)
job_events         (job_id, kind, title, body, meta jsonb, occurred_at)
                   -- append-only activity timeline
```

Budget/collected/expenses/profit are stored on `jobs` as cents for Phase 1 (manual entry only — later phases attach real receipts/payments). RLS: admin-only (session validated server-side via existing `requireAdmin` pattern; no per-user policies needed since admin uses HMAC token, not Supabase auth — table policies deny by default, all access via server functions using `supabaseAdmin` after admin token verification, matching how Clockwise already works).

## Routes (under existing /ledger tab, which we'll relabel "Jobs")

```text
/ledger                    -> Home (daily briefing)
/ledger/jobs               -> All jobs (card grid, not table)
/ledger/jobs/new           -> 5-step wizard
/ledger/jobs/$jobId        -> Job detail (the hero screen)
/ledger/calendar           -> Placeholder ("Coming in Phase 2")
/ledger/notifications      -> Placeholder
/ledger/profile            -> Placeholder
```

Top-level Clockwise/Ledger switcher stays. Inside `/ledger`, a bottom nav bar (mobile-first) with Home / Jobs / Calendar / Notifications / Profile.

## Screens

**Home** — daily briefing sections, each a horizontal row of cards:
- Today's Jobs · Estimates Waiting · Jobs Requiring Action · Recently Updated
- (Workers Clocked In / Payments Waiting shown as empty-state cards for Phase 1)
- Every card taps straight into the Job.

**New Job wizard** — one decision per screen, iOS-setup feel:
1. Client (existing dropdown / new inline form)
2. Address (Google Places autocomplete + static map preview — GOOGLE_MAPS keys already present)
3. Project type (large pill grid)
4. Trades (multi-select pills)
5. Status (single-select list)
Finish → creates job + seeds "Lead Created" event → routes to job detail.

**Job detail** — the source of truth:
- Header: name, client, address, status pill, progress bar
- Stat strip: Budget / Collected / Expenses / Profit / Workers on site
- Chronological event timeline (message-feed style cards)
- Floating "+ Add event" action to append timeline entries manually this phase

**Jobs index** — filterable card grid (status chips), no tables.

## Server functions (`src/lib/os/`)

- `clients.functions.ts` — list/create
- `jobs.functions.ts` — list, get, create, update, archive
- `jobEvents.functions.ts` — list, append
- `home.functions.ts` — briefing aggregator (one call, returns all home sections)

All gated by admin token via existing `requireAdmin` helper.

## Files

**Delete/replace:** `src/routes/ledger.tsx` (current placeholder)

**Create:**
- `src/routes/ledger.tsx` (layout with bottom nav + AppSwitcherBar)
- `src/routes/ledger/index.tsx` (Home)
- `src/routes/ledger/jobs.index.tsx`, `jobs.new.tsx`, `jobs.$jobId.tsx`
- `src/routes/ledger/calendar.tsx`, `notifications.tsx`, `profile.tsx`
- `src/components/os/` — BottomNav, JobCard, BriefingRow, TimelineEvent, StatusPill, StatChip, wizard steps, TradePill, AddressAutocomplete
- `src/lib/os/*.functions.ts` (above)
- One migration for `clients`, `jobs`, `job_events` (+ GRANTs + RLS + updated_at trigger)

**Update:** `src/components/AppSwitcherBar.tsx` — relabel "Ledger" → "Jobs" (icon: Briefcase). Two-tab layout unchanged.

## Explicitly out of scope this phase

Time tracking integration, receipts, real payments, estimating, invoicing, scheduling logic, worker-facing views, notifications delivery. Calendar/Notifications/Profile are placeholder shells so the nav feels complete.

## Deliverable this turn

1. Migration for the three new tables
2. All server functions
3. All routes + components above
4. AppSwitcherBar relabel
5. Build clean, /ledger opens to Home, wizard creates a Job, Job detail renders with a seeded timeline event.

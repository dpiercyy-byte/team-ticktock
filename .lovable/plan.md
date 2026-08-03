# Phase 2 — Owner/Admin CRM on the Phase 1 canonical structure

Builds a calm, mobile-first CRM inside Ledger. No worker-facing Clockwise changes, no Joist, no scheduling or job costing. The Clockwise/Ledger switcher stays.

## 1. Database (one forward-only migration)

Add to `ledger_jobs` (all nullable, no drops):
- `sales_stage_changed_at timestamptz` — backfilled to `updated_at` so "days in stage" works for existing rows.
- `next_action_status text default 'open'` — open / done, for follow-up completion.
- `next_action_owner text` — falls back to `assigned_owner` when unset.

Add to `clients`: nothing new (Phase 1 fields suffice).

Duplicate protection: a unique index on `lower(trim(name))` + `coalesce(lower(trim(email)),'')` for non-archived clients, so capitalization differences can never create a second client even under concurrent writes.

Indexes on `ledger_jobs(sales_stage)`, `ledger_jobs(next_action_due_at)`, `ledger_jobs(client_id)`.

## 2. Server functions (`src/lib/ledger.functions.ts` + new `crm.functions.ts`)

- `listPipeline` — all non-archived projects grouped by sales stage, returning card fields: client name, project type, property address, estimated value, assigned owner, next action, due date, days in stage.
- `moveProjectStage({ id, salesStage })` — single safe transition that: writes `sales_stage`, stamps `sales_stage_changed_at`, keeps `delivery_status`/legacy `status` in sync via the existing `ledger-stages` mapping, inserts a `stage` timeline event ("Moved from X to Y"), and writes a `logAudit` record with before/after so the previous value is preserved in the immutable audit log.
- `setNextAction({ id, nextAction, owner, dueAt })` and `completeNextAction({ id })` — each also creates a timeline event.
- `createLead(...)` — thin intake: client, contact info, property, project type, lead source, notes, owner, next action. Reuses `findOrCreateClient` / `findOrCreateProperty` (case-insensitive matching already implemented) and creates the project at stage "New Lead". No trades, money, or scheduling asked.
- `listClientsDirectory({ q, filter })` — search by name/phone/email, active|archived filter, with project counts, latest activity timestamp, and next required action per client.
- `getLedgerClient` — extend the existing function to also return open opportunities, active jobs, completed jobs, and recent timeline activity across the client's projects.
- `listTodayItems` — overdue and due-today follow-ups plus recent stage changes.

## 3. Screens (Ledger routes, existing visual language)

- `/ledger` (Today) — greeting header, then an "Overdue follow-ups" block first (red accent, count in the header), "Due today", and a compact recent-activity list. Overdue is the most prominent thing on the screen.
- `/ledger/pipeline` — horizontally-swipeable stage columns on mobile (stage chips row + one column at a time), multi-column on desktop. Each card shows the nine required fields; a card tap opens the project; a stage chevron/sheet on the card performs the move. Optimistic update, then cache invalidation.
- `/ledger/people` — client directory: search field, Active/Archived segmented filter, rows showing name, phone, email, project count, last activity, next action.
- `/ledger/people/$clientId` — client profile: contact info, notes, properties list, then sections for Open opportunities, Active jobs, Completed jobs, full project history, and recent activity. Projects link out; client contact details are shown only here, never duplicated inside a project screen.
- `/ledger/leads/new` — the calm intake flow: one question per step, fixed footer Continue button (existing `.l-wizard-footer` pattern), 7 short steps, targeted at under a minute. On submit it lands on the new project and it is immediately visible in the Pipeline.
- `/ledger/jobs/$jobId` — remove the duplicated client contact block, replacing it with a link to the client profile; add the next-action control (action, owner, due date, mark done) and show stage-change events in the timeline.

## 4. Navigation

`LedgerBottomNav` becomes: Today · Pipeline · Jobs · People · More. "More" is a sheet holding Calendar, Notifications, Profile, and a link back to the Clockwise admin tools. The Clockwise/Ledger switcher bar is untouched.

## 5. Testing

- Unit tests for stage-transition mapping + days-in-stage and next-action-status helpers (pure functions in `src/lib/ledger-stages.ts` / a new `crm-math.ts`).
- Playwright flow tests: lead intake creates one client + one property; a second lead with differently-capitalized client name reuses the same client; moving a stage records a timeline event; an overdue follow-up appears on Today.
- New visual baselines for Today, Pipeline, People, Client profile, Lead intake.
- Full `npm test` must stay green, all existing Clockwise baselines unchanged.

## Technical notes

Stage moves go through one server function so the sales/delivery/legacy-status triple can never drift. Audit history uses the existing append-only `public.audit_log` via `logAudit`, and the project timeline uses `ledger_job_events` — the canonical event structure chosen in Phase 1. All new tables/columns keep the deny-all RLS posture with service-role grants; reads happen through admin-token-guarded server functions exactly like the rest of Ledger.

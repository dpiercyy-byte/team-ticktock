# Phase 6 — Tasks, Checklists, and a Real Calendar

Give every project a reliable task list, ship two reusable checklist templates, surface overdue work on Today, and drive the calendar from real records instead of a single scheduled date.

## What gets built

### 1. Project tasks
A new tasks store attached to projects, with title, description, owner, due date, completion date, status, priority, trade, task type, and an optional dependency on another task.

- Statuses: Not Started, In Progress, Blocked, Completed, Cancelled
- Priorities: Low, Normal, High, Urgent
- Every task belongs to exactly one project; one responsible owner per task
- Owner is picked from the project's crew (Clockwise workers) or typed in as a name, matching how project owner already works today

### 2. Checklist templates
Two built-in templates, applied to a project on demand and never duplicated:

- **Accepted job (pre-construction)** — signed agreement, deposit, address and geofence, expected start window, project owner, initial crew, drawings, required selections, schedule initial trades, pre-start walkthrough
- **Closeout** — final walkthrough, record deficiencies, complete deficiencies, final payment, completion photos, warranty info, request client review, schedule warranty follow-up

Applying a template creates the missing tasks only; re-applying tops up rather than duplicating. Accepted/active projects get a one-tap "Generate pre-construction checklist" action; completing projects get the closeout one.

### 3. Tasks in the job workspace
A new **Tasks** tab in the job workspace:

- Grouped by Open / Overdue / Completed, sorted by due date then priority
- Quick add row (title + due date + owner) so tasks are fast to create from a project
- Tap a task to edit status, priority, owner, due date, trade, notes
- Completing a task with priority High/Urgent, or any checklist-template task, writes a project timeline event so it appears in Activity
- Blocked tasks show what they depend on

### 4. Overdue on Today
The Today screen gains an **Overdue tasks** section above follow-ups: task title, project, owner, days overdue, tapping opens the project's Tasks tab. Counts fold into the existing stat strip.

### 5. Real calendar
The calendar month grid and the Upcoming list are rebuilt from a single merged feed of real records:

- Site visits (scheduled date on lead/site-visit projects)
- Project start dates (expected and actual)
- Expected completion dates
- Project tasks with due dates
- Payment due dates from the payments register
- Scheduled inspections and warranty follow-ups (task types)

Each day cell shows coloured dots per record type; selecting a day lists that day's records with links to the project. A simple type filter row lets you narrow the view. No Gantt chart, no drag-to-reschedule.

## Technical notes

- **Database**: new `public.project_tasks` table with the requested columns, `project_id` referencing `ledger_jobs` (cascade delete), `dependency_task_id` self-reference, status/priority as text with validation, `updated_at` trigger reusing `os_touch_updated_at`, RLS deny-all plus `service_role` grants to match every other Ledger table (all access is via admin server functions).
- **Templates** live in code as a pure module (`src/lib/task-templates.ts`) keyed by slug, so they are versionable and testable; a `template_key` column on the task keeps generation idempotent.
- **Server**: `src/lib/tasks.functions.ts` (list/create/update/complete/delete, `applyChecklistTemplate`) + `tasks.server.ts` for reads, following the existing `requireAdmin(token)` + `logAudit` pattern. Task completion inserts into `ledger_job_events` so it flows through the existing `mergeTimeline`.
- **Calendar feed**: `listCalendarRecords` server fn returning a flat, typed, date-keyed DTO built from `ledger_jobs`, `project_tasks`, and `project_payments` in one call; pure grouping/derivation logic goes in `src/lib/calendar-math.ts`.
- **Workspace**: `loadWorkspace` also returns tasks and overdue counts, feeding the new tab and the Overview open-issues block.
- **Today**: `listTodayItems` extended with overdue tasks.
- **Clockwise is untouched** — no changes to time entries, payouts, receipts, or job sites; new unit tests for task status/overdue/template idempotency and calendar grouping, and the existing suite plus the visual style contract must stay green.

## Out of scope

Gantt/dependency scheduling, recurring tasks, worker-facing task views, and notifications.

# Phase 5 — Job Workspace

Turn the job detail screen into the single place an owner opens to understand a sold project. Everything operational is calculated from the systems that already own the data (Clockwise time entries, receipts, job sites), so no number can disagree with another.

## Screens

The job screen becomes a workspace with a calm tab bar under the hero: **Overview · Activity · Labour · Costs · Payments · Documents**. One action per screen, same Ledger visual language (soft sheets, pills, tabular numbers).

**Overview** — project name, client, property address, project type, delivery status, expected/actual dates, assigned owner, upcoming milestone (next action), open issues (flagged time entries, unparsed receipts, overdue payments), workers currently clocked in, and the money row: contract value, collected, recorded costs, preliminary profit. Costs and workers-on-site are calculated live, not read from stored fields.

**Activity** — the existing single timeline, widened. It merges the canonical project events (notes, calls, visits, status/stage changes, estimates, approvals, completion, change orders, inspections) with operational facts read from their owning tables: clock-ins/outs from time entries on the project's job site, receipts from reimbursements, and payments from the new register. No second event table, no mirrored copies.

**Labour** — every Clockwise time entry linked to the project's job site: worker, date, hours, hourly labour cost, flagged badge, and a total. Nothing stored.

**Costs** — receipts and reimbursements connected to the project's job site: vendor, date, category, subtotal, tax, total, worker or payee, thumbnail of the receipt image, and billable-material status. Totals summed on read.

**Payments** — a new project payment register: description, amount expected, due date, amount received, received date, method, notes, status (derived: due / partial / paid / overdue). Collected shown on Overview comes from this register.

**Documents** — links or uploaded files attached to the project with a type: Joist estimate, signed agreement, drawings, site photos, change order, selections, inspection record, warranty.

## Data changes

Two new tables (admin-only, deny-all RLS like the rest of Ledger):

- `project_payments` — project_id, description, amount_expected_cents, due_date, amount_received_cents, received_date, method, notes, timestamps.
- `project_documents` — project_id, kind, title, url, storage_path, uploaded_by, timestamps. Files go to a `project-docs` storage bucket.

Nothing is dropped. `workers_on_site`, `expenses_cents` and `collected_cents` on `ledger_jobs` stay in the table for the existing list screens, but the workspace stops treating them as truth and reads the calculated values instead. A follow-up phase can retire them.

## Technical notes

- New `src/lib/workspace.server.ts` + `workspace.functions.ts`: one admin server function returns the whole workspace payload (project, live entries, labour rows, cost rows, payments, documents, merged timeline) so the screen has a single query key.
- Labour cost = `hoursBetween(clock_in, clock_out) * workers.hourly_rate`, reusing `payout-math.ts` helpers; open entries count toward "on site" but contribute live hours only.
- Entry linkage: a time entry belongs to the project when `job_site_id`, `clock_out_job_site_id`, `planned_job_site_id`, or `assigned_job_site_ids` matches a job site with `project_id = project`.
- Cost linkage: reimbursements where `billable_job_site_id` or `parsed_job_site_id` is a project job site.
- Payment CRUD and document attach/detach as server functions with `requireAdmin`, each writing a `ledger_job_events` row so the timeline stays canonical.
- Pure merge/rollup logic lives in `src/lib/workspace-math.ts` with unit tests; the job screen splits into `src/components/ledger/workspace/*` tab components.
- Clockwise screens and worker flows are untouched. Visual regression baselines for the job screen get refreshed and the full suite must pass.

## Out of scope

Scheduling, automation, notifications, and worker-facing changes.

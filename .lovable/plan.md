
## Where we are today

Looking at your diagram vs. what's already built:

**Already done (Phase 1 / MVP):**
- Ledger jobs module (active/closed tabs, xlsx import)
- Google Sheets integration (link, push, pull, 5-min auto-pull)
- Clockwise time tracking + GPS verification
- Receipts + reimbursements
- Workers, payouts, audit log
- Supabase as central DB

**Diagram items NOT built yet:**
- CRM / Leads pipeline (New → Estimate → Sent → Won/Lost)
- Joist estimate import → auto-create Ledger job
- Auto-pull Clockwise hours into a job's labor cost
- Auto-categorize expenses / remind on missing receipts
- Executive dashboards (profitability, cash flow, top expenses)
- Editable job card (we planned this — not yet built)
- Client follow-up automations

## Proposed next steps, in order

### Step 1 — Finish the Edit Job Dialog (already planned, ~1 change)
Ship the previously-approved edit dialog for active job cards. Unblocks manual data cleanup before we add more automation on top.

### Step 2 — Clockwise → Ledger labor auto-sync
Aggregate `time_entries` per `linked_job_site_id` and write the total into the linked `ledger_jobs.labor` field on a schedule (reuse the existing 5-min cron or a nightly job). Fulfills diagram item "Auto-pull time entries from Clockwise into job records."

### Step 3 — Executive Dashboard v1
You already have `ExecutiveDashboard.tsx` scaffolded. Fill it with:
- Total revenue vs. expenses vs. profit (from `ledger_jobs`)
- Outstanding payments (`total_price - payments_received` for active jobs)
- Top expense categories (finish/building materials, subs, labor)
- Job profitability leaderboard
Covers diagram sections 5 & 6.

### Step 4 — Joist bridge (manual for now)
Since Joist has no API, add an **"Import from Joist"** flow:
- Paste-or-upload the Joist estimate PDF/CSV
- Parse client name, address, line-item total
- Prefill a new Ledger job in "Won" state
Later we can add a Zapier/email-parser webhook at `/api/public/hooks/joist-estimate-accepted` to make it fully automatic. Covers diagram item "Auto-create job when estimate is accepted."

### Step 5 — CRM / Leads pipeline
New `leads` table with status enum (new/contacted/estimating/sent/won/lost) and a Kanban view under `/ledger/leads`. Converting a "Won" lead creates a Ledger job (and is the natural landing spot for the Joist import from Step 4).

### Step 6 — Expense hygiene automations
- Nightly check: `time_entries` on a job with no matching receipts that week → notify admin
- Auto-categorize receipts by vendor keyword → `finish_materials` / `building_materials` / `subs`

### Step 7 (Phase 3) — Client portal & follow-ups
Public per-job link where clients can see progress, outstanding balance, and pay. Automated email nudges for overdue invoices.

## What I need from you to move forward

Same asks as the diagram's "Information I need from you" box:
1. A screenshot of your current Google Sheets job template (tabs + key columns)
2. A sample Joist estimate export (PDF or CSV)
3. Must-have vs. nice-to-have priority ranking of Steps 2–7
4. Any branding/design preferences for the dashboard

## Recommendation

Approve **Steps 1 → 2 → 3** as the next build sprint — they compound (edit → sync → visualize) and give you a working profitability view before we tackle the bigger Joist/CRM work.

Which step should I start with, and can you share the Joist export sample + sheet template screenshot?

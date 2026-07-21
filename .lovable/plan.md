## Problem

The Ledger↔Clockwise sync only fires on new create/update events. Your existing Clockwise client job sites (11 active) were created before sync was wired, so they were never mirrored into Ledger. Current state:

- 11 active Clockwise client sites
- Only 1 active Ledger job, only 2 total with `linked_job_site_id`

New sites created going forward already mirror correctly — this is purely a backfill gap.

## Fix

**1. One-time backfill (SQL migration)**
For every `job_sites` row where `kind='client'` AND `archived_at IS NULL` AND no `ledger_jobs.linked_job_site_id` points at it: insert an active `ledger_jobs` row (address = site address, client_name = site label when it differs from the address, start_date = today, lead_source = 'unknown', linked_job_site_id = site.id). Also link any existing unlinked active Ledger job whose address fuzzy-matches an active site before creating a new one, so we don't create duplicates.

**2. Safety net going forward**
In `listLedgerJobs` (`src/lib/ledger.functions.ts`), after fetching rows, run a lightweight reconciliation: find active client sites with no linked Ledger job and call `ensureLedgerJobForSite` for each, then re-fetch. This keeps things self-healing if anything slips past the event hooks (e.g. a site created via a path that skipped the hook).

## Verification

After migration: `SELECT count(*) FROM ledger_jobs WHERE finish_date IS NULL` should be ≥ 11, and the Ledger Active tab should list every active Clockwise client site.

## Out of scope

No UI changes, no changes to labor recompute logic, no changes to the forward-sync hooks already in place.
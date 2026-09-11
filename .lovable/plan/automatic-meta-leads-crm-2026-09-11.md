# Automatic Meta Leads CRM

Build a lightweight lead inbox fed by a new Google Sheet, using the existing Ledger look and familiar Clockwise-style cards.

## What you get

1. **Google Sheet setup**
   - Add a Leads setup screen where an admin pastes the new spreadsheet URL and selects the tab.
   - Read the header row and let the admin map name, phone, email, address, project type, budget, campaign/form, notes, submission date, and Meta lead ID.
   - Save the mapping so changes to the raw export do not require code changes.

2. **Automatic, safe importing**
   - Pull new rows during the existing scheduled Sheets sync and provide a manual “Sync now” action.
   - Use the Meta lead ID when available, otherwise a stable row fingerprint, so the same submission is never imported twice.
   - Preserve the original row data and source details for troubleshooting.
   - Never create an active job merely because a raw lead arrived.

3. **Configurable auto-qualification**
   - Add simple admin rules for minimum budget, accepted project types, and accepted locations/postal prefixes.
   - A blank rule means “do not filter on this field.”
   - Matching submissions enter **New**; incomplete submissions enter **Needs review**; rejected submissions remain visible in the import history with the reason.
   - Rules can be adjusted without changing code, and a rejected or review item can be admitted manually.

4. **Simple lead workflow**
   - Replace the current long sales-stage presentation for imported leads with: **New, Contacted, Qualified, Won / Lost**.
   - Keep existing active jobs and project delivery statuses separate and unchanged.
   - Winning a lead creates or links the client, property, and Ledger job only once; losing one records the reason without deleting history.

5. **Lead cards and detail view**
   - Add a Leads screen with compact cards modeled on the Clockwise worker cards: initials, client name, location, source badge, project type, qualification state, age, owner, and next action.
   - Include search and stage filters, with fast actions for call/text/email, owner, follow-up date, and stage.
   - Tapping a card opens a dedicated detail view with contact information, form answers, raw source data, activity history, notes, and qualification result.

6. **Visibility and recovery**
   - Show last successful sync, imported/skipped/rejected counts, duplicate detection, and the exact failure message when Google rejects a request.
   - Add an import-history view so no submission silently disappears.
   - Record imports, qualification decisions, stage changes, and job conversion in the existing immutable audit trail.

## Technical details

- Add dedicated lead-source, lead-row, qualification-rule, and activity records in the database with deny-all access, explicit service-role grants, and append-safe source metadata.
- Reuse the existing Google Sheets connector and scheduled sync path, but add a separate lead parser rather than reusing the job-cost workbook parser.
- Keep provider calls server-side, cache sheet configuration, stop retrying non-recoverable Google errors, and back off on quota errors.
- Normalize phone, email, and address for duplicate suggestions; never merge uncertain matches automatically.
- Keep the current manual New Lead flow working, and map its records into the same simple lead workflow.
- Add parser, qualification, deduplication, stage-conversion, and sync-idempotency tests, plus mobile and desktop flow coverage.

## Implementation sequence

1. Add the lead import schema and qualification settings.
2. Build header detection, field mapping, row parsing, deduplication, and auto-qualification.
3. Add automatic and manual sync controls with import history.
4. Build the lead cards, filters, detail view, and quick actions.
5. Add the one-time Won → client/property/job conversion.
6. Verify repeated syncs create no duplicates and existing job, payout, receipt, and Sheets exports remain unchanged.

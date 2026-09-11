# Simple 4-stage leads

Today leads carry five stages (New, Contacted, Qualified, Won, Lost) and the leads list shows all five as filter pills. You asked for a simple four-stage flow. This replaces the leads list with a clean four-stage board.

## The four stages

New → Contacted → Quoted → Won

"Lost" stops being a stage. A lead you don't want is archived instead: it disappears from the board and stays reachable under an "Archived" toggle, keeping the reason you gave.

## What changes

- **Leads list becomes the board.** Four stage tabs across the top with live counts, search below, and the lead cards for the selected stage. No other pipeline clutter.
- **Move a lead forward** from its card or detail screen: one tap advances it to the next stage, and you can jump to any stage.
- **Won** still creates the matching Ledger job once, exactly as it does now.
- **Archive** replaces "Lost" everywhere, with an optional reason.
- **Lead Inbox stays as is.** New Meta leads land there for review; anything you mark qualified enters the board at New. Marking one "not a fit" archives it.
- **Existing leads are mapped over:** Qualified → Contacted, Lost → archived, everything else unchanged.

## Technical notes

- Migration on `public.lead_records`: replace the `stage` check constraint with `('New','Contacted','Quoted','Won')`, add `archived_at timestamptz`, and backfill (`Qualified`→`Contacted`, `Lost`→`archived_at = now()` keeping `lost_reason`).
- `LEAD_STAGES` in `src/lib/meta-leads.ts` becomes the new four; add an `archived` filter to `listLeadData` in `meta-leads.server.ts`.
- `updateMetaLead` in `meta-leads.functions.ts`: accept the new stage enum plus `archived` boolean; log stage changes and archives to `lead_activities`/audit as today.
- Rewrite `src/routes/ledger.leads.index.tsx` as the four-tab board; update `ledger.leads.$leadId.tsx` stage buttons and swap the Lost button for Archive; update `ledger.leads.inbox.tsx` "Not a fit" to archive.
- Verify with a typecheck and the build log.

## 1. Make "Payee" optional on admin receipt upload

- `src/components/admin/AdminApp.tsx` (admin bulk-upload dialog around lines 1839–2040):
  - Remove the required asterisk/toast guard on payee.
  - Remove the `!payee.trim()` condition from the submit `disabled` prop.
  - Relabel the field to "Payee (optional)".
- `src/lib/reimbursements.functions.ts` — `adminAddStandaloneReceipt`:
  - Make `payeeLabel` optional; if blank, insert `null` and let the display layer fall back.
  - After the AI parse completes (`runParseForReimbursement`), when `payee_label` is still null, backfill it with the parsed `vendor`.
- `listAllReceipts` mapping: `workerName` for admin receipts becomes `payee_label || parsed_vendor || "Admin"` so the card label stays useful even before parsing finishes.

## 2. Redesign the Workers tab as Payout-style cards

Replace the current single-column divided list in `WorkersTab` (lines ~694–759) with the same responsive grid pattern used by the Payout worker cards:

- `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` of `Card`s.
- Card header: initials avatar circle + name + hourly rate pill.
- Card body: stacked personal info rows (icon + label + value) for
  - Phone
  - Email
  - Address
  - Emergency contact (name + phone)
  Empty fields render as a muted "Add …" affordance.
- Card footer: existing Edit / PIN / Delete actions kept, aligned right.

### Data model

New nullable columns on `public.workers` via migration:
- `phone text`
- `email text`
- `address text`
- `emergency_contact_name text`
- `emergency_contact_phone text`

No RLS/grant changes needed (existing policies already cover the table).

### Server functions

`src/lib/workers.functions.ts`:
- Extend `listWorkersAdmin` select to include the new columns.
- Extend `createWorker` input + insert with the optional fields.
- New `updateWorkerProfile({ workerId, phone?, email?, address?, emergencyContactName?, emergencyContactPhone? })` — admin-only, validated with zod (`email().optional()`, length caps), audit-logged.

### UI wiring

- `WorkerEditor` (line 802) gains tabs or a longer form with the new personal fields; calls `updateWorkerProfile` in addition to existing name/rate updates.
- "Add worker" dialog gains the same optional inputs (all optional except name/PIN/rate).
- Worker cards render the personal info block; clicking any empty row opens the editor focused on that field.

## Out of scope

- No changes to worker-facing UI, payout logic, or receipt parsing beyond the vendor fallback described above.

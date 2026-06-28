# Off-Site Clock-In Reason Capture

When a worker clocks in (or out) and the GPS resolves to **Off-site** (or No GPS), prompt them for a quick reason so admins have context. The clock-in itself still succeeds — this is just metadata for review.

## Worker experience

1. Worker taps **Clock In**. App grabs GPS as today.
2. Server resolves location:
   - **Verified** at a job site → proceed silently (no popup).
   - **Off-site** or **No GPS** → clock-in still succeeds, then a modal appears:
     > "You clocked in away from a saved job site. Quick reason?"
     - Preset chips: *Material pickup*, *Client meeting*, *Travel between sites*, *Forgot to clock out yesterday*, *Working from new site*, *Other*
     - "Other" reveals a short text field (max 200 chars)
     - Buttons: **Save** / **Skip**
3. Same flow on **Clock Out** if it resolves off-site (covers the "left the site without clocking out" amber case — when they do clock out from somewhere else, they can flag it).
4. Reason shows on the worker's own active/recent entry as a small note, with a pencil to edit while the entry is still today.

## Admin experience

- In the **Entries** tab, off-site / no-gps rows show the reason inline next to the amber badge (e.g. `Off-site · Material pickup`).
- A paperclip-style note icon appears when a reason is attached; hover/tap shows full text.
- Existing **GeoTagEditor** popover gets a new section showing the worker's reason (read-only) so the admin can use it as context when reassigning the entry to a job site or marking it verified.
- Reason persists on the entry even after the admin re-tags it (so the audit trail still shows why it was originally off-site).
- Every reason submission and admin edit flows through the existing **audit log**.

## Preset reasons

Hard-coded list to start (no admin-managed CRUD yet — can add later if needed):
- Material pickup
- Client / site visit
- Travel between sites
- Forgot to clock out previously
- Working from new / temporary site
- Other (free text)

## Technical notes

- **Schema**: add two nullable columns to `time_entries`
  - `offsite_reason_code text` (enum-style string: `material_pickup` | `client_visit` | `travel` | `forgot_clockout` | `new_site` | `other`)
  - `offsite_reason_note text` (free text, max 200, used when code is `other` or to add detail)
  - Index not required; low cardinality.
- **Server functions** (`src/lib/entries.functions.ts`):
  - Extend `clockIn` / `clockOut` return value to include `needsReason: boolean` when `geo.status !== "verified"`.
  - New `workerSetEntryReason({ token, entryId, code, note })` — verifies the entry belongs to the worker and is from today; writes columns; logs audit (`entry_reason_set`).
  - Admin list queries (`adminListEntries`, `adminFlaggedEntries`) include the two new columns.
- **Worker UI** (`src/components/worker/WorkerApp.tsx`):
  - After successful clock action, if `needsReason`, open a `Dialog` with chip buttons + conditional textarea.
  - Save calls the new server fn; Skip closes the dialog.
  - Show the current reason near the timer with a small "Edit reason" link while clocked in.
- **Admin UI** (`src/components/admin/AdminApp.tsx`):
  - Entry rows render reason text after the geo badge.
  - `GeoTagEditor` popover adds a "Worker note" block at the top when a reason exists.
- **Audit log**: every reason save / edit logs before/after with actor = worker (or admin if admin edits later — not in this scope unless requested).

## Out of scope for this pass

- Admin-editable preset list (can add a small settings UI later).
- Photo attachment on the reason (can add later if useful).
- Auto-reminders for missed clock-outs (separate feature; you previously mentioned weekly confirmation, which is the better fit there).

Confirm and I'll build it.

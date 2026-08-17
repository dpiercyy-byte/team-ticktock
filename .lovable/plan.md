# Revert admin "Add receipts" wizard back to single form

Temporarily disable the one-question-at-a-time wizard in the admin **Add receipts** dialog and restore the original single scrolling form so the current flow works better with bulk adds while the wizard is redesigned.

## Scope

Only the `AdminAddReceiptsDialog` component in `src/components/admin/AdminApp.tsx` changes. No server functions, data model, or worker-side receipt flows are touched.

## What to revert

The 4-step wizard (Type → Job site → Attachments → Details) introduced recently is replaced by the previous single form:

- Dialog title: **Add receipts** (static, no step title or dot indicator).
- One scrollable body with all fields visible:
  1. **Week** date input.
  2. **Material type** toggle buttons (Regular / Client-billable).
  3. **Job** `Select` dropdown with "— None —" and a "Client jobs" group (required label when client-billable).
  4. **File dropzone** — drag/drop or click, multi-file, up to 10 files, listed with remove buttons.
  5. **Collapsible extra details** — "Add extra details (Payee, Notes)" toggle that expands to show Payee and Note inputs.
- Footer: **Cancel** + **Upload** button.

## State changes

- Remove `step` state (`1 | 2 | 3 | 4`).
- Restore `extraOpen` state for the collapsible details section.
- Keep all other state and handlers: `payee`, `description`, `weekStart`, `jobSiteId`, `materialType`, `files`, `busy`, `progress`, `dragOver`, `inputRef`, `addFiles`, `onDrop`, `submit`, reset `useEffect`.

## Imports

- Add `ChevronDown` back to the `lucide-react` import block (needed by the collapsible details toggle).
- No other import changes; `Select`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectTrigger`, `SelectValue`, `Label`, `Input`, `Button`, `Dialog*`, `Paperclip` are already present.

## Validation

- Same as before: at least one file; job site required when client-billable.
- Same upload flow and toast behavior.

## Verification

- `bunx tsc --noEmit` / build passes.
- Open admin → Receipts tab → tap **Add** → confirm the dialog shows the single scrolling form with Week, Material type, Job, and the dropzone all at once, with the collapsible extra details section below.

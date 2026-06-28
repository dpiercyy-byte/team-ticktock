## Bulk-add supplier locations

Add a "Bulk add" button to the Suppliers view in the Job Sites tab that opens a dialog with two input modes, a previewable parsed list, and a single save action.

### UX

In the Job Sites tab → Suppliers view, next to the existing "Add" form, add a **Bulk add** button. Opens a dialog containing:

1. **Brand prefix field** — e.g. `Home Depot`. Used to label every row as `{Brand} — {Street}`.
2. **Default radius slider** — applies to the whole batch (default 100m).
3. **Tabbed input methods:**
   - **Paste addresses** — textarea, one address per line. Click "Parse" to geocode each line in parallel.
   - **Search & pick** — text input ("Home Depot Toronto"), runs Places API (New) `places:searchText` through the gateway, renders results as a checkbox list (name + formatted address). Tick the ones to add.
4. **Preview list** — shows every parsed/picked location with:
   - Auto-generated label `{Brand} — {street}` (editable inline)
   - Resolved formatted address (read-only)
   - Status icon: pending / resolved / failed (with reason)
   - Remove (×) per row
5. **Save all** — inserts every resolved row as `kind='supplier'`, single audit log entry per row, toast with success/fail counts. Dialog closes; list refreshes via existing query invalidation.

### Technical details

**Server function** — new `adminBulkAddJobSites` in `src/lib/jobsites.functions.ts`:
- Input: `{ token, kind: 'supplier' | 'client', radius_m, items: Array<{ label, address }> }` (max 50 items per call).
- For each item: call existing `geocodeAddress` helper, insert row, write audit entry (`action: 'job_site_create'`, `metadata: { bulk: true }`). Failures collected per-row, not fatal to the batch.
- Returns `{ added: number, failed: Array<{ address, reason }> }`.

**Places search** — reuse the existing gateway pattern from `geo.server.ts`. New server function `adminSearchPlaces({ token, query })` calls `places/v1/places:searchText` with field mask `places.id,places.displayName,places.formattedAddress,places.location`. Returns array of `{ placeId, name, address, lat, lng }`. Admin-gated.

**Label generation** — `{brand} — {street}` derived from the first comma-segment of the formatted address (e.g. `"1245 Castlefield Ave, Toronto, ON"` → `"1245 Castlefield Ave"`). Inline editable before save.

**Client UI** — new `BulkAddSuppliersDialog` component in `src/components/admin/AdminApp.tsx` (kept local to match existing pattern). Uses shadcn `Tabs`, `Textarea`, `Checkbox`, `Dialog`. Calls the two new server fns via TanStack Query mutations. On save, invalidates the job sites query.

### Out of scope

- Importing across both client jobs + supplier locations in the same batch (separate flows).
- Duplicate detection across existing rows (kept simple — admin can archive/delete after).
- CSV file upload (paste covers the same use case).

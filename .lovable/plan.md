## Make entry title reflect verified job site from clock-in or clock-out

Change the primary title on each entry row in the admin **Entries** list so it shows the actual verified client job site the worker was physically at — either at clock-in or clock-out — instead of the free-text `project` field.

### Title resolution (in order)

1. If clock-in resolved to a **verified client site** → use that site's label.
2. Else if clock-out resolved to a **verified client site** → use that site's label.
3. Else fall back to `e.project` if present.
4. Else `"General"`.

Supplier / off-site / no-gps tags are never promoted to the title — they stay in the GPS audit footer only (unchanged).

### File

`src/components/admin/AdminApp.tsx` (~line 442–446): replace the `{e.project ?? "General"}` span with a small helper that picks from:

- `e.geo_status === "verified"` → `e.job_sites?.label`
- `e.clock_out_geo_status === "verified"` → `e.clock_out_site?.label`
- else `e.project` / `"General"`

Everything else — chips (`manual`, `flagged`, planned-job arrow), offsite reason note, time strip, action buttons, and the GPS audit footer with both `GeoTagEditor` instances — stays exactly as it is.

No schema, server-function, or worker-side changes.

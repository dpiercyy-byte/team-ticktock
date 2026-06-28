## Job Sites: archive + supplier "shadow" locations

Two changes to the **Job Sites** tab so you can manage dozens of locations cleanly:

1. **Archive completed jobs** — keep history without cluttering the active list, restore in one click.
2. **Shadow / supplier locations** — bulk-add places like Home Depot, Rona, lumber yards. Workers clocking in there are recognised (no off-site reason prompt) but the entry is **not** counted as a verified job site for payroll.

---

### Job Sites tab redesign

Three segmented views inside the tab:

- **Active Jobs** — current client sites (today's behaviour).
- **Supplier Locations** — shadow locations.
- **Archived** — completed jobs, with a search box.

Each row gets new actions:

```text
Active Job row:    [ Radius slider ]  [ Archive ]  [ Delete ]
Supplier row:      [ Radius slider ]  [ Delete ]
Archived row:      [ Restore ]        [ Delete permanently ]
```

The "Add Site" dialog gains a **Type** toggle: *Client job* (default) vs *Supplier / shadow location*. Supplier add gets a lighter form (label + address + radius, no "friendly name" distinction needed).

### Geo resolution behaviour

| Location type | Worker sees | Admin badge | Triggers reason prompt? | Counts as verified job site? |
|---|---|---|---|---|
| Active client job | "Verified at {label}" (green) | Green pin + label | No | Yes |
| Supplier (shadow) | "At {label}" (blue/neutral) | Blue pin + label, "supplier" tag | No | No |
| Archived | (ignored, treated as off-site) | Off-site / amber | Yes | No |
| Truly off-site | Off-site (amber) | Amber | Yes | No |
| No GPS | "Location unavailable" | Grey | Yes | No |

The geo-tag editor popover lets you reassign an entry to any active client OR supplier site, and shows archived sites greyed-out under a collapsed "Archived" section so you can still tag historical entries to them if needed.

### Audit & data integrity

- Archiving/unarchiving and creating supplier sites are logged to the audit log with before/after state.
- Existing `time_entries.job_site_id` references are preserved when a site is archived (no cascade), so historical reports keep their labels.
- Deleting an active or supplier site behaves as today (entries keep `job_site_id` but lose the join label). Deleting from Archived shows a stronger confirmation since it's typically permanent cleanup.

---

### Technical section

**Schema (single migration):**
```sql
ALTER TABLE public.job_sites
  ADD COLUMN kind text NOT NULL DEFAULT 'client'
    CHECK (kind IN ('client','supplier')),
  ADD COLUMN archived_at timestamptz;

CREATE INDEX job_sites_active_idx
  ON public.job_sites (kind) WHERE archived_at IS NULL;
```

**`src/lib/geo.server.ts`:**
- Extend `GeoStatus` with `"supplier"`.
- `resolveSite` filters `archived_at IS NULL`, returns `status: "supplier"` when the nearest hit is a `kind='supplier'` row.

**`src/lib/entries.functions.ts`:**
- `clockIn` / `clockOut` return `needsReason: status === "off_site" || status === "no_gps"` (supplier excluded — no prompt).
- `adminUpdateEntryGeo` accepts the new `"supplier"` status.

**`src/lib/jobsites.functions.ts`:**
- `adminListJobSites` returns all rows including `kind` and `archived_at`; UI filters per tab.
- Add `adminAddJobSite` `kind` arg (default `"client"`).
- New `adminArchiveJobSite({ id, archived: boolean })` — sets/clears `archived_at`, logs to audit.

**`src/components/admin/AdminApp.tsx`:**
- `JobSitesTab`: add segmented control (Active / Suppliers / Archived), search input on Archived view, Archive/Restore buttons, type toggle in Add dialog.
- `GeoTagEditor`: render supplier badge variant (blue, "Supplier · {label}"), group archived sites in a collapsible bottom section of the popover.

**`src/components/worker/WorkerApp.tsx`:**
- Add `"supplier"` to the `lastGeo.status` union, render "At {label}" in a neutral/info colour, skip the off-site reason dialog for that status.

No changes needed to payouts or CSV exports — they read hours, not geo status.

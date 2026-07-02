## Redesign receipt card layout for consistent scanning

The receipt cards currently mix priority info (job site, source, total) with meta chips (AI parsed / Edited / Scanning / Failed) all in one wrapping row. Every card ends up with a different shape, so your eye has to hunt.

### New card structure (top → bottom, fixed positions)

```text
┌──────────────────────────────────────┐
│         [ receipt thumbnail ]        │
├──────────────────────────────────────┤
│  Vendor                       $Total │  ← row 1: identity + amount (always same spot)
│  Date · sub/tax meta                 │  ← row 2: small muted line
├──────────────────────────────────────┤
│  Source pill    Job site pill        │  ← row 3: dedicated priority strip
│  (Admin/Worker) (job site or "No job")
├──────────────────────────────────────┤
│  Category · Client-billable (opt.)   │  ← row 4: secondary tags, only if present
│  "description" (opt.)                │
├──────────────────────────────────────┤
│  [edit] [rescan] [view] [dl] [del]   │
└──────────────────────────────────────┘
```

Row 3 is the new dedicated priority strip — always rendered, always in the same place, even when a field is empty (job site shows a muted "No job" pill so the layout doesn't shift).

### Parse-status simplification

- Drop the four-state chip (AI parsed / Edited / Scanning / Failed) from the card face — it's noise for the 95% success case and it competes with the priority info.
- Keep only the two states that require action:
  - **Scanning…** — small amber dot + label, shown inline on row 2 while pending.
  - **Scan failed** — small red dot + label on row 2, replacing the date meta.
- "AI parsed" vs "Edited" collapse into nothing on the card. The distinction stays available inside the edit dialog (unchanged) for anyone who needs it.

### Consistency details

- Vendor falls back to description if missing, same as today, but the amount slot is always `parsedTotal ?? amount` in the same top-right position.
- Source pill uses the same two-tone style for both Admin and Worker so they read as a matched pair, not "colored vs plain".
- Job site pill uses the outline style already used elsewhere; when absent, render `No job` in muted-foreground so the row height is stable.
- Grid, thumbnail, and action row stay as-is.

### Files touched

- `src/components/admin/AdminApp.tsx` — only the card render block inside `ReceiptsTab` (roughly lines 1585–1670). No data, server-function, or filter changes.

No schema, no migration, no behavior change to parsing or sync.
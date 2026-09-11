# Plan: Admin can clock in a worker whose phone is dead

## Problem
When a worker's phone is dead or not with them, they can't clock in themselves. The admin
Entries tab already has an **Add entry** button that lets you create a full entry (clock in
+ clock out), but it **requires a clock-out time** — you can't create an open, "currently
clocked in" entry. So if a worker is mid-shift right now with a dead phone, the admin has no
way to start their active session on their behalf and let it run until they clock out later.

The schema already supports open entries (`clock_out` is nullable; `clockIn`/`clockOut` already
run open-session logic). Only the admin add flow blocks it.

## What changes

### 1. Server: `adminAddEntry` accepts an optional clock-out
File: `src/lib/entries.functions.ts` (lines 474–509)

- Change the input validator from `clockOut: z.string()` to
  `clockOut: z.string().optional()` (so an empty string or omitted value means "still active").
- Skip the "clock out must be after clock in" and the >14h flag checks when `clockOut` is
  empty/missing.
- Insert `clock_out: data.clockOut || null` instead of the always-present value.
- `checkOverlap` already handles `clockOutISO = null` (treats it as Infinity), so no change
  needed there.

### 2. UI: Add-entry dialog allows a blank clock-out
File: `src/components/admin/AdminApp.tsx` — the `EntryDialog` used for Add (lines 936–953)

- Pass `allowOpenEnd` to the **Add** `EntryDialog` (the Edit dialog already passes it).
- The dialog already shows "(blank = still active)" when `allowOpenEnd` is set, and the Save
  guard already skips the clock-out-required check when `allowOpenEnd` is true
  (lines 1232–1235). So the only UI change is adding `allowOpenEnd` to the Add dialog.

### 3. Later close-out
Once the worker's shift ends, the admin opens the entry with **Edit** (which already uses
`allowOpenEnd`) and fills in the clock-out time — the existing edit flow handles this.

## What you'll be able to do
- A worker's phone is dead mid-shift → open **Entries**, pick the worker, tap **Add entry**,
  set the clock-in time, leave **Clock out blank**, pick the job site, and **Save**. The worker
  now shows an active session.
- When the shift ends, edit that entry and fill in the clock-out time.

No new tables, no migrations, no worker-app changes.

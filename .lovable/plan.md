## Offline-safe Clock In/Out

Goal: if a worker taps Clock In or Clock Out without internet (or the request fails mid-flight), the action is queued locally, the UI immediately reflects the pending state, and it auto-syncs the moment connectivity returns — with clear status the whole time.

### UX

- **Status pill** (top of clock-in screen) becomes the single source of truth:
  - `Online` (green wifi)
  - `Offline — will sync when back online` (amber wifi-off)
  - `Syncing 1 pending action…` (spinner) while flushing
  - `Sync failed — tap to retry` (red, tappable) if the server rejects
- **Big clock button** stays usable offline. When tapped offline:
  - Captures GPS (works offline) + timestamp now
  - Optimistically flips to "Clocked in (pending sync)" / "Clocked out (pending sync)"
  - Shows a subtle "Pending sync" chip under the timer/last tag
- **Queued banner** above the button when ≥1 action is queued: "1 action waiting to sync" with a "Sync now" button (disabled while offline).
- **Guards**: if an action is queued, disable the opposite action until it syncs (prevents queuing Clock Out before the pending Clock In lands). Reimbursements stay online-only for this pass (they involve file uploads) — we'll show a clear "Connect to submit" message if offline.
- **Post-sync prompts** (off-site reason, planned job): if the synced response asks for a reason/planned job, the dialog opens automatically once the user is back in the app and the sync completes. If the app is closed at sync time, prompts surface on next open.

### Technical Implementation

1. **Queue store** — `src/lib/offline-queue.ts`
   - `localStorage` key `clockwise.offlineQueue.v1`: array of `{ id, kind: "in"|"out", token, payload: { project?, lat, lng, clientTimestamp }, attempts, lastError? }`.
   - Helpers: `enqueue`, `peek`, `remove`, `subscribe` (pub/sub for React).
   - `clientTimestamp` is sent so the server can backdate; server change below.

2. **Server changes** — `src/lib/entries.functions.ts`
   - `clockIn` / `clockOut` accept optional `clientTimestamp` (ISO). When present and within a sane window (e.g. ≤24h old, not in future >2 min), use it for `clock_in` / `clock_out`; otherwise fall back to `now()`. Add `created_offline: true` flag into `metadata` of the audit log entry when used.
   - No schema migration needed (uses existing `clock_in` / `clock_out` columns). Optional: add `audit_log` action `entry_offline_sync` with the delay in metadata.

3. **Sync engine hook** — `src/hooks/use-offline-sync.ts`
   - Subscribes to queue + `useOnline()`.
   - On `online === true` and queue non-empty: flush head-of-line, one at a time (sequential to preserve in→out order), via the existing `clockIn`/`clockOut` server fns.
   - On success: remove from queue, invalidate `worker-state`, surface server response (so reason/planned-job dialogs fire via callback).
   - On failure: increment `attempts`, exponential backoff (5s/30s/2m, cap at 5m), keep item; after 5 attempts mark `status: "failed"` and require manual retry.
   - Exposes `{ pending, syncing, lastError, retry, flush }`.

4. **Worker UI wiring** — `src/components/worker/WorkerApp.tsx`
   - Replace direct `inMut.mutate()` / `outMut.mutate()` with a `submitClock(kind)` helper that:
     - If online + no queue: call server fn directly (current behavior).
     - Else: capture GPS, enqueue, optimistically update local `active` state via `queryClient.setQueryData(["worker-state", id], …)`.
   - Render new `SyncStatusBar` component (replaces the current wifi indicator) using `use-offline-sync` state.
   - Hook the sync engine's `onSyncComplete(serverResponse)` to the existing `reasonPrompt` / `plannedPrompt` setters so post-sync prompts still fire.

5. **Cross-tab safety**
   - Listen to `storage` events so a second tab doesn't double-flush. Use a simple `localStorage` lock key (`clockwise.syncLock` with timestamp, 30s TTL).

### Out of scope

- Offline reimbursement submission (files + base64 in localStorage = quota risk).
- Service worker / true PWA offline shell — only the clock action queue.
- Conflict resolution beyond timestamp clamping (extreme clock skew still falls back to server time).

### Verification

- Manual: DevTools → Network → Offline → tap Clock In → see "Pending sync" → go back online → entry appears in admin with the offline-capture timestamp.
- Refresh the page while offline with a queued action → state restores from localStorage and resumes on reconnect.
- Build + tsgo clean.

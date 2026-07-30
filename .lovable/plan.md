## Goal

Catch two classes of regression as Clockwise adopts Ledger's look:
1. **Visual drift** — a screenshot of a screen changes unexpectedly.
2. **Style-contract violations** — hardcoded colors / ad-hoc card styling creeping back in instead of the `cw-scope` tokens and helper classes.

## What gets built

### 1. Visual regression harness (Playwright)

- Add dev deps: `@playwright/test`, plus scripts `test:visual` and `test:visual:update`.
- `playwright.config.ts`: runs against the dev server on `http://localhost:8080`, Chromium only, fixed viewports (mobile 390x844 and desktop 1280x900), animations disabled, `maxDiffPixelRatio` ~0.01 so font antialiasing doesn't cause false failures.
- Baselines committed under `tests/visual/__screenshots__/`.

**Screens covered** (both viewports):

```text
Worker    /            login screen
Worker    /            clocked-out home, clocked-in home, reimbursement sheet
Admin     /admin       login screen
Admin     /admin       Entries, Payout (Weekly + Lifetime), Receipts,
                       Workers, Sites, More popover
Ledger    /ledger      home, jobs list, job detail, new-job wizard step 1
```

Ledger screens are included as the reference side: if Clockwise and Ledger are meant to match, both need to be locked.

### 2. Deterministic state (no live DB in snapshots)

Screenshots must not depend on real hours/receipts or they'd fail daily. Tests intercept the app's server-function calls via `page.route` and return a small fixed fixture set (`tests/visual/fixtures.ts`) — fixed worker list, fixed entries, fixed jobs, frozen clock. Auth is seeded by writing the same tokens the app already stores in `localStorage` / `sessionStorage` before navigation.

### 3. Layout-integrity assertions (the "without breaking layouts" half)

Pure pixel diffs tell you *something* changed but not *what*. Alongside each snapshot, assert:

- **No horizontal overflow**: `document.documentElement.scrollWidth <= clientWidth` on every screen at 390px wide.
- **No clipped/overlapped bottom nav**: the docked footer nav is fully in the viewport and no tab label is truncated.
- **Tap targets ≥ 44px**: every button/link/tab has a rendered height ≥ 44 at mobile width.
- **Typography contract**: headings resolve to Bricolage Grotesque, body to Manrope inside `.cw-scope`.

These run as normal assertions so a failure names the actual problem.

### 4. Style-contract check

A small Node script (`scripts/check-style-contract.mjs`, wired to `npm run lint:style`) greps `src/components/admin`, `src/components/worker`, and `src/routes` for:

- literal color utilities: `bg-gray-*`, `bg-slate-*`, `text-white`, `text-black`, `bg-[#...]`, `text-[#...]`
- inline `style={{ color/background }}` with literal hex

and fails with file:line. Existing known violations are captured in an allowlist file so the check starts green and can only ratchet down.

### 5. Docs

`tests/visual/README.md`: how to run, how to review a diff, how to intentionally update a baseline (`npm run test:visual:update`), and why baselines are committed.

## Technical notes

- Playwright's bundled Chromium is already available in this environment; the config will not pin an `executablePath`.
- Snapshots are Chromium-only and generated in this Linux sandbox, so local runs on macOS will show font-rendering diffs — the README states that baselines are authoritative from CI/sandbox runs only.
- No application source is modified by this work except the allowlist-driven style cleanups, which are reported first rather than auto-applied.

## Out of scope

- CI wiring (no CI config exists in this project yet) — scripts are runnable on demand.
- Cross-browser (Firefox/WebKit) baselines.

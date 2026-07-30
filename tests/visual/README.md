# Visual regression checks

Locks Clockwise's Ledger-style look in place so a CSS or layout change can't
silently drift.

## What runs

| Layer | What it catches |
| --- | --- |
| Screenshots (`tests/visual/*.spec.ts`) | Any visible change to a known screen |
| Layout assertions (`mock.ts`) | Horizontal overflow, clipped bottom nav, sub-40px tap targets, wrong font stack |
| Style contract (`scripts/check-style-contract.mjs`) | New hardcoded colors (`bg-gray-*`, `text-white`, `bg-[#...]`, inline hex) |

## Commands

```bash
npm run lint:style          # fast — no browser needed
npm run test:visual         # screenshots + layout assertions
npm run test:visual:update  # re-record baselines after an intentional change
```

`test:visual` starts the dev server itself, or reuses one already on
`http://localhost:8080`. Point it elsewhere with `VISUAL_BASE_URL`.

## Baselines

Committed under `tests/visual/__screenshots__/`, one folder per spec, one file
per `{viewport}` project (`mobile` 390x844, `desktop` 1280x900).

**Baselines are Chromium-on-Linux.** Generate and update them in the Lovable
sandbox or CI. Running on macOS/Windows will diff on font rendering alone —
that's expected, not a regression.

## Reviewing a failure

1. `npx playwright show-report tests/visual/.report` — side-by-side actual /
   expected / diff.
2. If the change is intentional: `npm run test:visual:update`, then eyeball the
   changed PNGs before committing them.
3. If an assertion (not a pixel diff) failed, the message names the offending
   element — fix the layout, don't re-record.

## No live data

Screenshots never hit the database. `mock.ts` intercepts every
`/_serverFn/<id>` POST, decodes the base64 function id to its export name, and
answers from `tests/visual/fixtures.ts`. Unknown functions get a benign
`{ token }` envelope. The clock is frozen at 2026-03-12T14:30 America/Toronto
and all non-localhost requests are aborted.

Auth is seeded by writing the same keys the app uses: `tt.worker`
(localStorage) and `tt.admin` (sessionStorage).

### Adding a screen

1. Add any new server-function payload to `FIXTURES` in `fixtures.ts`, keyed by
   its export name.
2. Add a test that navigates there and calls `checkScreen(page, { name, scope, nav })`.
3. `npm run test:visual:update` to record the baseline.

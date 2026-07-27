## What I'm reading in your three references

**Picture 1 (smart-home app)** — the move you love is the *overlapping card*: a full-bleed hero image band at the top, and a large white, heavily-rounded card that starts *inside* that band and floats over it. Depth comes from one big soft shadow, not borders. The bottom nav is a detached floating pill, not a bar glued to the screen edge.

**Picture 2 (Job Flow home)** — the top block: small muted date line, one enormous greeting, then a single full-width primary action, then a tight 3-up stat strip (Active / Pending / Total) with colored numerals and muted labels. Sections below are labelled with small uppercase tracked-out headers.

**Picture 3 (job detail)** — the whole aesthetic: hero with a status pill and huge display title overlaid, an overlapping "Financial Snapshot" sheet, a 2×2 money grid with semantic colors (collected/profit green, expenses red), a progress bar under the headline number, a divider with a live "1 worker on site · Jul 27 · 9:00 AM" strip, a live status banner, and a circular accent FAB.

Ledger today has none of this: flat bordered cards, blue primary, no hero, no overlap, six equal-weight list sections, a static bottom nav.

## Direction (locked)

Warm light theme everywhere, no photos — hero bands become rich gradients tinted by project type + status. The **job is the hero object**: every screen is either a job, a list of jobs, or a step in a job's journey.

## The workflow journey, made visual

The seven statuses stop being colored text and become a visible spine:

```text
Lead → Site Visit → Estimate → Approval → Scheduled → Active → Completed
 ●──────●──────────●──────────○──────────○───────────○────────○
```

A `JobJourney` component renders this as a horizontal 7-node rail (compact dots on cards, labelled nodes on detail) with completed steps filled, current step ringed and colored, future steps hollow. It appears on the job detail hero and as a 7-dot mini-rail on every job card, so a job's position in the pipeline is readable at a glance anywhere it appears.

## Screens

**Ledger scope + tokens (`src/styles.css`)**
- Warm off-white canvas (`hsl(40 30% 97%)`), ink-slate foreground, terracotta accent (matching ref 3's orange FAB) as the Ledger action color, green for collected/profit, red for expenses.
- New tokens: per-status hue, `--ledger-hero-*` gradients per project type, one shadow scale (`--shadow-sheet`, `--shadow-float`), radius bumped to 24px for sheets / 20px for cards / full for pills.
- Display font (Bricolage Grotesque) loaded via `<link>` in `__root.tsx`; body Manrope. Both already referenced by `.ledger-scope` but never actually loaded — I'll load them.

**Shell (`LedgerShell.tsx`)** — gains an optional `hero` slot: renders a gradient band, then pulls the content sheet up over it with a negative margin and `rounded-t-[28px]`. This is the ref-1 overlap, reused by home and job detail.

**Home (`ledger.index.tsx`)** — rebuilt on the ref-2 top block: date, oversized greeting, full-width New Job button, 3-up stat strip (Active / Needs action / Total) with colored numerals. Below, the six flat sections collapse into three prioritized ones with uppercase tracked headers: **On site now** (live, green-dot cards), **Active jobs** (full JobCards), **Requires action** (compact rows). Estimates/payments/recent fold into a single "Pipeline" strip showing counts per journey stage — tap a stage to filter the jobs list.

**JobCard** — border removed, soft shadow only, status pill top-left in its status hue, money right-aligned in green, client + address muted beneath, trade chips as soft gray pills with `+N` overflow, and the 7-dot journey rail at the bottom.

**Job detail (`ledger.jobs.$jobId.tsx`)** — the ref-3 layout, exactly: gradient hero with status pill and display-size job name + client + address overlaid; an overlapping white "Financial Snapshot" sheet with "Change Status" pill (opens the journey picker) → `$X of $Y` + percent + progress bar → 2×2 Budget/Collected/Expenses/Profit grid in semantic color → divider → workers-on-site + scheduled-date strip. Below the sheet: journey rail (labelled), trades, then the activity timeline restyled as a lighter rail. Circular terracotta FAB, bottom-right above the nav, for adding an event/note.

**Jobs list (`ledger.jobs.index.tsx`)** — sticky segmented filter by journey stage, cards as above.

**Bottom nav (`LedgerBottomNav.tsx`)** — detached floating pill with blur, inset from the screen edge, active item as a filled circular icon token (ref 2/ref 1 hybrid).

## Technical notes

- Presentation-only. No schema, no server-function, no query changes — same `LedgerJob` / `LedgerTimelineEvent` shapes.
- New files: `src/components/ledger/JobJourney.tsx`, `JobHero.tsx`, `StatStrip.tsx`, `LedgerFab.tsx`; `ledger-ui.ts` extended with status→hue, project-type→gradient, and journey-index helpers.
- All colors go through `.ledger-scope` CSS variables in `src/styles.css` — no hardcoded `text-white`/`bg-black` in components.
- Mobile-first (your 402px viewport is the target); grid + `min-w-0` + `shrink-0` on every mixed text/widget row.
- `head()` metadata preserved per route.

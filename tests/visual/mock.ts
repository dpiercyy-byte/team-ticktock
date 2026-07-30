import { expect, type Page } from "@playwright/test";
import { FALLBACK_RESPONSE, FIXTURES, FROZEN_NOW } from "./fixtures";

const WORKER_KEY = "tt.worker";
const ADMIN_KEY = "tt.admin";

/** `/_serverFn/<base64url({file,export})>` -> the plain export name. */
export function decodeServerFnName(url: string): string | null {
  const raw = url.split("/_serverFn/")[1];
  if (!raw) return null;
  const id = decodeURIComponent(raw.split("?")[0]);
  try {
    const json = Buffer.from(id.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const exp = String(JSON.parse(json).export ?? "");
    return exp.replace(/_createServerFn_handler$/, "") || null;
  } catch {
    return null;
  }
}

/**
 * Intercepts every server-function call and answers from `fixtures.ts`.
 * Guarantees screenshots never depend on live database rows.
 */
export async function mockServerFns(page: Page, overrides: Record<string, unknown> = {}) {
  const table = { ...FIXTURES, ...overrides };
  await page.route("**/_serverFn/**", async (route) => {
    const name = decodeServerFnName(route.request().url());
    const body = name && name in table ? table[name] : FALLBACK_RESPONSE;
    // TanStack Start's client unwraps `{ result, error, context }`.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: body ?? null, error: null, context: {} }),
    });

  });
  // Never let a snapshot depend on remote images / fonts / analytics.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
}

/** Freezes the clock so live timers and "this week" labels stay stable. */
export async function freezeClock(page: Page) {
  await page.clock.install({ time: FROZEN_NOW });
}

export async function seedWorkerSession(page: Page) {
  await page.goto("/");
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [
      WORKER_KEY,
      JSON.stringify({
        token: "visual-worker-token",
        id: "11111111-1111-4111-8111-111111111111",
        name: "Alex Moreau",
      }),
    ],
  );
}

export async function seedAdminSession(page: Page) {
  await page.goto("/admin");
  await page.evaluate(
    ([k, v]) => window.sessionStorage.setItem(k, v),
    [ADMIN_KEY, "visual-admin-token"],
  );
}

export async function clearSessions(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

/** Waits until the app has settled: no spinners, fonts loaded, no motion. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}`,
  });
  await page.waitForTimeout(150);
}

/* ------------------------------------------------------------------ *
 * Layout-integrity assertions — these name the actual breakage, where
 * a pixel diff only says "something moved".
 * ------------------------------------------------------------------ */

/** Nothing may push the document wider than the viewport. */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflowing: string[] = [];
    if (doc.scrollWidth > doc.clientWidth + 1) {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > doc.clientWidth + 1 || r.left < -1) {
          const cls = typeof el.className === "string" ? el.className.slice(0, 80) : "";
          overflowing.push(`${el.tagName.toLowerCase()}.${cls} right=${Math.round(r.right)}`);
        }
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      offenders: overflowing.slice(0, 5),
    };
  });
  expect(
    result.scrollWidth,
    `${label}: horizontal overflow (${result.scrollWidth} > ${result.clientWidth}). First offenders: ${result.offenders.join(" | ")}`,
  ).toBeLessThanOrEqual(result.clientWidth + 1);
}

/** The docked bottom nav must be fully visible and never clip its labels. */
export async function expectBottomNavIntact(page: Page, selector: string, label: string) {
  const nav = page.locator(selector).first();
  if ((await nav.count()) === 0) return;
  await expect(nav, `${label}: bottom nav not visible`).toBeVisible();
  const report = await nav.evaluate((el, vh) => {
    const r = el.getBoundingClientRect();
    const clipped: string[] = [];
    for (const child of Array.from(el.querySelectorAll<HTMLElement>("span,p"))) {
      if (child.scrollWidth > child.clientWidth + 1 && child.textContent?.trim()) {
        clipped.push(child.textContent.trim());
      }
    }
    return { bottom: Math.round(r.bottom), top: Math.round(r.top), vh, clipped };
  }, await page.evaluate(() => window.innerHeight));
  expect(report.top, `${label}: bottom nav starts below the viewport`).toBeLessThan(report.vh);
  expect(
    report.clipped,
    `${label}: bottom nav labels are truncated: ${report.clipped.join(", ")}`,
  ).toEqual([]);
}

/** Interactive controls need a real touch target. */
export async function expectTapTargets(page: Page, label: string, min = 40) {
  const small = await page.evaluate((minH) => {
    const out: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"], [role="tab"]',
    );
    for (const el of Array.from(nodes)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // hidden
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      // Text links inside a paragraph are not tap targets in the button sense.
      if (el.tagName === "A" && style.display.includes("inline")) continue;
      if (r.height < minH) {
        out.push(`${el.tagName.toLowerCase()}("${(el.textContent ?? "").trim().slice(0, 24)}") h=${Math.round(r.height)}`);
      }
    }
    return out.slice(0, 8);
  }, min);
  expect(small, `${label}: tap targets under ${min}px tall: ${small.join(" | ")}`).toEqual([]);
}

/**
 * The whole point of the Ledger port: Clockwise must resolve to the same
 * type stack inside `.cw-scope` as Ledger does inside `.ledger-scope`.
 */
export async function expectTypographyContract(page: Page, scope: ".cw-scope" | ".ledger-scope") {
  const fonts = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    const heading = root.querySelector("h1, h2, h3");
    return {
      body: getComputedStyle(root as Element).fontFamily,
      heading: heading ? getComputedStyle(heading).fontFamily : null,
      tabularNums: getComputedStyle(root as Element).fontVariantNumeric,
    };
  }, scope);
  expect(fonts, `${scope} is not present on the page`).not.toBeNull();
  expect(fonts!.body, `${scope} body font`).toContain("Manrope");
  if (fonts!.heading) {
    expect(fonts!.heading, `${scope} heading font`).toContain("Bricolage Grotesque");
  }
}

/** One call = the full contract for a screen. */
export async function checkScreen(
  page: Page,
  opts: { name: string; scope?: ".cw-scope" | ".ledger-scope"; nav?: string; tapTargets?: boolean },
) {
  await settle(page);
  await expectNoHorizontalOverflow(page, opts.name);
  if (opts.scope) await expectTypographyContract(page, opts.scope);
  if (opts.nav) await expectBottomNavIntact(page, opts.nav, opts.name);
  if (opts.tapTargets !== false) await expectTapTargets(page, opts.name);
  await expect(page).toHaveScreenshot(`${opts.name}.png`, { fullPage: false });
}

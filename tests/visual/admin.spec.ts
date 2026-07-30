import { test } from "@playwright/test";
import { checkScreen, clearSessions, freezeClock, mockServerFns, seedAdminSession, settle } from "./mock";

const NAV = 'nav[aria-label="Admin"]';

/** Bottom-nav tabs render as buttons with the visible label. */
async function openTab(page: import("@playwright/test").Page, label: string) {
  await page.locator(NAV).getByRole("button", { name: label, exact: false }).first().click();
  await settle(page);
}

test.describe("Admin", () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
    await mockServerFns(page);
  });

  test("login", async ({ page }) => {
    await clearSessions(page);
    await page.goto("/admin");
    await checkScreen(page, { name: "admin-login", scope: ".cw-scope" });
  });

  for (const tab of ["Entries", "Payout", "Receipts", "Workers", "Sites"] as const) {
    test(`tab - ${tab}`, async ({ page }) => {
      await seedAdminSession(page);
      await page.goto("/admin");
      await settle(page);
      await openTab(page, tab);
      await checkScreen(page, {
        name: `admin-${tab.toLowerCase()}`,
        scope: ".cw-scope",
        nav: NAV,
      });
    });
  }

  test("payout - lifetime", async ({ page }) => {
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await openTab(page, "Payout");
    const lifetime = page.getByRole("tab", { name: /lifetime/i }).first();
    if (await lifetime.count()) {
      await lifetime.click();
      await checkScreen(page, { name: "admin-payout-lifetime", scope: ".cw-scope", nav: NAV });
    }
  });

  test("more popover", async ({ page }) => {
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await page.getByRole("button", { name: "More tabs" }).click();
    await checkScreen(page, { name: "admin-more-popover", scope: ".cw-scope", nav: NAV });
  });

  test("audit log", async ({ page }) => {
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await page.getByRole("button", { name: "More tabs" }).click();
    await page.getByRole("button", { name: /audit log/i }).last().click();
    await checkScreen(page, { name: "admin-audit", scope: ".cw-scope", nav: NAV });
  });
});

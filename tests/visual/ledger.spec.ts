import { test } from "@playwright/test";
import { checkScreen, freezeClock, mockServerFns, seedAdminSession, settle } from "./mock";
import { LEDGER_JOBS } from "./fixtures";

const NAV = "nav.l-nav, .l-nav";

test.describe("Ledger (reference style)", () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
    await mockServerFns(page);
    await seedAdminSession(page);
  });

  test("home", async ({ page }) => {
    await page.goto("/ledger");
    await checkScreen(page, { name: "ledger-home", scope: ".ledger-scope", nav: NAV });
  });

  test("jobs list", async ({ page }) => {
    await page.goto("/ledger/jobs");
    await checkScreen(page, { name: "ledger-jobs", scope: ".ledger-scope", nav: NAV });
  });

  test("job detail", async ({ page }) => {
    await page.goto(`/ledger/jobs/${LEDGER_JOBS[0].id}`);
    // The activation panel loads asynchronously; wait for it so the shot is stable.
    await page.getByRole("button", { name: /^activate job$/i }).waitFor();
    await checkScreen(page, { name: "ledger-job-detail", scope: ".ledger-scope" });
  });

  test("new job wizard - step 1", async ({ page }) => {
    await page.goto("/ledger/jobs/new");
    await settle(page);
    await checkScreen(page, { name: "ledger-job-wizard-1", scope: ".ledger-scope" });
  });
});

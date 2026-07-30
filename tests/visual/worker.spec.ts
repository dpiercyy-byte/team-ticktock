import { test } from "@playwright/test";
import { checkScreen, clearSessions, freezeClock, mockServerFns, seedWorkerSession, settle } from "./mock";

test.describe("Worker", () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
    await mockServerFns(page);
  });

  test("login", async ({ page }) => {
    await clearSessions(page);
    await page.goto("/");
    await checkScreen(page, { name: "worker-login", scope: ".cw-scope" });
  });

  test("home - clocked out", async ({ page }) => {
    await seedWorkerSession(page);
    await page.goto("/");
    await checkScreen(page, { name: "worker-home-clocked-out", scope: ".cw-scope" });
  });

  test("home - clocked in", async ({ page }) => {
    await mockServerFns(page, {
      getWorkerState: {
        worker: { name: "Alex Moreau", hourly_rate: 34 },
        active: {
          id: "e9999999-9999-4999-8999-999999999999",
          clock_in: "2026-03-12T13:05:00.000Z",
          project: null,
          geo_status: "verified",
          offsite_reason_code: null,
          planned_job_site_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
          planned_job: { label: "16 Ostick Ave" },
        },
        todayHours: 0,
        weekHours: 38.5,
        settings: { project_tracking_enabled: false, show_pay_estimates: true },
      },
    });
    await seedWorkerSession(page);
    await page.goto("/");
    await checkScreen(page, { name: "worker-home-clocked-in", scope: ".cw-scope" });
  });

  test("week summary / reimbursements", async ({ page }) => {
    await seedWorkerSession(page);
    await page.goto("/");
    await settle(page);
    const tab = page.getByRole("tab").filter({ hasText: /pay|week|reimburse/i }).first();
    if (await tab.count()) {
      await tab.click();
      await checkScreen(page, { name: "worker-week-summary", scope: ".cw-scope" });
    }
  });
});

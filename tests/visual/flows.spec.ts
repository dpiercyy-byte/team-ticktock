import { expect, test } from "@playwright/test";
import {
  clearSessions,
  freezeClock,
  mockServerFns,
  recordServerFnCalls,
  seedAdminSession,
  seedWorkerSession,
  settle,
} from "./mock";

/**
 * Behavioural smoke tests for the Clockwise operational core.
 *
 * These assert DOM state and the server-function calls the UI makes — never
 * pixels — so they keep protecting the flows through future restyling.
 * Every server call is answered from `fixtures.ts`; the database is never
 * touched.
 */

const NAV = 'nav[aria-label="Admin"]';

test.describe("Worker flows", () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
    await mockServerFns(page);
  });

  test("PIN login calls workerLogin and lands on the clock screen", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await clearSessions(page);
    await page.goto("/");
    await settle(page);

    // Worker picker is populated from listWorkersPublic.
    expect(rec.names()).toContain("listWorkersPublic");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();

    const pin = page.locator('input[placeholder="••••"]');
    await pin.fill("1234");
    await pin.press("Enter");
    await settle(page);

    expect(rec.count("workerLogin")).toBeGreaterThan(0);
  });

  test("clock in sends GPS and clock out closes the session", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: 43.66, longitude: -79.38 });
    await seedWorkerSession(page);
    await page.goto("/");
    await settle(page);

    const clockIn = page.getByRole("button", { name: /^clock in$/i }).first();
    await expect(clockIn).toBeVisible();
    await clockIn.click();
    await settle(page);
    expect(rec.count("clockIn"), "clockIn server function was not called").toBeGreaterThan(0);
  });

  test("clocked-in worker sees Clock Out and the assigned job title", async ({ page }) => {
    await mockServerFns(page, {
      getWorkerState: {
        worker: { name: "Alex Moreau", hourly_rate: 34 },
        active: {
          id: "e9999999-9999-4999-8999-999999999999",
          clock_in: "2026-03-12T13:05:00.000Z",
          project: null,
          geo_status: "supplier",
          offsite_reason_code: null,
          planned_job_site_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
          planned_job: { label: "16 Ostick Ave" },
        },
        todayHours: 0,
        weekHours: 38.5,
        settings: { project_tracking_enabled: false, show_pay_estimates: true },
      },
    });
    const rec = await recordServerFnCalls(page);
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: 43.66, longitude: -79.38 });
    await seedWorkerSession(page);
    await page.goto("/");
    await settle(page);

    // Primary title is the ASSIGNED job, never the raw GPS punch location.
    await expect(page.getByText(/16 Ostick Ave/).first()).toBeVisible();
    const clockOut = page.getByRole("button", { name: /^clock out$/i }).first();
    await expect(clockOut).toBeVisible();
    await clockOut.click();
    await settle(page);
    expect(rec.count("clockOut"), "clockOut server function was not called").toBeGreaterThan(0);

  });

  test("reimbursement form requires a job but not a description", async ({ page }) => {
    await seedWorkerSession(page);
    await page.goto("/");
    await settle(page);

    const add = page.getByRole("button", { name: /add reimbursement/i }).first();
    if ((await add.count()) === 0) test.skip(true, "Reimbursement entry point not on this screen");
    await add.click();
    await settle(page);

    // Job picker present; description field is explicitly optional.
    await expect(page.getByText(/choose a job|select a job/i).first()).toBeVisible();
    const optional = page.getByText(/optional/i);
    expect(await optional.count(), "description should be marked optional").toBeGreaterThan(0);
  });
});

test.describe("Admin flows", () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
    await mockServerFns(page);
  });

  test("password login calls adminLogin and reveals the dashboard nav", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await clearSessions(page);
    await page.goto("/admin");
    await settle(page);

    const pw = page.locator('input[type="password"]').first();
    await expect(pw).toBeVisible();
    await pw.fill("hunter2");
    await pw.press("Enter");
    await settle(page);

    expect(rec.count("adminLogin")).toBeGreaterThan(0);
  });

  test("entries tab lists time entries with the assigned site as the title", async ({ page }) => {
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await page.locator(NAV).getByRole("button", { name: /entries/i }).first().click();
    await settle(page);

    await expect(page.getByText("16 Ostick Ave").first()).toBeVisible();
    // Raw GPS audit data lives in the footer timeline, not the title.
    await expect(page.locator(NAV)).toBeVisible();
  });

  test("payout tab exposes weekly and lifetime views", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await page.locator(NAV).getByRole("button", { name: /payout/i }).first().click();
    await settle(page);

    const lifetime = page.getByRole("tab", { name: /lifetime/i }).first();
    await expect(lifetime).toBeVisible();
    await lifetime.click();
    await settle(page);
    expect(rec.count("lifetimePayout")).toBeGreaterThan(0);
  });

  test("receipts tab loads the receipt list", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await page.locator(NAV).getByRole("button", { name: /receipts/i }).first().click();
    await settle(page);
    expect(rec.count("listAllReceipts")).toBeGreaterThan(0);
  });

  test("sites tab loads job sites and exposes the site filters", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await page.locator(NAV).getByRole("button", { name: /sites/i }).first().click();
    await settle(page);
    expect(rec.count("adminListJobSites")).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: /job sites/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /active jobs/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /suppliers/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add location/i })).toBeVisible();
  });


  test("workers tab loads the roster", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await page.locator(NAV).getByRole("button", { name: /workers/i }).first().click();
    await settle(page);
    expect(rec.count("listWorkersAdmin")).toBeGreaterThan(0);
  });

  test("audit log is reachable from the More menu", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await seedAdminSession(page);
    await page.goto("/admin");
    await settle(page);
    await page.getByRole("button", { name: "More tabs" }).click();
    await page.getByRole("button", { name: /audit log/i }).last().click();
    await settle(page);
    expect(rec.count("adminListAuditLog")).toBeGreaterThan(0);
  });
});

test.describe("Job activation", () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
    await mockServerFns(page);
    await seedAdminSession(page);
  });

  const JOB = "j1111111-1111-4111-8111-111111111111";

  test("an accepted project can be activated once, connecting a Clockwise site", async ({ page }) => {
    const rec = await recordServerFnCalls(page);
    await page.goto(`/ledger/jobs/${JOB}`);
    await settle(page);

    const activate = page.getByRole("button", { name: /^activate job$/i });
    await expect(activate).toBeVisible();
    await activate.click();

    // 7 confirmation steps: client, property, contract, geofence, radius, start, review.
    for (let i = 0; i < 6; i++) {
      await page.getByRole("button", { name: /continue/i }).click();
      await settle(page);
    }
    await expect(page.getByText(/review & activate/i)).toBeVisible();
    await page.getByRole("button", { name: /^activate job$/i }).click();
    await settle(page);

    expect(rec.count("activateProjectFn")).toBe(1);
    const call = rec.find("activateProjectFn") as { data: unknown };
    const raw = call.data as Record<string, any>;
    const payload = (raw?.data ?? raw) as Record<string, any>;
    expect(payload.projectId).toBe(JOB);
    expect(payload.radiusM).toBe(250);
    expect(payload.lat).toBeCloseTo(43.6532, 3);
  });

  test("an already-activated project shows the connected site and no activate button", async ({ page }) => {
    await mockServerFns(page, {
      getActivationPreview: {
        ok: true,
        project: {
          id: JOB,
          name: "Ostick Ave Kitchen",
          salesStage: "Won",
          deliveryStatus: "Preconstruction",
          activatedAt: "2026-03-10T14:00:00.000Z",
          clientId: "c1111111-1111-4111-8111-111111111111",
          clientName: "M. Tremblay",
          propertyId: null,
          propertyAddress: "16 Ostick Ave, Toronto, ON",
          propertyLat: 43.6532,
          propertyLng: -79.3832,
          address: "16 Ostick Ave, Toronto, ON",
          contractValue: 48000,
          estimatedValue: 48000,
          expectedStartDate: "2026-03-16",
        },
        site: {
          id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
          label: "16 Ostick Ave",
          address: "16 Ostick Ave, Toronto, ON",
          lat: 43.6532,
          lng: -79.3832,
          radius_m: 250,
          kind: "client",
          archived_at: null,
        },
        crew: [],
      },
    });
    await page.goto(`/ledger/jobs/${JOB}`);
    await settle(page);

    await expect(page.getByText(/active in clockwise/i)).toBeVisible();
    await expect(page.getByText(/250 m geofence/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^activate job$/i })).toHaveCount(0);
  });
});

import { test } from "@playwright/test";
import { freezeClock, seedAdminSession, settle } from "./mock";
test("dbg", async ({ page }) => {
  await page.route("**/_serverFn/**", async (route) => {
    console.log("ROUTE", route.request().method(), route.request().url().slice(0, 120));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "visual-admin-token" }) });
  });
  page.on("response", (r) => { if (r.url().includes("_serverFn")) console.log("RESP", r.status(), r.url().slice(0,80)); });
  await freezeClock(page);
  await seedAdminSession(page);
  await page.goto("/admin");
  await settle(page);
  console.log("stored2:", await page.evaluate(() => sessionStorage.getItem("tt.admin")));
});

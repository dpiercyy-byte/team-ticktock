import { test } from "@playwright/test";
import { freezeClock, seedAdminSession, settle } from "./mock";
test("dbg", async ({ page }) => {
  await page.route("**/_serverFn/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: { token: "visual-admin-token" }, error: null, context: {} }) }));
  await freezeClock(page);
  await seedAdminSession(page);
  await page.goto("/admin");
  await settle(page);
  console.log("stored2:", await page.evaluate(() => sessionStorage.getItem("tt.admin")));
  console.log((await page.locator("body").innerText()).slice(0, 200).replace(/\n/g, " | "));
});

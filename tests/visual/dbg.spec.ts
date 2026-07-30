import { test } from "@playwright/test";
import { mockServerFns, freezeClock, seedAdminSession, settle } from "./mock";
test("dbg", async ({ page }) => {
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0,200)));
  await freezeClock(page);
  await mockServerFns(page);
  await seedAdminSession(page);
  console.log("stored:", await page.evaluate(() => sessionStorage.getItem("tt.admin")));
  await page.goto("/admin");
  await settle(page);
  console.log("stored2:", await page.evaluate(() => sessionStorage.getItem("tt.admin")));
  console.log((await page.locator("body").innerText()).slice(0, 300));
});

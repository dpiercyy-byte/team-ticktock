import { test } from "@playwright/test";
test("dbg", async ({ page }) => {
  page.on("response", async (r) => {
    if (r.url().includes("_serverFn")) {
      console.log("RESP", r.status(), JSON.stringify(r.headers()), (await r.text()).slice(0, 300));
    }
  });
  await page.goto("/");
  await page.waitForTimeout(3000);
});

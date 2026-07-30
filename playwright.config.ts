import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.VISUAL_BASE_URL ?? "http://localhost:8080";

/**
 * Visual regression config.
 *
 * Baselines are Chromium-on-Linux only. Generate/update them in the Lovable
 * sandbox (or CI) — macOS/Windows font rendering will always diff.
 */
export default defineConfig({
  testDir: "./tests/visual",
  snapshotDir: "./tests/visual/__screenshots__",
  snapshotPathTemplate: "{snapshotDir}/{testFileName}/{arg}-{projectName}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { outputFolder: "tests/visual/.report", open: "never" }]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Font antialiasing / subpixel noise should never fail a run.
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    colorScheme: "light",
    timezoneId: "America/Toronto",
    locale: "en-CA",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: process.env.VISUAL_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

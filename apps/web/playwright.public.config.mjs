import { defineConfig } from "@playwright/test";
import { browserTarget } from "./e2e/target-guard.mjs";

const target = browserTarget(process.env);
if (process.env.E2E_BROWSER_CHANNEL && process.env.E2E_BROWSER_CHANNEL !== "chrome") {
  throw new Error("E2E_BROWSER_CHANNEL may only be chrome when overriding bundled Chromium");
}

export default defineConfig({
  testDir: "./e2e/public",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: "line",
  outputDir: "./test-results",
  use: {
    baseURL: target.baseURL,
    browserName: "chromium",
    channel: process.env.E2E_BROWSER_CHANNEL || undefined,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
});

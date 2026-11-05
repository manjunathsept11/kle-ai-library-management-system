import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Same isolated stack as the E2E suite, but runs the screenshot capture.
export default defineConfig({
  ...base,
  testDir: "./guide",
  reporter: [["list"]],
});

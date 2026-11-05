import { defineConfig } from "@playwright/test";

// Runs against an isolated stack (backend :8001 + fresh DB, frontend :5181),
// so it never touches the dev database or the dev servers.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1, // the specs share one seeded database and run in order
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5181",
    actionTimeout: 15_000, // a wrong selector should fail fast, not hang for the whole test timeout
    channel: "msedge", // use the Edge already on Windows; no browser download
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "e2e\\start-backend.cmd",
      url: "http://localhost:8001/api/v1/health",
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "npx vite --port 5181 --strictPort",
      url: "http://localhost:5181",
      reuseExistingServer: false,
      env: { API_TARGET: "http://localhost:8001" },
      timeout: 60_000,
    },
  ],
});

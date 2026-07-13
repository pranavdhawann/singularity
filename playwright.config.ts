import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4273",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "corepack pnpm --filter @future/api exec tsx ../../tests/e2e/support/openai-compatible-server.ts",
      url: "http://127.0.0.1:4280/health",
      env: { PHASE4_OPENAI_PORT: "4280" },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "corepack pnpm --filter @future/api dev",
      url: "http://127.0.0.1:4274/api/health",
      env: {
        FUTURE_DB_PATH: ":memory:",
        PORT: "4274",
        FUTURE_ALLOWED_ORIGINS: "http://127.0.0.1:4273",
        FUTURE_TEST_OPENAI_KEY: "phase4-test-secret",
        FUTURE_TEST_IMPORT_FAILURE_AFTER_CHUNK: "1",
      },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "corepack pnpm --filter @future/web exec vite --host 127.0.0.1 --port 4273",
      url: "http://127.0.0.1:4273",
      env: { FUTURE_API_PROXY: "http://127.0.0.1:4274" },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});

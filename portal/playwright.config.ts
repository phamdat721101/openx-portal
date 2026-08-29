import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: externalBaseUrl || 'http://localhost:3010',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: externalBaseUrl ? undefined : [
    {
      command: 'cd ../gateway && npm run dev',
      url: 'http://localhost:7411/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3010',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 60 * 1000,
  webServer: {
    command: 'npm run dev -- --port=3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

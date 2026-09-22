import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node src/server.js',
      url: 'http://localhost:4000/health',
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run client',
      url: 'http://localhost:3000',
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 }
      }
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] }
    }
  ],

  webServer: [
    {
      command: 'npm run dev -w backend',
      cwd: '..',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'npm run dev -w frontend',
      cwd: '..',
      url: 'http://localhost:5173',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
});

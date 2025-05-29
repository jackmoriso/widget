import { defineConfig } from '@playwright/test';

/**
 * Reference: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  // Test timeout in milliseconds
  timeout: 120000,
  // Assertion timeout in milliseconds
  expect: {
    timeout: 95000,
  },
  // Run tests in parallel
  fullyParallel: false,
  // Number of retries for each failed test
  retries: 1,
  // Number of workers to run tests
  workers: 1,
  // Test reporters
  reporter: [
    ['html'], // HTML report
    ['list']  // Console list report
  ],
  // Global test configuration
  use: {
    // Base URL - now get from environment variable
    baseURL: process.env.TEST_URL || 'https://initia-widget-playground.vercel.app',
    // Trace collection
    trace: 'on-first-retry',
    // Test screenshots
    screenshot: 'only-on-failure',
    // Set viewport size
    viewport: { width: 1280, height: 720 },
    // Action timeout
    actionTimeout: 30000,
    // If you need to capture all network requests, uncomment below
    // contextOptions: {
    //   recordHar: {
    //     mode: 'minimal',
    //   },
    // },
  },
  // Project configuration
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
      },
    },
  ],
});
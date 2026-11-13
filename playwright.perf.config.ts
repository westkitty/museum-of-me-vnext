import { defineConfig } from '@playwright/test';

/**
 * Representative-device performance harness (not CI: it needs a real GPU and a
 * headed browser). Run with `npm run perf:device` on the device under test;
 * results go to perf-results/ and are checked against tests/perf/budgets.json.
 */
export default defineConfig({
  testDir: './tests/perf',
  testMatch: process.env.PERF_MATCH ?? '*.perf.ts',
  workers: 1,
  retries: 0,
  timeout: 600_000,
  reporter: 'list',
  outputDir: 'test-results/perf',
  use: {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] },
  },
  webServer: [
    { command: 'npx vite preview --host 127.0.0.1 --port 4180 --strictPort', url: 'http://127.0.0.1:4180', reuseExistingServer: false, timeout: 60_000 },
    { command: 'npx vite --host 127.0.0.1 --port 5180 --strictPort', url: 'http://127.0.0.1:5180', reuseExistingServer: false, timeout: 60_000 },
  ],
});

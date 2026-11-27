import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  // Real-time pocket-world routes have their own Metal-capable runner and
  // longer per-journey timeout in playwright.worlds.config.ts.
  testIgnore: ['**/browser/w??-*.e2e.ts', '**/browser/l01-*.e2e.ts', '**/browser/worlds-*.e2e.ts'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  // WebGL application construction on GitHub's software renderer normally
  // takes 10–15 seconds. Keep the test bounded without making runner variance
  // look like a product failure; semantic assertions still have short waits.
  timeout: 120_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  // Playwright empties its outputDir at the start of every run. Never point it
  // at `test-results/` itself: that folder also holds hand-collected evidence
  // (walkabout, traversal, ...). tests/playwright-output-safety.test.ts guards this.
  outputDir: 'test-results/playwright',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 720 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Opt-in local fallback when Playwright's managed Chromium cache is
          // unavailable. CI intentionally keeps the normal managed browser.
          ...(process.env.MUSEUM_BROWSER_EXECUTABLE
            ? { executablePath: process.env.MUSEUM_BROWSER_EXECUTABLE }
            : {}),
          args: process.env.MUSEUM_WORLDS_GL === 'metal'
            ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
            : ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

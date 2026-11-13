import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  outputDir: '../../../test-results/arena',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1280, height: 800 },
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
          ...(process.env.MUSEUM_BROWSER_EXECUTABLE
            ? { executablePath: process.env.MUSEUM_BROWSER_EXECUTABLE }
            : {}),
          args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl'],
        },
      },
    },
  ],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4174',
    cwd: '../../..',
    url: 'http://127.0.0.1:4174/experiments/arena/replacements/_shared/preview.html?slot=E30',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

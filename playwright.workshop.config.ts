import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/workshop-browser',
  testMatch: '**/*.workshop.e2e.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  // Workshop deliberately boots the real museum/WebGL scene before bounding
  // continuous software rendering. Hosted runners vary enough that the same
  // passing journey has taken >40s; give the proof room without adding retries.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: 'test-results/workshop',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 720 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-workshop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

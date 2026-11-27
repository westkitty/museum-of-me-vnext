import { defineConfig, devices } from '@playwright/test';

/**
 * Pocket-world preview journeys (W02..W10, L01), run on their own dev-server
 * port (4191) reserved for this worktree. Headless SwiftShader:
 * this proves behaviour, not GPU performance or the Metal backend.
 */
export default defineConfig({
  testDir: './tests/browser',
  testMatch: /(w\d\d|l01|worlds)-.*\.e2e\.ts$/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 420_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: 'test-results/playwright-worlds',
  use: {
    baseURL: 'http://127.0.0.1:4191',
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
          ...(process.env.MUSEUM_BROWSER_EXECUTABLE ? { executablePath: process.env.MUSEUM_BROWSER_EXECUTABLE } : {}),
          // MUSEUM_WORLDS_GL=metal runs headless Chrome on the Apple Metal ANGLE
          // backend (real GPU); the default stays SwiftShader software GL.
          args: process.env.MUSEUM_WORLDS_GL === 'metal'
            ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
            : ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4191 --strictPort',
    url: 'http://127.0.0.1:4191',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

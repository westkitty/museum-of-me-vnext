import { defineConfig, devices } from '@playwright/test';

/**
 * Local production-activation rehearsal (never a release artifact).
 *
 * Builds the production bundle with VITE_POCKET_REHEARSAL=1 into
 * test-results/rehearsal-dist (git-ignored) and serves it with `vite preview`,
 * so every pocket world is promoted through src/world/pocket/productionWorlds.ts
 * exactly as an eventual release would be. The ordinary `dist/` is untouched.
 */
export default defineConfig({
  testDir: './tests/rehearsal',
  testMatch: '*.rehearsal.ts',
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: 'list',
  outputDir: 'test-results/playwright-rehearsal',
  use: {
    baseURL: 'http://127.0.0.1:4193',
    viewport: { width: 1280, height: 720 },
    trace: 'off', screenshot: 'off', video: 'off',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        ...(process.env.MUSEUM_BROWSER_EXECUTABLE ? { executablePath: process.env.MUSEUM_BROWSER_EXECUTABLE } : {}),
        args: process.env.MUSEUM_WORLDS_GL === 'metal'
          ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
          : ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl'],
      },
    },
  }],
  webServer: {
    command: 'VITE_POCKET_REHEARSAL=1 npx vite build --outDir test-results/rehearsal-dist --emptyOutDir'
      + ' && npx vite preview --outDir test-results/rehearsal-dist --host 127.0.0.1 --port 4193 --strictPort',
    url: 'http://127.0.0.1:4193',
    reuseExistingServer: false,
    timeout: 240_000,
  },
});

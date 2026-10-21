import { defineConfig, devices } from '@playwright/test';

// End-to-end tests in a real browser (real IndexedDB, real tabs, phone-sized
// viewports). Unit tests stay in Vitest (`npm test`); these are `*.e2e.ts` so
// Vitest never picks them up.
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a flaky test should fail loudly and be fixed, not hidden.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Every spec at 390×844 (the default above).
    { name: 'chromium' },
    // The phone layout spec on a small phone.
    { name: 'chromium-360', testMatch: '**/mobile.e2e.ts', use: { viewport: { width: 360, height: 780 } } },
    // Every app spec on an emulated Android phone: touch, mobile user agent,
    // 412px wide at a 2.625 pixel ratio. (Chromium only: iPhone profiles
    // would emulate size and touch, not Safari's engine; see #21.)
    { name: 'pixel-7', testIgnore: '**/harness.e2e.ts', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.cjs',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  retries: 1,
  workers: 2,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
    ['json', { outputFile: './test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.SYNDES_DOCS_URL ||
      'https://delmacy.github.io/syndes-system/assets/experimentos/livros/b/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  outputDir: './test-results/artifacts',
});

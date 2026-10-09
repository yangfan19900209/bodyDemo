import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', grep: /desktop:/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chrome', grep: /phone portrait:/, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'pages-chrome', grep: /pages:/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4174/bodyDemo/', viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: [{
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  }, {
    command: 'node tests/serve-subpath.mjs',
    url: 'http://127.0.0.1:4174/bodyDemo/',
    reuseExistingServer: true,
    timeout: 30_000,
  }],
});

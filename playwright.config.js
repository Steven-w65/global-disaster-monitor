import { defineConfig } from '@playwright/test';

const pagePath = process.env.GITHUB_ACTIONS ? '/global-disaster-monitor/' : '/';

export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: `http://127.0.0.1:4173${pagePath}` },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: `http://127.0.0.1:4173${pagePath}`,
    reuseExistingServer: !process.env.CI
  }
});

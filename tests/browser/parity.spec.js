import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v3/events**', route => route.fulfill({ json: { events: [] } }));
  await page.route('**/all_hour.geojson', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
  await page.route('**/events/geteventlist/SEARCH**', route => route.fulfill({ json: { features: [] } }));
  await page.goto('./');
});

test('ships a modular dashboard with the current controls and no embedded harness', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Global Disaster Monitor' })).toBeVisible();
  await expect(page.getByLabel('NASA EONET')).toBeChecked();
  await expect(page.getByLabel('USGS')).toBeChecked();
  await expect(page.getByLabel('GDACS')).toBeChecked();
  await expect(page.getByLabel('Filter events by time range')).toHaveValue('7d');
  expect(await page.locator('script:not([src])').count()).toBe(1);
  expect(await page.locator('script[src*="cdn.tailwindcss.com"]').count()).toBe(0);
  expect(await page.locator('script[src*="unpkg.com"]').count()).toBe(0);
  expect(await page.locator('html').getAttribute('data-self-test-result')).toBeNull();
});

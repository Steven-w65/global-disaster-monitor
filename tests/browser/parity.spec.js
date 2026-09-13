import { expect, test } from '@playwright/test';
import { installFeedRoutes } from './fixtures.js';

const browserProblems = new WeakMap();
const expectedMockedFailures = new WeakMap();

function expectMockedHttpFailures(page, count) {
  expectedMockedFailures.set(page, Array.from({ length: count }, () =>
    /^console\.error: Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/
  ));
}

test.beforeEach(async ({ page }) => {
  const problems = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
  });
  browserProblems.set(page, problems);
});

test.afterEach(async ({ page }) => {
  const expected = [...(expectedMockedFailures.get(page) || [])];
  const unexpected = [];
  for (const problem of browserProblems.get(page) || []) {
    const index = expected.findIndex(pattern => pattern.test(problem));
    if (index < 0) unexpected.push(problem);
    else expected.splice(index, 1);
  }
  expect(unexpected).toEqual([]);
  expect(expected).toEqual([]);
});

test('ships a modular dashboard with the current controls and no embedded harness', async ({ page }) => {
  await installFeedRoutes(page, 'healthy');
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Global Disaster Monitor' })).toBeVisible();
  await expect(page.getByLabel('NASA EONET', { exact: true })).toBeChecked();
  await expect(page.getByLabel('USGS', { exact: true })).toBeChecked();
  await expect(page.getByLabel('GDACS', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Filter events by time range')).toHaveValue('7d');
  expect(await page.locator('script:not([src])').count()).toBe(1);
  expect(await page.locator('script[src*="cdn.tailwindcss.com"]').count()).toBe(0);
  expect(await page.locator('script[src*="unpkg.com"]').count()).toBe(0);
  expect(await page.locator('html').getAttribute('data-self-test-result')).toBeNull();
  await expect(page.getByRole('heading', { name: 'Using the monitor' })).toBeVisible();
  await expect(page.locator('footer')).toContainText('rate limits, CORS policies, outages, or schema changes');
  expect(await page.evaluate(() => [
    'runAdapterSelfTests',
    'runRenderingSelfTests',
    'runRefreshSelfTests',
    'runUsageSelfTests',
    'runFinalFixSelfTests'
  ].every(name => !(name in window)))).toBe(true);
});

test('filters sources, types, and time while keeping statistics synchronized', async ({ page }) => {
  await installFeedRoutes(page, 'healthy');
  await page.goto('./');
  await expect(page.locator('#visible-total')).toHaveText('4');
  await page.locator('#time-range').selectOption('all');
  await expect(page.locator('#visible-total')).toHaveText('5');
  await page.getByLabel('Wildfire', { exact: true }).uncheck();
  await expect(page.locator('#visible-total')).toHaveText('3');
  await page.getByLabel('NASA EONET', { exact: true }).uncheck();
  await expect(page.locator('#visible-total')).toHaveText('2');
  await expect(page.locator('#source-stats')).toContainText('USGS Earthquakes');
  await expect(page.locator('#type-stats')).toContainText('Earthquake');
});

test('keeps healthy sources when GDACS fails', async ({ page }) => {
  await installFeedRoutes(page, 'partial-failure');
  expectMockedHttpFailures(page, 1);
  await page.goto('./');
  await expect(page.locator('#source-statuses')).toContainText('GDACS UN');
  await expect(page.locator('#source-statuses')).toContainText('Unable to load');
  await expect(page.locator('#visible-total')).toHaveText('3');
});

test('settles the loading state when every provider fails', async ({ page }) => {
  await installFeedRoutes(page, 'all-failure');
  expectMockedHttpFailures(page, 3);
  await page.goto('./');
  await expect(page.locator('#source-statuses')).toContainText('Unable to load');
  await expect(page.locator('#source-statuses').getByText('Unable to load — retry refresh.')).toHaveCount(3);
  await expect(page.locator('#visible-total')).toHaveText('0');
  await expect(page.locator('#loading-indicator')).toBeHidden();
  await expect(page.locator('#refresh-button')).toBeEnabled();
  await expect(page.locator('#monitor-region')).toHaveAttribute('aria-busy', 'false');
});

test('persists light theme across reload and themes popups and legend', async ({ page }) => {
  await installFeedRoutes(page, 'healthy');
  await page.goto('./');
  const darkLegend = await page.locator('[aria-label="Map legend"]').evaluate(element => getComputedStyle(element).backgroundColor);
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const lightLegend = await page.locator('[aria-label="Map legend"]').evaluate(element => getComputedStyle(element).backgroundColor);
  expect(lightLegend).not.toBe(darkLegend);
});

test('applies a saved theme before the application paints the document body', async ({ page }) => {
  await installFeedRoutes(page, 'healthy');
  await page.addInitScript(() => localStorage.setItem('global-disaster-monitor-theme', 'light'));
  await page.goto('./');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => window.__themeBeforeBodyPaint)).toBe('light');
});

test('keeps the theme control keyboard accessible with a visible focus indicator', async ({ page }) => {
  await installFeedRoutes(page, 'healthy');
  await page.goto('./');
  await expect(page.locator('#visible-total')).toHaveText('4');

  await page.keyboard.press('Tab');
  await expect(page.locator('#theme-toggle')).toBeFocused();
  expect(await page.locator('#theme-toggle').evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.keyboard.press('Space');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('preserves an open popup across a theme update and keeps popup, CTA, and cluster contrast readable', async ({ page }) => {
  await installFeedRoutes(page, 'healthy');
  await page.goto('./');
  await expect(page.locator('#visible-total')).toHaveText('4');

  const marker = page.getByRole('button', { name: /Flood: Fixture flood \(GDACS UN\)/ });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.locator('.popup-body')).toBeVisible();

  await page.locator('#theme-toggle').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.popup-body')).toBeVisible();

  const contrast = await page.evaluate(() => {
    const toRgb = value => value.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
    const luminance = ([red, green, blue]) => [red, green, blue]
      .map(channel => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = selector => {
      const element = document.querySelector(selector);
      const style = getComputedStyle(element);
      const [first, second] = [luminance(toRgb(style.color)), luminance(toRgb(style.backgroundColor))]
        .sort((left, right) => right - left);
      return (first + 0.05) / (second + 0.05);
    };
    return {
      popup: ratio('.leaflet-popup-content-wrapper'),
      cta: ratio('.popup-cta'),
      cluster: ratio('.marker-cluster div')
    };
  });

  expect(contrast.popup).toBeGreaterThanOrEqual(4.5);
  expect(contrast.cta).toBeGreaterThanOrEqual(4.5);
  expect(contrast.cluster).toBeGreaterThanOrEqual(4.5);
});

test('manual refresh replaces records without duplication', async ({ page }) => {
  const feeds = await installFeedRoutes(page, 'healthy');
  await page.goto('./');
  await expect(page.locator('#visible-total')).toHaveText('4');
  feeds.replaceUsgs([
    feeds.usgsFeature('usgs-a', 4.1),
    feeds.usgsFeature('usgs-b', 5.2)
  ]);
  await page.locator('#refresh-button').click();
  await expect(page.locator('#visible-total')).toHaveText('5');
});

test('labels markers and renders provider text as text in a safe popup', async ({ page }) => {
  await installFeedRoutes(page, 'malicious-text');
  await page.goto('./');
  const marker = page.getByRole('button', { name: /Earthquake: .*Malicious.*USGS Earthquakes/ });
  await expect(marker).toBeVisible();
  await marker.click();
  const popup = page.locator('.popup-body');
  await expect(popup).toContainText('<b>Malicious</b>');
  await expect(popup.locator('b')).toHaveCount(0);
  const detail = popup.locator('a.popup-cta');
  await expect(detail).toHaveAttribute('target', '_blank');
  await expect(detail).toHaveAttribute('rel', 'noopener noreferrer');
});

test('does not allow an aborted slow refresh to repopulate a disabled source', async ({ page }) => {
  const feeds = await installFeedRoutes(page, 'slow-eonet');
  await page.goto('./');
  await page.getByLabel('NASA EONET', { exact: true }).uncheck();
  await expect(page.locator('#visible-total')).toHaveText('2');
  feeds.releaseEonet(feeds.eonetPayload);
  await page.waitForTimeout(50);
  await expect(page.locator('#visible-total')).toHaveText('2');
  await expect(page.locator('#source-statuses')).toContainText('Disabled');
});

test('fits at 320 CSS pixels without horizontal document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await installFeedRoutes(page, 'healthy');
  await page.goto('./');
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

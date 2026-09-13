# Modular Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current 76 KB standalone dashboard into a tested Vite-based vanilla JavaScript module application with identical user-visible behavior and a GitHub Pages production build.

**Architecture:** Keep `index.html` as a minimal semantic shell and compose the application from focused ES modules for sources, state/refresh, map rendering, UI rendering, and shared validation. Preserve direct API access in this phase; the optional Worker proxy and NASA FIRMS are separate follow-up plans after modular parity is green.

**Tech Stack:** Node.js 22.12 or newer, Vite 8.3.0, vanilla ES modules, Tailwind CSS 4.3.3 with `@tailwindcss/vite` 4.3.3, Leaflet 1.9.4, Leaflet.markercluster 1.5.3, Vitest 5.0.0 with jsdom 30.0.1, Playwright 1.63.0, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-13-modular-production-architecture-design.md`

## Global Constraints

- Work directly on `main`, as explicitly approved by the user; do not create another feature branch or worktree.
- Keep the UI framework-free: vanilla HTML, CSS, and JavaScript only.
- Preserve the current visual layout, control labels, default dark theme, saved theme preference, marker colors, source toggles, type toggles, time filters, statistics, legend, popups, loading state, and ten-minute refresh behavior.
- Preserve Leaflet 1.9.4 and Leaflet.markercluster 1.5.3 behavior.
- Preserve GeoJSON coordinates as `[longitude, latitude]` until the Leaflet rendering boundary converts them to `[latitude, longitude]`.
- Preserve independent provider failures, 15-second per-source timeouts, refresh cancellation, and stale-generation protection.
- Keep provider text escaped and accept official detail links only with `http:` or `https:` schemes.
- Do not add the Worker proxy, NASA FIRMS, ReliefWeb, NOAA NHC, OpenFEMA, deduplication, severity filtering, or event-list redesign in this plan.
- Do not commit `node_modules/`, `dist/`, Playwright output, credentials, or real environment files.
- Move executable self-tests out of production assets; equivalent unit and browser coverage must pass before deleting the embedded harness.
- Every task ends with a focused commit and a clean `git status --short` except for work intentionally scheduled in the next task.

---

## Target File Responsibilities

- `index.html`: semantic page shell, card/layout markup, CSP-compatible metadata, and one module entry script.
- `src/main.js`: dependency CSS imports, application composition, startup, and teardown registration.
- `src/config.js`: immutable source metadata, colors, timing constants, theme key, and base-path-safe runtime configuration.
- `src/styles.css`: Tailwind import plus the current theme tokens, marker, cluster, popup, card, responsive, and accessibility styles.
- `src/state/store.js`: serializable state, subscriptions, filter derivation, and controlled state mutations.
- `src/sources/source-contract.js`: event validation helpers and source-adapter shape guard.
- `src/sources/source-registry.js`: ordered source descriptors and registry lookup.
- `src/sources/eonet.js`: EONET request construction and normalization.
- `src/sources/usgs.js`: USGS request construction and normalization.
- `src/sources/gdacs.js`: GDACS request construction and normalization.
- `src/services/api-client.js`: fetch, HTTP validation, timeout, cancellation, and safe error classification.
- `src/services/refresh-controller.js`: independent source settlement, refresh generation ownership, and status updates.
- `src/map/map-view.js`: Leaflet initialization, base layer, cluster group, point rendering, popup binding, and cleanup.
- `src/ui/popup.js`: safe popup markup and marker accessible-name generation.
- `src/ui/controls.js`: control initialization, event binding, and loading/disabled state.
- `src/ui/statistics.js`: visible total and source/type group rendering.
- `src/ui/source-status.js`: per-source state and last-refresh rendering.
- `src/ui/render-app.js`: render coordination from one state snapshot.
- `tests/fixtures/*.js`: reviewed provider payloads, including malformed and adversarial records.
- `tests/unit/*.test.js`: module-level behavior tests migrated from the embedded harness.
- `tests/browser/parity.spec.js`: user-visible and accessibility parity tests against the production build.
- `vite.config.js`: Tailwind integration, Vitest configuration, and GitHub Pages base path.
- `playwright.config.js`: production-preview browser-test server and base URL.
- `.github/workflows/verify.yml`: install, unit test, production build, and browser test on pushes and pull requests.
- `.github/workflows/deploy-pages.yml`: verified `dist/` deployment from `main` to GitHub Pages.

---

### Task 1: Establish the build and test foundation

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `playwright.config.js`
- Create: `src/config.js`
- Create: `tests/unit/config.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `TYPE_COLORS`, `SEVERITY_COLORS`, `THEME_KEY`, `REFRESH_INTERVAL_MS`, and `SOURCE_REQUEST_TIMEOUT_MS` from `src/config.js`.
- Produces: scripts `dev`, `build`, `preview`, `test`, `test:watch`, `test:browser`, and `verify`.

- [ ] **Step 1: Write the failing configuration test**

Create `tests/unit/config.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  REFRESH_INTERVAL_MS,
  SEVERITY_COLORS,
  SOURCE_REQUEST_TIMEOUT_MS,
  THEME_KEY,
  TYPE_COLORS
} from '../../src/config.js';

describe('production configuration', () => {
  it('preserves timing and theme contracts', () => {
    expect(REFRESH_INTERVAL_MS).toBe(10 * 60 * 1000);
    expect(SOURCE_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(THEME_KEY).toBe('global-disaster-monitor-theme');
  });

  it('preserves the required disaster and severity colors', () => {
    expect(TYPE_COLORS).toEqual({
      Earthquake: '#ff4444', Wildfire: '#ff9100', Volcano: '#8b4513',
      Storm: '#0099ff', Flood: '#66ccff'
    });
    expect(SEVERITY_COLORS).toEqual({ red: '#ef4444', orange: '#f97316', yellow: '#eab308' });
  });
});
```

- [ ] **Step 2: Create the pinned package manifest and verify the test fails**

Create `package.json`:

```json
{
  "name": "global-disaster-monitor",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:browser": "playwright test",
    "verify": "npm run test && npm run build && npm run test:browser"
  },
  "dependencies": {
    "leaflet": "1.9.4",
    "leaflet.markercluster": "1.5.3"
  },
  "devDependencies": {
    "@playwright/test": "1.63.0",
    "@tailwindcss/vite": "4.3.3",
    "jsdom": "30.0.1",
    "tailwindcss": "4.3.3",
    "vite": "8.3.0",
    "vitest": "5.0.0"
  }
}
```

Run:

```bash
npm install
npm test -- tests/unit/config.test.js
```

Expected: FAIL because `src/config.js` does not exist.

- [ ] **Step 3: Add Vite, Vitest, and Playwright configuration**

Create `vite.config.js`:

```js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const base = process.env.GITHUB_ACTIONS ? '/global-disaster-monitor/' : '/';

export default defineConfig({
  base,
  plugins: [tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    restoreMocks: true
  }
});
```

Create `playwright.config.js`:

```js
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
```

Append these entries to `.gitignore` without removing existing entries:

```gitignore
node_modules/
dist/
playwright-report/
test-results/
.env
.env.*
!.env.example
```

- [ ] **Step 4: Implement immutable configuration**

Create `src/config.js` with exactly the exported names used by the test:

```js
export const THEME_KEY = 'global-disaster-monitor-theme';
export const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
export const SOURCE_REQUEST_TIMEOUT_MS = 15_000;

export const TYPE_COLORS = Object.freeze({
  Earthquake: '#ff4444', Wildfire: '#ff9100', Volcano: '#8b4513',
  Storm: '#0099ff', Flood: '#66ccff'
});

export const SEVERITY_COLORS = Object.freeze({
  red: '#ef4444', orange: '#f97316', yellow: '#eab308'
});

```

- [ ] **Step 5: Run the focused test and build**

Run:

```bash
npm test -- tests/unit/config.test.js
npm run build
```

Expected: 2 tests PASS; Vite builds the still-monolithic page without errors.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json package-lock.json vite.config.js playwright.config.js src/config.js tests/unit/config.test.js .gitignore
git commit -m "build: add modular app toolchain"
```

---

### Task 2: Extract normalized source adapters

**Files:**
- Create: `src/sources/source-contract.js`
- Create: `src/sources/eonet.js`
- Create: `src/sources/usgs.js`
- Create: `src/sources/gdacs.js`
- Create: `src/sources/source-registry.js`
- Create: `tests/fixtures/eonet.js`
- Create: `tests/fixtures/usgs.js`
- Create: `tests/fixtures/gdacs.js`
- Create: `tests/unit/source-contract.test.js`
- Create: `tests/unit/source-adapters.test.js`

**Interfaces:**
- Produces: `parseGeoPoint(coordinates): { longitude, latitude } | null`.
- Produces: `normalizeTimestamp(value): string | null`, `safeUrl(value): string`, `normalizeType(value): string | null`, and `validateEvent(event): NormalizedEvent | null`.
- Produces: adapters with `{ id, label, supportedTypes, transport, buildRequest(context), parseResponse(payload, context) }`.
- Produces: `SOURCE_REGISTRY`, `getSource(sourceId)`, and `listSources()`.

- [ ] **Step 1: Write failing contract tests**

Create `tests/unit/source-contract.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { normalizeTimestamp, parseGeoPoint, safeUrl, validateEvent } from '../../src/sources/source-contract.js';

describe('source contract', () => {
  it('preserves GeoJSON order and rejects invalid coordinates', () => {
    expect(parseGeoPoint([151.2, -33.8])).toEqual({ longitude: 151.2, latitude: -33.8 });
    expect(parseGeoPoint([-181, 0])).toBeNull();
    expect(parseGeoPoint([0, 91])).toBeNull();
    expect(parseGeoPoint(['', 0])).toBeNull();
  });

  it('normalizes dates and accepts only web detail links', () => {
    expect(normalizeTimestamp('2026-09-13T00:00:00Z')).toBe('2026-09-13T00:00:00.000Z');
    expect(normalizeTimestamp('not-a-date')).toBeNull();
    expect(safeUrl('https://example.gov/event/1')).toBe('https://example.gov/event/1');
    expect(safeUrl('javascript:alert(1)')).toBe('');
  });

  it('validates one normalized point event', () => {
    expect(validateEvent({
      id: 'usgs:abc', sourceId: 'usgs', sourceName: 'USGS Earthquakes',
      name: 'M 4.2 test', type: 'Earthquake', severity: 'Magnitude 4.2',
      timestamp: '2026-09-13T00:00:00Z',
      geometry: { type: 'Point', coordinates: [2, 1] },
      detailUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/abc'
    })).toMatchObject({ id: 'usgs:abc', geometry: { type: 'Point', coordinates: [2, 1] } });
  });
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `npm test -- tests/unit/source-contract.test.js`

Expected: FAIL because `src/sources/source-contract.js` does not exist.

- [ ] **Step 3: Implement the source contract without DOM or Leaflet dependencies**

Extract and adapt the current `parseGeoPoint`, type/severity/date normalization, `safeUrl`, case-insensitive property access, and event validation helpers into `src/sources/source-contract.js`. Export every function used by an adapter or test. Keep normalized point events compatible with the existing fields during Phase 1:

```js
export function validateEvent(event) {
  const point = event?.geometry?.type === 'Point' ? parseGeoPoint(event.geometry.coordinates) : null;
  const timestamp = normalizeTimestamp(event?.timestamp);
  const type = normalizeType(event?.type);
  if (!event?.id || !event?.sourceId || !event?.name || !point || !timestamp || !type) return null;
  return Object.freeze({
    ...event,
    type,
    timestamp,
    geometry: Object.freeze({ type: 'Point', coordinates: Object.freeze([point.longitude, point.latitude]) }),
    detailUrl: safeUrl(event.detailUrl)
  });
}
```

- [ ] **Step 4: Add reviewed fixtures and failing adapter tests**

Move the existing embedded EONET, USGS, and GDACS fixture payloads into `tests/fixtures/eonet.js`, `tests/fixtures/usgs.js`, and `tests/fixtures/gdacs.js`. Include the existing cases for malformed coordinates, null USGS magnitude, numeric magnitude strings, GDACS nested report URLs, unsafe URL schemes, missing dates, and unsupported types.

Use these minimum fixture shapes, then copy any additional adversarial cases from the former embedded suite:

```js
// tests/fixtures/eonet.js
export const eonetPayload = { events: [{
  id: 'EONET_1', title: '<b>Recent fire</b>',
  categories: [{ id: 'wildfires', title: 'Wildfires' }],
  geometry: [{ date: '2026-09-12T10:00:00Z', type: 'Point', coordinates: [151.2, -33.8] }],
  sources: [{ id: 'EO', url: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1' }]
}, {
  id: 'EONET_BAD', title: 'Invalid coordinates',
  categories: [{ id: 'wildfires' }],
  geometry: [{ date: '2026-09-12T10:00:00Z', type: 'Point', coordinates: [999, 999] }]
}] };

// tests/fixtures/usgs.js
const feature = (id, mag) => ({
  type: 'Feature', id,
  properties: { mag, place: `Test ${id}`, time: Date.parse('2026-09-12T11:00:00Z'), url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}` },
  geometry: { type: 'Point', coordinates: [142.4, 38.1, 10] }
});
export const usgsPayload = { type: 'FeatureCollection', features: [
  feature('usgs-valid', '4.9'), feature('usgs-zero', 0), feature('usgs-null', null), feature('usgs-blank', ' ')
] };

// tests/fixtures/gdacs.js
export const gdacsPayload = { type: 'FeatureCollection', features: [{
  type: 'Feature',
  properties: {
    eventid: 'GDACS_1', eventname: 'Test flood', eventtype: 'FL', alertlevel: 'Orange',
    fromdate: '2026-09-12T12:00:00Z', url: { report: 'https://www.gdacs.org/report.aspx?eventid=GDACS_1' }
  },
  geometry: { type: 'Point', coordinates: [90.3, 23.7] }
}, {
  type: 'Feature',
  properties: {
    eventid: 'GDACS_UNSAFE', eventname: 'Unsafe link', eventtype: 'FL', alertlevel: 'Yellow',
    fromdate: '2026-09-12T12:00:00Z', url: 'javascript:alert(1)'
  },
  geometry: { type: 'Point', coordinates: [91, 24] }
}] };
```

Create `tests/unit/source-adapters.test.js`:

```js
import { describe, expect, it } from 'vitest';
import eonet from '../../src/sources/eonet.js';
import usgs from '../../src/sources/usgs.js';
import gdacs from '../../src/sources/gdacs.js';
import { eonetPayload } from '../fixtures/eonet.js';
import { usgsPayload } from '../fixtures/usgs.js';
import { gdacsPayload } from '../fixtures/gdacs.js';

describe.each([
  ['eonet', eonet, eonetPayload],
  ['usgs', usgs, usgsPayload],
  ['gdacs', gdacs, gdacsPayload]
])('%s adapter', (id, adapter, payload) => {
  it('implements the source contract and returns validated events', () => {
    expect(adapter.id).toBe(id);
    expect(adapter.defaultEnabled).toBe(true);
    expect(adapter.buildRequest({ timeRange: { start: null, end: null } }).url).toMatch(/^https:/);
    const events = adapter.parseResponse(payload, { now: new Date('2026-09-13T00:00:00Z') });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(event => event.sourceId === id)).toBe(true);
    expect(events.every(event => event.geometry?.type === 'Point' && event.geometry.coordinates.every(Number.isFinite))).toBe(true);
  });
});
```

- [ ] **Step 5: Run adapter tests to verify they fail**

Run: `npm test -- tests/unit/source-contract.test.js tests/unit/source-adapters.test.js`

Expected: contract tests PASS; adapter tests FAIL because the adapter modules do not exist.

- [ ] **Step 6: Extract the three adapters and registry**

Each adapter must export the same descriptor shape. Example `src/sources/usgs.js` boundary:

```js
const USGS_HOUR_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

export default Object.freeze({
  id: 'usgs',
  label: 'USGS Earthquakes',
  defaultEnabled: true,
  supportedTypes: Object.freeze(['Earthquake']),
  transport: 'direct',
  buildRequest() {
    return { url: USGS_HOUR_FEED, options: { headers: { Accept: 'application/geo+json, application/json' } } };
  },
  parseResponse(payload) {
    return (Array.isArray(payload?.features) ? payload.features : [])
      .map(normalizeUsgsFeature)
      .filter(Boolean);
  }
});
```

Create `src/sources/source-registry.js`:

```js
import eonet from './eonet.js';
import usgs from './usgs.js';
import gdacs from './gdacs.js';

const sourcesById = new Map([[eonet.id, eonet], [usgs.id, usgs], [gdacs.id, gdacs]]);
export const SOURCE_REGISTRY = Object.freeze([eonet, usgs, gdacs]);
export const getSource = sourceId => sourcesById.get(sourceId) ?? null;
export const listSources = () => [...SOURCE_REGISTRY];
```

- [ ] **Step 7: Run adapter coverage and commit**

Run:

```bash
npm test -- tests/unit/source-contract.test.js tests/unit/source-adapters.test.js
```

Expected: all contract and adapter tests PASS with coverage for every migrated embedded adapter assertion.

```bash
git add src/sources tests/fixtures tests/unit/source-contract.test.js tests/unit/source-adapters.test.js
git commit -m "refactor: extract disaster source adapters"
```

---

### Task 3: Extract state, filtering, network, and refresh control

**Files:**
- Create: `src/state/store.js`
- Create: `src/services/api-client.js`
- Create: `src/services/refresh-controller.js`
- Create: `tests/unit/store.test.js`
- Create: `tests/unit/api-client.test.js`
- Create: `tests/unit/refresh-controller.test.js`

**Interfaces:**
- Produces: `createStore({ sourceIds, initialState? })` with `getState()`, `subscribe(listener)`, `setTheme(theme)`, `setTimeRange(range)`, `setSourceEnabled(id, enabled)`, `setTypeEnabled(type, enabled)`, `beginRefresh(generation)`, `completeSource(generation, sourceId, events)`, `failSource(generation, sourceId, message)`, and `finishRefresh(generation, completedAt)`.
- Produces: `selectVisibleEvents(state, now): NormalizedEvent[]` and `selectStatistics(state, now)`.
- Produces: `fetchJson(request, { signal, timeoutMs, fetchImpl }): Promise<unknown>`.
- Produces: `createRefreshController({ store, sources, fetchJson, timeoutMs, now })` with `refresh()` and `dispose()`.

- [ ] **Step 1: Write failing store and selector tests**

Create `tests/unit/store.test.js` with fixed timestamps and events from at least two sources:

```js
import { describe, expect, it, vi } from 'vitest';
import { createStore, selectStatistics, selectVisibleEvents } from '../../src/state/store.js';

describe('store selectors', () => {
  it('filters by enabled source, type, and seven-day range without mutating records', () => {
    const store = createStore({ sourceIds: ['eonet', 'usgs', 'gdacs'] });
    store.beginRefresh(1);
    store.completeSource(1, 'usgs', [event('recent-eq', 'usgs', 'Earthquake', '2026-09-12T00:00:00Z')]);
    store.completeSource(1, 'eonet', [event('old-fire', 'eonet', 'Wildfire', '2026-08-01T00:00:00Z')]);
    store.finishRefresh(1, '2026-09-13T00:00:00Z');
    expect(selectVisibleEvents(store.getState(), new Date('2026-09-13T00:00:00Z')).map(item => item.id)).toEqual(['recent-eq']);
    expect(selectStatistics(store.getState(), new Date('2026-09-13T00:00:00Z')).total).toBe(1);
  });

  it('ignores completion from an older refresh generation', () => {
    const store = createStore({ sourceIds: ['eonet', 'usgs', 'gdacs'] });
    store.beginRefresh(1);
    store.beginRefresh(2);
    store.completeSource(1, 'usgs', [event('stale', 'usgs', 'Earthquake', '2026-09-13T00:00:00Z')]);
    expect(store.getState().eventsBySource.usgs).toEqual([]);
  });
});
```

Define this local fixture helper above the tests:

```js
const event = (id, sourceId, type, timestamp) => ({
  id,
  sourceId,
  sourceName: sourceId === 'usgs' ? 'USGS Earthquakes' : 'NASA EONET',
  name: id,
  type,
  severity: 'Not specified',
  timestamp,
  geometry: { type: 'Point', coordinates: [20, 10] },
  detailUrl: 'https://example.gov/event'
});
```

- [ ] **Step 2: Run the store tests to verify they fail**

Run: `npm test -- tests/unit/store.test.js`

Expected: FAIL because `src/state/store.js` does not exist.

- [ ] **Step 3: Implement immutable snapshots and derived selectors**

`createStore({ sourceIds, initialState })` owns mutable internals but `getState()` returns the current frozen snapshot. Emit subscribers only after a complete named mutation. Use `eventsBySource` rather than one undifferentiated event array so a failed source can retain or clear only its own data according to the existing refresh contract.

Implement range constants as `'7d'`, `'30d'`, and `'all'`; keep the initial value `'7d'`. `selectStatistics()` returns:

```js
{
  total,
  bySource: { eonet: 0, usgs: 0, gdacs: 0 },
  byType: { Earthquake: 0, Wildfire: 0, Volcano: 0, Storm: 0, Flood: 0 }
}
```

- [ ] **Step 4: Write failing API client tests**

Create `tests/unit/api-client.test.js` using `vi.fn()` fetch implementations:

```js
it('rejects a non-success response with a safe classified error', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  await expect(fetchJson({ url: 'https://example.gov/feed', options: {} }, {
    fetchImpl, timeoutMs: 50
  })).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 503 });
});

it('times out a never-settling request', async () => {
  vi.useFakeTimers();
  const result = fetchJson({ url: 'https://example.gov/feed', options: {} }, {
    fetchImpl: () => new Promise(() => {}), timeoutMs: 20
  });
  await vi.advanceTimersByTimeAsync(21);
  await expect(result).rejects.toMatchObject({ code: 'TIMEOUT' });
  vi.useRealTimers();
});
```

- [ ] **Step 5: Implement `fetchJson` and run its tests**

Compose the parent abort signal with a request-local `AbortController`. Clear the timeout in `finally`. Reject non-2xx responses before reading JSON. Expose safe error fields `code` and optional `status`; do not include response bodies or secret-bearing URLs.

Run: `npm test -- tests/unit/api-client.test.js`

Expected: HTTP, invalid JSON, parent abort, and timeout tests PASS.

- [ ] **Step 6: Write failing refresh-controller tests**

Create `tests/unit/refresh-controller.test.js` covering:

```js
it('settles sources independently and prevents an older refresh from winning', async () => {
  const sources = [source('eonet'), source('usgs'), source('gdacs')];
  const store = createStore({ sourceIds: sources.map(sourceItem => sourceItem.id) });
  const first = deferred();
  const fetchJson = vi.fn()
    .mockImplementationOnce(() => first.promise)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ events: [{ id: 'gdacs-new' }] })
    .mockResolvedValueOnce({ events: [{ id: 'eonet-newest' }] });
  const controller = createRefreshController({ store, sources, fetchJson, timeoutMs: 50, now: fixedNow });
  const older = controller.refresh();
  const newer = controller.refresh({ sourceIds: ['eonet'] });
  await newer;
  first.resolve({ events: [{ id: 'eonet-stale' }] });
  await older;
  expect(store.getState().eventsBySource.eonet[0].id).toBe('eonet-newest');
  expect(store.getState().sourceStatus.usgs.kind).toBe('error');
});
```

Define these helpers above the tests:

```js
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const normalized = (id, sourceId) => ({
  id,
  sourceId,
  sourceName: sourceId,
  name: id,
  type: sourceId === 'usgs' ? 'Earthquake' : 'Storm',
  severity: 'Not specified',
  timestamp: '2026-09-13T00:00:00.000Z',
  geometry: { type: 'Point', coordinates: [20, 10] },
  detailUrl: 'https://example.gov/event'
});

const source = id => ({
  id,
  label: id,
  buildRequest: () => ({ url: `https://example.gov/${id}`, options: {} }),
  parseResponse: payload => (payload.events ?? []).map(item => normalized(item.id, id))
});

const fixedNow = () => new Date('2026-09-13T00:00:00Z');
```

- [ ] **Step 7: Implement refresh control and run the service suite**

`refresh()` increments an internal generation, aborts the prior controller, marks enabled sources loading, runs their `buildRequest`, calls `fetchJson`, calls `parseResponse`, and applies results through the generation-aware store. Use `Promise.allSettled()` so a rejection cannot short-circuit other sources. `dispose()` aborts active work and makes future `refresh()` calls reject with `DISPOSED`.

Run:

```bash
npm test -- tests/unit/store.test.js tests/unit/api-client.test.js tests/unit/refresh-controller.test.js
```

Expected: filtering, statistics, cancellation, timeout, independent failure, and stale-generation tests PASS.

- [ ] **Step 8: Commit the data-flow modules**

```bash
git add src/state src/services tests/unit/store.test.js tests/unit/api-client.test.js tests/unit/refresh-controller.test.js
git commit -m "refactor: extract disaster refresh state"
```

---

### Task 4: Extract safe UI and Leaflet map modules

**Files:**
- Create: `src/ui/popup.js`
- Create: `src/ui/statistics.js`
- Create: `src/ui/source-status.js`
- Create: `src/ui/controls.js`
- Create: `src/ui/render-app.js`
- Create: `src/map/map-view.js`
- Create: `tests/unit/popup.test.js`
- Create: `tests/unit/ui-renderers.test.js`
- Create: `tests/unit/map-view.test.js`

**Interfaces:**
- Produces: `buildPopupContent(event): string` and `markerAccessibleName(event): string`.
- Produces: `renderStatistics(root, statistics, sources): void`.
- Produces: `renderSourceStatus(root, state, sources): void`.
- Produces: `bindControls(root, { store, requestRefresh }): () => void` and `renderControlState(root, state): void`.
- Produces: `createMapView({ element, leaflet, markerClusterFactory?, colors }): { render(events), setTheme(theme), destroy() }`; omitted `markerClusterFactory` defaults to `() => leaflet.markerClusterGroup()`.
- Produces: `createAppRenderer({ root, store, mapView, sources, now }): () => void` returning an unsubscribe function.

- [ ] **Step 1: Write failing popup safety tests**

Create `tests/unit/popup.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { buildPopupContent, markerAccessibleName } from '../../src/ui/popup.js';

it('escapes provider text and secures an allowed official link', () => {
  const html = buildPopupContent(event({ name: '<img src=x onerror=alert(1)>', detailUrl: 'https://example.gov/event' }));
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<img');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noopener noreferrer"');
});

it('omits unsafe links and creates an accessible marker name', () => {
  const unsafe = event({ detailUrl: 'javascript:alert(1)' });
  expect(buildPopupContent(unsafe)).not.toContain('javascript:');
  expect(markerAccessibleName(unsafe)).toBe('Earthquake: Test event (USGS Earthquakes)');
});
```

Define this helper above the popup tests:

```js
const event = overrides => ({
  id: 'usgs:test',
  sourceId: 'usgs',
  sourceName: 'USGS Earthquakes',
  name: 'Test event',
  type: 'Earthquake',
  severity: 'Magnitude 4.2',
  timestamp: '2026-09-13T00:00:00.000Z',
  geometry: { type: 'Point', coordinates: [20, 10] },
  detailUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/test',
  ...overrides
});
```

- [ ] **Step 2: Run the popup tests to verify they fail, then implement the module**

Run: `npm test -- tests/unit/popup.test.js`

Expected: FAIL because `src/ui/popup.js` does not exist.

Move escaping, localized date formatting, coordinate formatting, popup markup, and accessible-name logic into `src/ui/popup.js`. The module may use safe formatting helpers but must not access global state or mutate the DOM.

Run again; expected: all popup tests PASS.

- [ ] **Step 3: Write failing renderer tests against semantic fixture markup**

Create `tests/unit/ui-renderers.test.js` with `document.body.innerHTML` containing `#visible-total`, `#source-stats`, `#type-stats`, `#source-statuses`, `#last-refresh`, and the current control IDs. Assert exact source/type counts, loading/error text, checkbox synchronization, the loading element's `hidden` property, refresh-button disabled state, and `aria-busy` on `#monitor-region`.

The central renderer assertion is:

```js
document.body.innerHTML = `
  <main id="monitor-region" aria-busy="false">
    <span id="visible-total"></span><div id="source-stats"></div><div id="type-stats"></div>
    <div id="source-statuses"></div><span id="last-refresh"></span>
    <span id="loading-indicator" hidden></span><button id="refresh-button"></button>
  </main>`;

renderStatistics(document, {
  total: 3,
  bySource: { eonet: 1, usgs: 1, gdacs: 1 },
  byType: { Earthquake: 1, Wildfire: 1, Volcano: 0, Storm: 0, Flood: 1 }
}, sources);

expect(document.querySelector('#visible-total').textContent).toBe('3');
expect(document.querySelector('#source-stats').textContent).toContain('NASA EONET');
expect(document.querySelector('#type-stats').textContent).toContain('Earthquake');
```

Add a second assertion that passes source states `{ eonet: { kind: 'success', count: 1 }, usgs: { kind: 'loading' }, gdacs: { kind: 'error', message: 'Unable to load' } }` to `renderSourceStatus()` and checks all three labels and messages. Add a third assertion that calls `renderControlState(document, { isLoading: true })`, expects `hidden === false`, button disabled, and `aria-busy="true"`, then repeats with `isLoading: false` and expects the inverse.

Run: `npm test -- tests/unit/ui-renderers.test.js`

Expected: FAIL because the renderer modules do not exist.

- [ ] **Step 4: Implement DOM renderers and control binding**

Render source controls and source statistics from `listSources()` rather than hard-coded provider branches. Render disaster types from `TYPE_COLORS`. Return a disposer from `bindControls()` that removes every event listener and clears no application state.

`render-app.js` subscribes once to the store and performs:

```js
const visibleEvents = selectVisibleEvents(state, now());
mapView.render(visibleEvents);
mapView.setTheme(state.theme);
renderStatistics(root, selectStatistics(state, now()), sources);
renderSourceStatus(root, state, sources);
renderControlState(root, state);
```

Run: `npm test -- tests/unit/ui-renderers.test.js`

Expected: renderer and control tests PASS.

- [ ] **Step 5: Write failing map-view tests using injected Leaflet doubles**

Create `tests/unit/map-view.test.js` with a minimal fake Leaflet API and cluster object. Assert:

- initialization uses `[0, 0]` and zoom `2`;
- the tile URL is `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;
- render clears old cluster layers before adding current markers;
- point geometry remains `[longitude, latitude]` until marker input becomes `[latitude, longitude]` exactly once;
- the marker receives `title`, `alt`, and `aria-label` from `markerAccessibleName()`;
- GDACS red/orange/yellow severity changes only the marker outline;
- `destroy()` clears the refresh-visible layer and removes the Leaflet map.

Build the double with observable methods rather than importing a browser Leaflet instance:

```js
const cluster = { addLayer: vi.fn(), clearLayers: vi.fn(), addTo: vi.fn().mockReturnThis() };
const map = { setView: vi.fn().mockReturnThis(), remove: vi.fn() };
const markerElement = document.createElement('button');
const marker = {
  bindPopup: vi.fn().mockReturnThis(),
  getElement: vi.fn(() => markerElement),
  on: vi.fn((name, listener) => { if (name === 'add') listener(); return marker; })
};
const leaflet = {
  map: vi.fn(() => map),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  markerClusterGroup: vi.fn(() => cluster),
  divIcon: vi.fn(options => options),
  marker: vi.fn(() => marker)
};

const view = createMapView({ element: document.createElement('div'), leaflet, colors: TYPE_COLORS });
view.render([event({ geometry: { type: 'Point', coordinates: [151.2, -33.8] } })]);
expect(map.setView).toHaveBeenCalledWith([0, 0], 2);
expect(cluster.clearLayers).toHaveBeenCalledTimes(1);
expect(leaflet.marker).toHaveBeenCalledWith([-33.8, 151.2], expect.objectContaining({
  title: expect.stringContaining('Test event'),
  alt: expect.stringContaining('Test event')
}));
expect(markerElement.getAttribute('aria-label')).toContain('Test event');
```

Run: `npm test -- tests/unit/map-view.test.js`

Expected: FAIL because `src/map/map-view.js` does not exist.

- [ ] **Step 6: Implement the injected map boundary**

`createMapView()` owns the base tile layer and one cluster group. Import no global `state`. Construct Leaflet positions only here:

```js
const [longitude, latitude] = event.geometry.coordinates;
const position = [latitude, longitude];
const marker = leaflet.marker(position, {
  icon: createPointIcon(event, colors, leaflet),
  title: markerAccessibleName(event),
  alt: markerAccessibleName(event),
  riseOnHover: true
});
marker.on('add', () => marker.getElement()?.setAttribute('aria-label', markerAccessibleName(event)));
```

Use `https://tile.openstreetmap.org/{z}/{x}/{y}.png` rather than retired subdomains. Preserve visible OpenStreetMap attribution and current zoom controls.

Run:

```bash
npm test -- tests/unit/popup.test.js tests/unit/ui-renderers.test.js tests/unit/map-view.test.js
```

Expected: all UI and map module tests PASS.

- [ ] **Step 7: Commit map and UI modules**

```bash
git add src/ui src/map tests/unit/popup.test.js tests/unit/ui-renderers.test.js tests/unit/map-view.test.js
git commit -m "refactor: extract map and dashboard rendering"
```

---

### Task 5: Replace the monolith with the modular application

**Files:**
- Create: `src/main.js`
- Create: `src/styles.css`
- Create: `tests/browser/parity.spec.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: all configuration, source, state, refresh, map, and UI interfaces from Tasks 1–4.
- Produces: `initializeApp(document): { dispose(): void }` from `src/main.js`.
- Produces: a production `index.html` with no application inline script, no CDN dependencies, and one `<script type="module" src="/src/main.js"></script>`.

- [ ] **Step 1: Write a browser parity test that requires modular production output**

Create `tests/browser/parity.spec.js`:

```js
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
```

The one allowed inline script is the guarded pre-paint theme bootstrap. It contains no provider, render, refresh, or test logic.

- [ ] **Step 2: Build and verify the parity test fails on the monolith**

Run:

```bash
npm run build
npx playwright install chromium
npm run test:browser -- tests/browser/parity.spec.js
```

Expected: FAIL because the page still loads CDN scripts and contains the embedded application/self-test scripts.

- [ ] **Step 3: Extract current custom styles and compile Tailwind**

Create `src/styles.css` beginning with:

```css
@import "tailwindcss";

:root {
  color-scheme: dark;
  --page: #121212;
  --card: #1e1e1e;
}
```

Move every current custom theme token, loading rule, popup rule, marker rule, cluster rule, hover/focus rule, and responsive adjustment from `index.html` into this file. Preserve the reviewed contrast values and keep `#loading-indicator[hidden] { display: none; }`.

- [ ] **Step 4: Implement application composition**

Create `src/main.js`:

```js
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './styles.css';
import { REFRESH_INTERVAL_MS, SOURCE_REQUEST_TIMEOUT_MS, TYPE_COLORS } from './config.js';
import { createMapView } from './map/map-view.js';
import { fetchJson } from './services/api-client.js';
import { createRefreshController } from './services/refresh-controller.js';
import { listSources } from './sources/source-registry.js';
import { createStore } from './state/store.js';
import { bindControls } from './ui/controls.js';
import { createAppRenderer } from './ui/render-app.js';

export function initializeApp(root = document) {
  const sources = listSources();
  const store = createStore({
    sourceIds: sources.map(source => source.id),
    initialState: { theme: root.documentElement.dataset.theme === 'light' ? 'light' : 'dark' }
  });
  const mapView = createMapView({ element: root.querySelector('#map'), leaflet: L, colors: TYPE_COLORS });
  const refreshController = createRefreshController({ store, sources, fetchJson, timeoutMs: SOURCE_REQUEST_TIMEOUT_MS });
  const stopRendering = createAppRenderer({ root, store, mapView, sources, now: () => new Date() });
  const unbindControls = bindControls(root, { store, requestRefresh: () => refreshController.refresh() });
  const interval = window.setInterval(() => refreshController.refresh(), REFRESH_INTERVAL_MS);
  refreshController.refresh();
  return { dispose() { clearInterval(interval); unbindControls(); stopRendering(); refreshController.dispose(); mapView.destroy(); } };
}

initializeApp();
```

Integrate the existing theme read/write/apply helpers through `controls.js` and `store.js`; keep the pre-paint bootstrap in `<head>` because it prevents a theme flash.

- [ ] **Step 5: Reduce `index.html` to semantic markup**

Keep all current IDs and accessible labels used by the modules and browser tests. Remove Tailwind CDN, Leaflet CDN, MarkerCluster CDN, the monolithic application script, and all embedded self-test functions. Add only:

```html
<link rel="icon" href="data:,">
<script type="module" src="/src/main.js"></script>
```

Add this Phase 1 policy in `<head>`; the small pre-paint theme script is the only inline script allowed:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://eonet.gsfc.nasa.gov https://earthquake.usgs.gov https://www.gdacs.org; img-src 'self' data: blob: https://tile.openstreetmap.org; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests">
```

Keep the inline pre-paint theme bootstrap guarded by `try/catch`. It may read `localStorage`, set `document.documentElement.dataset.theme`, and set `window.__themeBeforeBodyPaint`; it may do nothing else.

- [ ] **Step 6: Run unit, build, and focused browser tests**

Run:

```bash
npm test
npm run build
npm run test:browser -- tests/browser/parity.spec.js
```

Expected: all unit tests PASS; production build succeeds; parity test PASS; built HTML references hashed local assets and no application CDN scripts.

- [ ] **Step 7: Commit the modular application switch**

```bash
git add index.html src/main.js src/styles.css tests/browser/parity.spec.js
git commit -m "refactor: compose dashboard from modules"
```

---

### Task 6: Restore the full browser behavior matrix

**Files:**
- Modify: `tests/browser/parity.spec.js`
- Create: `tests/browser/fixtures.js`
- Modify: `tests/unit/source-adapters.test.js`
- Modify: `tests/unit/refresh-controller.test.js`

**Interfaces:**
- Consumes: public DOM labels/IDs and `initializeApp()` behavior; does not expose test-only globals in production.
- Produces: browser coverage equivalent to the former adapter, rendering, refresh, usage, final-fix, and live-refresh-guard suites.

- [ ] **Step 1: Add deterministic browser API fixtures**

Create `tests/browser/fixtures.js` exporting `installFeedRoutes(page, scenario)`. Support named scenarios `healthy`, `partial-failure`, `all-failure`, `slow-eonet`, and `malicious-text`. Each route fulfills provider-shaped payloads rather than already-normalized events.

The healthy scenario must include:

- one recent USGS earthquake with magnitude `4.9`;
- one EONET wildfire and one EONET storm;
- one GDACS flood with orange severity;
- one event older than 30 days;
- longitudes and latitudes with different absolute values so accidental reversal fails visibly.

- [ ] **Step 2: Add failing parity cases before adjusting production modules**

Add these Playwright cases. `installFeedRoutes()` returns a control object whose `replaceUsgs(features)` changes the next USGS response and whose `releaseEonet(payload)` resolves the held EONET route in the `slow-eonet` scenario:

```js
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
  await page.goto('./');
  await expect(page.locator('#source-statuses')).toContainText('GDACS UN');
  await expect(page.locator('#source-statuses')).toContainText('Unable to load');
  await expect(page.locator('#visible-total')).toHaveText('3');
});

test('persists light theme across reload and themes popups and legend', async ({ page }) => {
  await installFeedRoutes(page, 'healthy');
  await page.goto('./');
  const darkLegend = await page.locator('[aria-label="Map legend"]').evaluate(element => getComputedStyle(element).backgroundColor);
  await page.locator('#theme-toggle').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const lightLegend = await page.locator('[aria-label="Map legend"]').evaluate(element => getComputedStyle(element).backgroundColor);
  expect(lightLegend).not.toBe(darkLegend);
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
```

Run: `npm run build && npm run test:browser`

Expected: every new case executes deterministically. Any failure is a concrete parity gap and must be recorded before modifying production code. If all cases pass on the first run, make no production change in Step 3.

- [ ] **Step 3: Fix only observed parity gaps**

For each failing case, change the responsible module rather than adding test-only branches. Examples:

- source count mismatch: fix `selectStatistics()` or adapter fixture normalization;
- duplicate markers: fix `mapView.render()` clearing;
- stale refresh: fix generation checks in `store.js` or `refresh-controller.js`;
- theme mismatch: fix CSS variables or theme application in `controls.js`;
- unsafe popup: fix `popup.js`, never relax the assertion;
- mobile overflow: fix the exact layout rule in `styles.css`.

- [ ] **Step 4: Compare migrated checks to the former 107-check categories**

Create a checklist in the commit message notes or task log mapping every former category to a unit or browser test:

```text
adapter 30 -> source-contract.test.js + source-adapters.test.js
rendering 13 -> popup.test.js + ui-renderers.test.js + map-view.test.js
refresh 27 -> api-client.test.js + refresh-controller.test.js + parity.spec.js
usage 1 -> parity.spec.js footer/content assertion
final 36 -> unit safety tests + browser accessibility/responsive/theme assertions
live guard 2 -> refresh-controller cancellation and browser slow-refresh assertion
```

No numerical one-to-one assertion count is required, but no behavior category may disappear.

- [ ] **Step 5: Run the complete verification suite twice**

Run:

```bash
npm run verify
npm run verify
```

Expected: both consecutive runs PASS with no retries, no leaked localhost process, and no browser console errors.

- [ ] **Step 6: Commit full parity coverage**

```bash
git add tests src
git commit -m "test: preserve modular dashboard parity"
```

---

### Task 7: Add verified GitHub Pages delivery and operator documentation

**Files:**
- Create: `.github/workflows/verify.yml`
- Create: `.github/workflows/deploy-pages.yml`
- Create: `.env.example`
- Create: `tests/unit/deployment-config.test.js`
- Modify: `README.md`

**Interfaces:**
- Produces: CI command `npm ci && npm run verify`.
- Produces: GitHub Pages artifact from `dist/` only after tests pass.
- Produces: documented local development, verification, build, deployment, browser/API limitations, and future proxy configuration.

- [ ] **Step 1: Write a failing deployment-configuration test**

Create `tests/unit/deployment-config.test.js`:

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('deployment configuration', () => {
  it('verifies before deploying only the production artifact', () => {
    expect(read('.github/workflows/verify.yml')).toContain('npm run verify');
    const deploy = read('.github/workflows/deploy-pages.yml');
    expect(deploy).toContain('npm run verify');
    expect(deploy).toContain('path: ./dist');
    expect(deploy).toContain('actions/deploy-pages@');
  });

  it('documents exact local and production commands', () => {
    const readme = read('README.md');
    for (const command of ['npm install', 'npm run dev', 'npm run verify', 'npm run build']) {
      expect(readme).toContain(command);
    }
  });
});
```

- [ ] **Step 2: Run the deployment test to verify it fails**

Run: `npm test -- tests/unit/deployment-config.test.js`

Expected: FAIL because the workflow files do not exist and the README lacks the required commands.

- [ ] **Step 3: Add the verification workflow**

Create `.github/workflows/verify.yml` with `pull_request` and `push` triggers, `actions/checkout`, `actions/setup-node` using Node `24`, `npm ci`, `npx playwright install --with-deps chromium`, and `npm run verify`. Give it only `contents: read` permission.

The key job steps must be:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: npm
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run verify
```

- [ ] **Step 4: Add the Pages workflow**

Create `.github/workflows/deploy-pages.yml` triggered by pushes to `main` and manual dispatch. Set permissions to `contents: read`, `pages: write`, and `id-token: write`; set the `github-pages` environment. Its build job runs the same install and verification commands, uploads `./dist` with `actions/upload-pages-artifact`, and its deploy job uses `actions/deploy-pages`.

Do not upload the repository root, source fixtures, or `node_modules`.

- [ ] **Step 5: Document operation and future proxy configuration**

Replace the one-line README with sections for:

- project purpose and current providers;
- prerequisites: Node.js 22.12 or newer;
- `npm install`, `npm run dev`, `npm run verify`, and `npm run build`;
- production output in `dist/`;
- GitHub Pages workflow and repository Pages setting;
- public API, CORS, availability, and rate-limit caveats;
- OpenStreetMap attribution and tile-policy expectations;
- current direct-source architecture;
- future empty `VITE_PROXY_BASE_URL` setting, explicitly stating that Phase 1 does not deploy a proxy or require a secret.

Create `.env.example`:

```dotenv
# Optional in a later proxy phase. Leave empty for Phase 1 direct-source mode.
VITE_PROXY_BASE_URL=
```

- [ ] **Step 6: Run deployment tests and inspect the build artifact**

Run:

```bash
npm test -- tests/unit/deployment-config.test.js
npm run verify
```

Then verify:

```bash
rg -n "cdn.tailwindcss.com|unpkg.com|runAdapterSelfTests|runFinalFixSelfTests|self-test" dist
```

Expected: deployment tests and full verification PASS; `rg` returns no matches.

- [ ] **Step 7: Commit delivery configuration**

```bash
git add .github .env.example README.md tests/unit/deployment-config.test.js
git commit -m "ci: verify and deploy modular dashboard"
```

---

### Task 8: Final Phase 1 verification and handoff

**Files:**
- Modify only if verification exposes a concrete regression.

**Interfaces:**
- Produces: a clean `main` branch whose committed source, tests, and `dist/` build process satisfy Phase 1 completion criteria.

- [ ] **Step 1: Verify repository integrity**

Run:

```bash
git status --short
git diff --check
git log --oneline -8
```

Expected: clean status, no whitespace errors, and one focused commit for each completed task.

- [ ] **Step 2: Run final automated verification**

Run:

```bash
npm ci
npm run verify
```

Expected: clean install, all unit tests PASS, build PASS, all Chromium browser tests PASS.

- [ ] **Step 3: Perform live-feed smoke testing**

Run `npm run dev -- --host 127.0.0.1`, then verify in Chromium:

- the app starts in the saved/default theme without a paint flash;
- OpenStreetMap tiles render through HTTP;
- each reachable source reports a loaded count;
- a failing source displays its own error without clearing healthy-source markers;
- source, type, and time controls update visible statistics;
- manual refresh clears and replaces markers;
- a marker popup displays escaped content, correct coordinates, source, timestamp, severity, and a secure official link;
- no console errors occur other than clearly explained third-party network failures.

- [ ] **Step 4: Confirm production contents and Phase 1 scope**

Inspect `dist/` and confirm it contains only deployable static assets. Confirm there is no API credential, Worker code bundled into the browser, embedded test harness, or implementation of deferred providers.

- [ ] **Step 5: Record final outcome**

If verification required fixes, commit each tested fix with a focused `fix:` message. Otherwise do not create an empty commit. Report:

- unit-test total;
- browser-test total;
- production build result;
- live provider status observed during smoke testing;
- final commit hash;
- any provider outage or CORS limitation that remains external to Phase 1.

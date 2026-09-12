# Global Disaster Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, extensible global disaster monitoring map that combines NASA EONET, USGS, and GDACS feeds with filtering, statistics, clustering, resilient refreshes, and persistent dark/light themes.

**Architecture:** One `index.html` contains semantic markup, Tailwind utility classes, a small custom style block, and module-organized vanilla JavaScript. Source adapters normalize provider payloads into one event model; centralized state then drives filters, Leaflet marker clusters, statistics, statuses, and refresh scheduling.

**Tech Stack:** HTML5, vanilla JavaScript, Tailwind CSS CDN, Leaflet 1.9.4 CDN, Leaflet.markercluster 1.5.3 CDN, OpenStreetMap tiles

**Spec:** `docs/superpowers/specs/2026-09-12-global-disaster-monitor-design.md`

## Global Constraints

- Keep all runtime application code in a single `index.html` file with no framework, backend, package installation, or build step.
- Load Tailwind CSS, Leaflet 1.9.4, Leaflet.markercluster 1.5.3, and OpenStreetMap tiles from public CDNs.
- Initialize the map at `[0, 0]` and zoom `2`.
- Read GeoJSON coordinates as `[longitude, latitude]` and pass Leaflet coordinates as `[latitude, longitude]`.
- Use exact type colors: Earthquake `#ff4444`, Wildfire `#ff9100`, Volcano `#8b4513`, Storm `#0099ff`, Flood `#66ccff`.
- Use GDACS alert outlines: red for severe, orange for moderate, yellow for minor.
- Default to dark mode; persist the user's selected theme in `localStorage`.
- Set the map height to `85vh`.
- Refresh enabled APIs every 10 minutes and clear old markers before rebuilding them.
- Treat source requests independently so one failure never prevents another source from rendering.
- Display last 7 days, last 30 days, and all events time filters.
- Escape provider text and allow only HTTP(S) detail links in popup HTML.
- Include in-page usage, API descriptions, and rate-limit/CORS warnings at the end of the page.

## File Structure

- Create: `index.html` — the complete runtime application, styles, markup, provider adapters, filtering, map rendering, theme behavior, and in-page documentation.
- Existing: `docs/superpowers/specs/2026-09-12-global-disaster-monitor-design.md` — approved requirements and architecture.
- This plan intentionally adds no runtime files besides `index.html`; verification uses disposable inline commands and browser inspection so the delivered app remains one file.

---

### Task 1: Dashboard Shell, Theme, and Leaflet Canvas

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: no earlier implementation.
- Produces: DOM IDs `map`, `theme-toggle`, `time-range`, `refresh-button`, `loading-indicator`, `source-statuses`, `total-count`, `source-stats`, and `type-stats`; functions `getPreferredTheme(): 'dark'|'light'`, `applyTheme(theme): void`, and `toggleTheme(): void`; global Leaflet objects `map` and `markerCluster`.

- [ ] **Step 1: Run a failing structural contract before creating the page**

Run:

```powershell
$page = 'D:\steve\Documents\GitHub\global-disaster-monitor\index.html'
if (-not (Test-Path -LiteralPath $page)) { throw 'index.html is missing' }
```

Expected: FAIL with `index.html is missing`.

- [ ] **Step 2: Create the semantic page shell and CDN declarations**

Create `index.html` with:

```html
<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>Global Disaster Monitor</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css">
</head>
<body>
  <main>
    <header><!-- title, live status, theme and refresh controls --></header>
    <section aria-label="Monitoring controls"><!-- source, type, time controls --></section>
    <section class="relative" aria-label="Disaster map and summaries">
      <div id="map" aria-label="Interactive global disaster map"></div>
      <aside aria-label="Statistics"><span id="total-count">0</span><div id="source-stats"></div><div id="type-stats"></div></aside>
      <aside aria-label="Map legend"><!-- type and severity keys --></aside>
    </section>
    <footer><!-- usage, APIs, rate limit warning --></footer>
  </main>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script><!-- application --></script>
</body>
</html>
```

Give all interactive controls visible labels, `aria-label` attributes where necessary, keyboard focus rings, and disabled/loading states. Use rounded translucent cards and responsive wrapping. Set `#map { height: 85vh; }` in the custom style block.

- [ ] **Step 3: Add custom theme tokens and the theme toggle module**

Define CSS variables for page/card/text/muted/border/shadow/popup/cluster colors under `:root` and `[data-theme="dark"]`. Then implement:

```js
const THEME_KEY = 'global-disaster-monitor-theme';

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('#theme-toggle').setAttribute('aria-pressed', String(theme === 'light'));
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
```

Wrap `localStorage` access defensively so privacy-mode failures do not stop initialization. Update the button icon and text inside `applyTheme`.

- [ ] **Step 4: Initialize Leaflet and MarkerCluster**

Implement:

```js
const map = L.map('map', { worldCopyJump: true }).setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
const markerCluster = L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false });
map.addLayer(markerCluster);
```

- [ ] **Step 5: Re-run the structural contract and inspect the page**

Run an inline PowerShell assertion that checks `index.html` for Tailwind, Leaflet `1.9.4`, MarkerCluster `1.5.3`, `id="map"`, `85vh`, `localStorage`, and `.setView([0, 0], 2)`. Expected: PASS. Open the page in a browser and verify the default dark shell, controls, 85vh map, top-right statistics card, bottom-right legend, and narrow-screen wrapping.

- [ ] **Step 6: Commit the shell**

```bash
git add index.html
git commit -m "feat: add disaster monitor dashboard shell"
```

---

### Task 2: Normalized Event Model and Three Source Adapters

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: the Task 1 script block and status DOM.
- Produces: `normalizeType(value): string|null`, `normalizeSeverity(value): string`, `parseGeoPoint(coordinates): { latitude: number, longitude: number }|null`, `isWithinTimeRange(timestamp, range): boolean`, `fetchEonetEvents(signal): Promise<EventRecord[]>`, `fetchUsgsEvents(signal): Promise<EventRecord[]>`, `fetchGdacsEvents(signal): Promise<EventRecord[]>`, and `SOURCE_ADAPTERS: Record<string, SourceAdapter>`.
- `EventRecord` fields: `id`, `name`, `type`, `severity`, `timestamp`, `latitude`, `longitude`, `sourceId`, `sourceName`, and `detailUrl`.

- [ ] **Step 1: Run failing behavior probes in the browser console**

Before the helpers exist, evaluate:

```js
console.assert(parseGeoPoint([139.76, 35.68]).latitude === 35.68);
console.assert(parseGeoPoint([139.76, 35.68]).longitude === 139.76);
console.assert(normalizeType('wildfires') === 'Wildfire');
console.assert(normalizeSeverity('RED') === 'Red');
```

Expected: FAIL with `parseGeoPoint is not defined`.

- [ ] **Step 2: Implement shared normalization and validation helpers**

Use these constants and signatures:

```js
const TYPE_COLORS = Object.freeze({
  Earthquake: '#ff4444', Wildfire: '#ff9100', Volcano: '#8b4513',
  Storm: '#0099ff', Flood: '#66ccff'
});

const SEVERITY_COLORS = Object.freeze({
  Red: '#ef4444', Orange: '#f97316', Yellow: '#eab308'
});

function parseGeoPoint(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
```

Make `normalizeType` case-insensitively map earthquake/seismic, wildfire/fire, volcano, storm/cyclone/hurricane/typhoon, and flood terms to the five canonical names. `normalizeSeverity` returns `Red`, `Orange`, `Yellow`, a sanitized provider value, or `Not specified`. `normalizeTimestamp` returns a valid ISO string or `null`. `safeUrl` accepts only HTTP(S). `escapeHtml` escapes `&`, `<`, `>`, `"`, and `'`.

- [ ] **Step 3: Implement the NASA EONET adapter**

Fetch `https://eonet.gsfc.nasa.gov/api/v3/events`, verify `response.ok`, and iterate `payload.events`. Pick the most recent valid point geometry, read categories defensively, ignore unsupported categories, and return `EventRecord[]` with source ID `eonet` and source name `NASA EONET`.

The adapter must select coordinates like this:

```js
const geometry = [...(event.geometry || [])]
  .reverse()
  .find(item => item?.type === 'Point' && parseGeoPoint(item.coordinates));
const point = geometry ? parseGeoPoint(geometry.coordinates) : null;
```

- [ ] **Step 4: Implement the USGS adapter**

Fetch `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`, verify `response.ok`, iterate `payload.features`, call `parseGeoPoint(feature.geometry.coordinates)`, convert epoch milliseconds to ISO, format magnitude as `Magnitude N.N` or `Not specified`, and use source ID `usgs` and source name `USGS Earthquakes`.

- [ ] **Step 5: Implement the GDACS adapter and defensive schema access**

Fetch `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH`, verify `response.ok`, and support both `payload.features` and a top-level event array. Read properties using a case-insensitive helper so known variants such as `eventtype`, `eventname`, `alertlevel`, `fromdate`, `url`, and `htmldescription` do not crash the adapter. Use GeoJSON geometry when present and fall back to numeric latitude/longitude properties. Use source ID `gdacs` and source name `GDACS UN`.

Normalize alert levels to `Red`, `Orange`, or `Yellow`; otherwise return `Not specified`.

- [ ] **Step 6: Register adapters**

```js
const SOURCE_ADAPTERS = Object.freeze({
  eonet: { label: 'NASA EONET', fetchEvents: fetchEonetEvents },
  usgs: { label: 'USGS Earthquakes', fetchEvents: fetchUsgsEvents },
  gdacs: { label: 'GDACS UN', fetchEvents: fetchGdacsEvents }
});
```

- [ ] **Step 7: Re-run helper probes and test adapters with fixture-shaped objects**

In the browser console, verify longitude/latitude conversion, invalid-coordinate rejection, all category aliases, severity mapping, HTML escaping, non-HTTP URL rejection, an EONET Point geometry, a USGS GeoJSON feature, and a GDACS GeoJSON feature. Expected: every `console.assert` remains silent.

- [ ] **Step 8: Commit the adapters**

```bash
git add index.html
git commit -m "feat: normalize disaster data sources"
```

---

### Task 3: Filtering, Markers, Popups, Statistics, and Controls

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `TYPE_COLORS`, `SEVERITY_COLORS`, normalized `EventRecord[]`, `map`, `markerCluster`, and Task 1 DOM IDs.
- Produces: `state`, `getFilteredEvents(): EventRecord[]`, `createMarker(event): L.Marker`, `buildPopupContent(event): string`, `renderMarkers(events): void`, `renderStatistics(events): void`, `renderSourceStatuses(): void`, and `render(): void`.

- [ ] **Step 1: Run failing state and filter probes**

Evaluate before implementation:

```js
console.assert(getFilteredEvents instanceof Function);
console.assert(buildPopupContent instanceof Function);
console.assert(renderStatistics instanceof Function);
```

Expected: FAIL because the functions are not defined.

- [ ] **Step 2: Implement centralized application state**

```js
const state = {
  theme: getPreferredTheme(),
  timeRange: '7d',
  enabledSources: new Set(['eonet', 'usgs', 'gdacs']),
  enabledTypes: new Set(Object.keys(TYPE_COLORS)),
  events: [],
  sourceStatus: new Map(),
  refreshToken: 0,
  activeController: null,
  isLoading: false,
  lastRefresh: null
};
```

- [ ] **Step 3: Implement time, source, and type filtering**

`getFilteredEvents` must include only events whose `sourceId` and `type` are enabled. For `7d` and `30d`, compare valid timestamps against `Date.now() - days * 86_400_000`. For `all`, do not exclude by time. Records with missing timestamps appear only under `all`.

- [ ] **Step 4: Implement safe popup content and marker icons**

`buildPopupContent` renders escaped name, type, severity, localized timestamp, fixed four-decimal coordinates, source, and a safe official link with `target="_blank" rel="noopener noreferrer"`. `createMarker` must call `L.marker([event.latitude, event.longitude], ...)` and use a `divIcon` filled with `TYPE_COLORS[event.type]`. Add a 3px GDACS outline only for `Red`, `Orange`, or `Yellow`; use a neutral contrasting border for other markers.

- [ ] **Step 5: Render markers without duplication**

```js
function renderMarkers(events) {
  markerCluster.clearLayers();
  markerCluster.addLayers(events.map(createMarker));
}
```

Keep map position stable during filters and refreshes; do not auto-fit bounds.

- [ ] **Step 6: Render totals grouped in both dimensions**

`renderStatistics(events)` updates `total-count`, then groups current filtered events by every registered source label and every canonical type. Render zero counts as muted rows so switches and legend remain easy to correlate with statistics.

- [ ] **Step 7: Wire all controls**

Add `change` listeners for `[data-source-toggle]`, `[data-type-toggle]`, and `#time-range`. Source changes call `refreshData()`. Type and time changes call `render()`. Theme changes call `toggleTheme()` and invalidate map size after the transition. The manual refresh button calls `refreshData()`.

- [ ] **Step 8: Verify filtering and rendering interactively**

Inject five representative normalized records into `state.events`, call `render()`, and verify: total counts; counts by source and type; each type switch; each source switch; 7-day/30-day/all behavior; exact fill colors; GDACS severity outlines; popup fields; and no duplicated marker after two renders.

- [ ] **Step 9: Commit the rendering pipeline**

```bash
git add index.html
git commit -m "feat: add disaster filtering and map rendering"
```

---

### Task 4: Resilient Refresh, Loading States, and Documentation

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `state`, `SOURCE_ADAPTERS`, `render()`, and `renderSourceStatuses()`.
- Produces: `refreshData(): Promise<void>`, `setLoading(loading): void`, initialization flow, and a ten-minute refresh timer.

- [ ] **Step 1: Run a failing refresh probe**

Evaluate:

```js
console.assert(refreshData instanceof Function);
console.assert(setLoading instanceof Function);
```

Expected: FAIL because the functions are not defined.

- [ ] **Step 2: Implement loading UI**

`setLoading(true)` reveals an animated spinner and `Updating live feeds…`, disables the manual refresh button, sets `aria-busy="true"` on the monitor region, and marks enabled sources as loading. `setLoading(false)` reverses those properties.

- [ ] **Step 3: Implement independent, stale-safe refreshes**

Use a monotonically increasing token and one abort controller:

```js
async function refreshData() {
  const token = ++state.refreshToken;
  state.activeController?.abort();
  const controller = new AbortController();
  state.activeController = controller;
  setLoading(true);

  const enabled = [...state.enabledSources];
  const settled = await Promise.allSettled(enabled.map(async sourceId => ({
    sourceId,
    events: await SOURCE_ADAPTERS[sourceId].fetchEvents(controller.signal)
  })));

  if (token !== state.refreshToken) return;
  // Build a fresh events array from fulfilled results, update each source status,
  // replace state.events once, render once, and leave disabled sources empty.
}
```

Implement the comment explicitly: fulfilled results append their normalized events and show a loaded count; rejected results append no events and show a concise failure message; `state.events` is assigned the new array once; `state.lastRefresh` is set when at least one source succeeds; `render()` runs once; and `setLoading(false)` executes in `finally` only for the current token.

- [ ] **Step 4: Add initialization and ten-minute scheduling**

On `DOMContentLoaded`, apply the saved/default theme, initialize all control states, call `render()` for the empty shell, then `refreshData()`. Schedule:

```js
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
setInterval(refreshData, REFRESH_INTERVAL_MS);
```

Pause no timers manually; the browser manages inactive tabs. The refresh token prevents out-of-order updates.

- [ ] **Step 5: Add end-of-page usage and provider notes**

The footer must explain how to pan/zoom, click markers, use filters, refresh feeds, and switch themes. Describe NASA EONET, USGS, and GDACS in plain language. Warn that public feeds and OpenStreetMap tiles may enforce rate limits, CORS policies, outages, or schema changes; recommend serving the file over HTTPS or a local static server if direct `file://` requests fail.

- [ ] **Step 6: Verify failure isolation and refresh behavior**

In browser developer tools, temporarily block one provider URL and refresh. Expected: the blocked source reports failure while the other two render. Block all three. Expected: the map and controls remain usable with an empty state and retry hint. Restore access, refresh twice, and verify marker and statistic counts do not double.

- [ ] **Step 7: Run the full static contract**

Run a PowerShell assertion set over `index.html` for all three exact API URLs, five exact colors, three severity colors, all source/type switches, `Promise.allSettled`, `AbortController`, `clearLayers`, `10 * 60 * 1000`, `localStorage`, popup safety helpers, `85vh`, API notes, usage instructions, and rate-limit/CORS warning. Expected: PASS.

- [ ] **Step 8: Perform final browser QA**

Verify at desktop and mobile widths: dark default; light/dark persistence across reload; OpenStreetMap at `[0,0]` zoom `2`; responsive cards; loading animation; all eight switches; three time ranges; clustered markers; themed popups and legend; all popup fields and official links; statistics by source and type; independent failure hints; keyboard focus; and readable contrast.

- [ ] **Step 9: Commit the completed monitor**

```bash
git add index.html
git commit -m "feat: complete resilient disaster monitor"
```

---

## Final Acceptance

- [ ] Open `index.html` through a static server and confirm no uncaught console errors.
- [ ] Confirm only `index.html` is required at runtime.
- [ ] Confirm every completion criterion in the approved specification has an implementation and a verification step above.
- [ ] Check `git status --short` and preserve unrelated user changes.

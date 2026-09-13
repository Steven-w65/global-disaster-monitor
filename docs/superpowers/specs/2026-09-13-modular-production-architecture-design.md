# Modular Production Architecture Design

Date: 2026-09-13

## Purpose

Evolve Global Disaster Monitor from a single standalone HTML file into a small, production-oriented vanilla JavaScript application. Preserve the existing map, source toggles, filters, statistics, accessibility, theme behavior, and independent source failure handling while making data providers, UI components, and tests independently maintainable.

The first new provider after the migration will be NASA FIRMS. The design also prepares for ReliefWeb context and NOAA tropical-cyclone geometry without committing those later integrations to the first implementation wave.

## Goals

- Keep the user interface framework-free: vanilla HTML, CSS, and JavaScript modules.
- Make a new supported provider a self-contained adapter plus registry entry.
- Move provider credentials, CORS-sensitive requests, caching, and response-size controls into an optional serverless proxy.
- Preserve direct browser access for sources that remain safe and reliable without the proxy.
- Support GeoJSON points, lines, and polygons so the map can later show tracks, forecast cones, and affected areas.
- Replace embedded production self-tests with executable unit and browser tests.
- Produce a static frontend that can be deployed to GitHub Pages.
- Keep failure isolation: one unavailable provider must never prevent healthy providers from rendering.

## Non-Goals

- No React, Vue, Angular, or other component framework.
- No database, login system, user accounts, or administration dashboard.
- No interface for end users to paste arbitrary API URLs or provider credentials.
- No OpenStreetMap tile proxy or bulk tile caching.
- No attempt to predict disasters or replace official emergency guidance.
- No full offline mode in the first migration.

## Recommended Technology

- Vite for local development, ES-module bundling, environment configuration, and static production builds.
- Vanilla JavaScript modules for application code.
- Compiled Tailwind CSS or a small authored stylesheet; the Tailwind browser CDN is removed from production.
- Leaflet 1.9.4 and Leaflet.markercluster, pinned through package dependencies.
- Vitest for adapter, state, filtering, and utility tests.
- Playwright for browser interaction, accessibility, responsive layout, and refresh integration checks.
- A Cloudflare Worker as the recommended optional proxy because it supports secret bindings, edge caching, request validation, and a small deployment footprint. Equivalent Vercel or Netlify functions may implement the same HTTP contract.
- GitHub Actions for test/build verification and GitHub Pages deployment of the static `dist/` output.

Vite is a build tool rather than a UI framework. The shipped frontend remains ordinary HTML, CSS, and JavaScript.

## Repository Structure

```text
global-disaster-monitor/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── config.js
│   ├── styles.css
│   ├── state/
│   │   └── store.js
│   ├── sources/
│   │   ├── source-registry.js
│   │   ├── source-contract.js
│   │   ├── eonet.js
│   │   ├── usgs.js
│   │   ├── gdacs.js
│   │   └── firms.js
│   ├── services/
│   │   ├── api-client.js
│   │   ├── refresh-controller.js
│   │   └── event-deduplicator.js
│   ├── map/
│   │   ├── map-view.js
│   │   ├── point-layer.js
│   │   └── geometry-layer.js
│   ├── ui/
│   │   ├── controls.js
│   │   ├── statistics.js
│   │   ├── source-status.js
│   │   ├── event-list.js
│   │   └── popup.js
│   └── utils/
│       ├── validation.js
│       ├── formatting.js
│       └── safe-html.js
├── worker/
│   ├── src/index.js
│   └── wrangler.toml.example
├── tests/
│   ├── fixtures/
│   ├── unit/
│   └── browser/
└── .github/workflows/
    ├── verify.yml
    └── deploy-pages.yml
```

The Worker remains optional. The frontend configuration identifies each source as `direct`, `proxy`, or `auto`. In `auto` mode, browser-safe providers are requested directly and proxy-required providers use the configured proxy base URL.

## Source Adapter Contract

Every source module exports a descriptor with one stable interface:

```js
{
  id,
  label,
  supportedTypes,
  transport,
  buildRequest(context),
  parseResponse(payload, context)
}
```

`context` includes:

- `signal`: abort signal;
- `timeRange`: normalized start and end timestamps;
- `bounds`: optional visible-map bounding box;
- `proxyBaseUrl`: configured proxy origin;
- `now`: injectable current time for deterministic testing.

`buildRequest` returns a URL and request options but does not mutate application state. `parseResponse` validates provider data and returns normalized events. An adapter must not render UI, write status messages, or access Leaflet directly.

The source registry owns provider ordering, default enabled state, labels, and feature flags. Controls and statistics are generated from the registry, so adding a registered source does not require separate hard-coded UI edits.

Arbitrary user-supplied APIs are excluded. Unknown schemas, authentication requirements, and provider-controlled URLs require reviewed adapter code and fixtures.

## Normalized Event Model

```js
{
  id,
  sourceId,
  sourceName,
  name,
  type,
  severity: {
    level,
    label,
    value,
    unit
  },
  timestamp,
  geometry,
  detailUrl,
  metadata
}
```

`geometry` is valid GeoJSON and may be `Point`, `LineString`, `MultiLineString`, `Polygon`, or `MultiPolygon`. GeoJSON coordinates remain in `[longitude, latitude]` order throughout adapters and storage. Conversion to Leaflet's `[latitude, longitude]` convention happens only inside the Leaflet rendering boundary.

Point events continue to use type-colored markers and marker clustering. Line and polygon events use source-aware styles, an accessible layer label, and the same popup data model. Invalid geometry, timestamps, types, or URLs are rejected at the adapter boundary.

The metadata object contains source-specific fields that are safe to display or use for deduplication, such as earthquake magnitude, FIRMS confidence, satellite name, or fire radiative power. It cannot contain credentials or raw untrusted HTML.

## State and Data Flow

The store contains serializable application state:

- theme;
- enabled source IDs;
- enabled disaster types;
- selected time range;
- normalized events by source;
- source request status and data age;
- active request generation;
- last completed refresh;
- selected event.

The refresh controller performs these steps:

1. Derive a request context from current filters and map bounds.
2. Abort the previous refresh generation.
3. Start each enabled source independently.
4. Apply timeout, retry, response-size, and validation policies through the API client.
5. Settle all source requests without failing the whole refresh.
6. Replace only the completed generation's source datasets.
7. Deduplicate overlapping events while retaining source attribution.
8. Derive filtered events and statistics from the store.
9. Render point and geometry layers, source status, statistics, and the event list.

Source toggles initiate a refresh for newly enabled providers. Type and display-only filters use cached normalized records. Time-range changes initiate a provider refresh because EONET and USGS can apply time bounds server-side.

## Existing Provider Migration

### NASA EONET

Use API-supported `days`, `start`, or `end` parameters rather than downloading all open events and relying only on client-side time filtering. Preserve the most recent valid geometry and include all supported GeoJSON geometry types.

### USGS

Keep the real-time GeoJSON feeds for normal live display because they are optimized for automated map use. Use the FDSN event query only when a custom date or magnitude range cannot be served by a published feed. Add a magnitude threshold control only after the modular migration is stable.

### GDACS

Retain defensive schema handling and severity outlines. Prefer the proxy transport in production to absorb CORS failures, cache results, enforce timeouts, and shield the frontend from small response-shape variations.

## First New Provider: NASA FIRMS

FIRMS adds satellite-detected active-fire hotspots rather than only curated wildfire events.

Implementation rules:

- Store the FIRMS MAP_KEY only as a serverless secret.
- Request a bounded day range and, when practical, the visible map extent rather than unlimited global history.
- Normalize acquisition date and time into an ISO timestamp.
- Preserve satellite, instrument, confidence, day/night, brightness, and fire-radiative-power values in metadata.
- Reject invalid or low-quality records according to a configurable confidence threshold.
- Use marker clustering at medium zoom and a canvas or heatmap-style layer at world zoom to avoid creating tens of thousands of interactive DOM markers.
- Aggregate nearby detections only for display; retain raw normalized detections for counts and inspection within configured memory limits.
- Label FIRMS detections as satellite observations, not confirmed wildfire incidents.

FIRMS response limits and cache duration are enforced in the Worker. The frontend never receives or logs the MAP_KEY.

## Later Provider Candidates

### ReliefWeb

ReliefWeb reports and disasters enrich selected incidents with humanitarian context. Reports appear in an event detail panel and are associated by provider identifiers, GLIDE numbers, countries, dates, and carefully bounded text matching. Country centroids are not presented as precise incident locations.

### NOAA National Hurricane Center

NHC forecast tracks, cones, wind radii, and warnings exercise the new line and polygon renderer. A proxy-side converter turns supported GIS/KML products into validated GeoJSON. The UI clearly distinguishes observed tracks from forecasts and shows advisory issuance time.

### OpenFEMA

OpenFEMA declarations are an optional US-focused administrative layer. County or state coverage is represented as an area or labeled regional record rather than a precise incident point.

## Serverless Proxy Contract

The frontend calls:

```text
GET /v1/events/:sourceId?start=<iso>&end=<iso>&bbox=<west,south,east,north>
GET /v1/health
```

The Worker performs only allowlisted upstream requests. It rejects unknown source IDs, unsupported parameters, oversized ranges, malformed coordinates, and non-GET methods.

Successful event responses use:

```json
{
  "sourceId": "firms",
  "fetchedAt": "2026-09-13T00:00:00Z",
  "stale": false,
  "events": []
}
```

Error responses use a stable code and safe message without leaking upstream URLs containing credentials. The Worker adds CORS headers only for configured frontend origins.

Caching policy:

- Cache successful source responses for five to ten minutes.
- Allow stale cached data for a bounded period when an upstream provider is unavailable.
- Return `fetchedAt` and `stale` so the UI can disclose data age.
- Coalesce identical in-flight requests when supported by the platform.
- Respect upstream caching and rate-limit headers.

The proxy must not fetch arbitrary URLs supplied by clients, preventing it from becoming an open proxy or SSRF vector.

## Deduplication

Multiple providers may describe the same earthquake, storm, flood, or wildfire. Deduplication uses conservative, type-specific fingerprints:

- provider-native IDs are always authoritative within one source;
- earthquakes compare time, distance, and magnitude tolerance;
- storms compare normalized names and advisory time;
- other events compare type, time window, geographic overlap, and normalized title tokens.

When records match, the displayed event retains a primary source plus a list of contributing sources and official links. Ambiguous records remain separate. Deduplication never discards source attribution.

## UI Improvements Included in the Migration

- Add a synchronized event list beside or below the map, using a mobile bottom sheet on narrow screens.
- Show source freshness, stale-cache state, retry status, and last successful update.
- Scale earthquake marker emphasis by magnitude while retaining the required type color.
- Add a severity filter after a consistent cross-source severity model is established.
- Persist non-sensitive filters in the URL so a selected view can be shared.
- Render tracks and polygons in the legend only when the corresponding layers are available.
- Keep keyboard-accessible controls, accessible marker names, visible focus states, and theme contrast at or above the existing standard.

The initial migration must preserve the current visual layout before optional UI additions are enabled. This avoids mixing architectural regressions with feature redesign.

## Security

- Keep all provider secrets in Worker environment bindings.
- Maintain an explicit upstream host allowlist.
- Validate content type, response size, coordinates, timestamps, and URL schemes.
- Escape provider-controlled text at the rendering boundary and never inject upstream HTML.
- Apply a production Content Security Policy covering scripts, styles, API origins, tiles, and images.
- Pin dependency versions and use the package lockfile in CI.
- Do not expose stack traces, secret-bearing upstream URLs, or raw provider errors to clients.
- Rate-limit abusive clients at the Worker boundary.

## Testing

The existing 107 embedded behavior checks become normal test files rather than being shipped in the production HTML.

Unit tests cover:

- every adapter with valid, malformed, missing, and adversarial fixtures;
- longitude/latitude preservation and Leaflet conversion boundaries;
- time, source, type, and future severity filters;
- URL and text safety;
- deduplication behavior;
- timeout, retry, cancellation, and stale-generation protection;
- FIRMS confidence, timestamp, and high-volume normalization.

Browser tests cover:

- initial map and control rendering;
- dark/light theme persistence;
- source toggles and independent failures;
- time and type filtering;
- marker, cluster, line, and polygon popups;
- loading and stale-data indicators;
- keyboard navigation and accessible names;
- 320-pixel mobile layout and desktop layout;
- no console errors under mocked healthy and failing providers.

Worker tests cover allowlisting, CORS, cache behavior, secret isolation, parameter limits, upstream failures, and response-size limits.

## Deployment

Pull requests and updates to `main` run formatting, unit tests, browser tests, and a production build. GitHub Pages deploys only the generated `dist/` directory after the verification workflow passes.

Production configuration supplies:

- frontend base path for GitHub Pages;
- proxy base URL;
- allowed frontend origin for the Worker;
- FIRMS MAP_KEY as a Worker secret;
- per-source timeouts, cache durations, and result caps.

The repository includes `.env.example` and `wrangler.toml.example` with placeholders only. Real credentials are never committed.

## Migration Plan

### Phase 1: Modular parity

- Introduce Vite and pinned dependencies.
- Extract CSS and JavaScript modules.
- Preserve existing behavior and appearance.
- Move embedded checks to unit and browser tests.
- Deploy the static build to GitHub Pages.

### Phase 2: Proxy foundation

- Implement the allowlisted Worker contract.
- Route GDACS through the proxy in production.
- Add caching, source freshness, and stale-data display.
- Preserve direct fallback for configured browser-safe sources.

### Phase 3: FIRMS

- Add the FIRMS adapter and Worker upstream.
- Add confidence filtering and high-volume rendering.
- Add source-specific metadata to the popup/detail panel.

### Phase 4: Geometry and context

- Enable line and polygon layers.
- Add NOAA NHC storm products.
- Add the event detail panel and ReliefWeb context.
- Add conservative cross-source deduplication.

Each phase must finish with a deployable, tested application. Later phases do not block shipping earlier ones.

## Compatibility and Rollback

- Preserve the current normalized-event semantics while introducing the richer model through adapter-level conversion.
- Keep the existing `index.html` implementation available in Git history rather than maintaining two live applications.
- Do not remove a direct source transport until its proxy equivalent passes parity and failure tests.
- Each deployment is a static, versioned GitHub Pages artifact; rollback means redeploying the last green commit.

## Completion Criteria

Phase 1 is complete when the modular build matches the current dashboard behavior, all migrated tests pass outside production code, the production bundle contains no embedded self-test harness, and GitHub Pages can deploy `dist/` from CI.

The proxy foundation is complete when configured sources can be fetched through an allowlisted, cached endpoint; secrets are absent from browser assets and logs; stale data is clearly labeled; and one upstream failure remains isolated.

The FIRMS integration is complete when active-fire detections load without exposing the MAP_KEY, high-volume world views remain responsive, confidence and acquisition metadata are correctly normalized, and the UI distinguishes observations from confirmed wildfire events.

# Global Disaster Monitor Design

Date: 2026-09-12

## Purpose

Build a portable, browser-based global disaster monitoring dashboard in one standalone `index.html`. The page combines NASA EONET, USGS Earthquake, and GDACS feeds on an interactive Leaflet map and provides source, disaster-type, and time-range controls without requiring a backend or build step.

## Delivery Constraints

- Use vanilla HTML, CSS, and JavaScript only.
- Keep application code in a single `index.html` file.
- Load Tailwind CSS, Leaflet 1.9.4, Leaflet MarkerCluster, and OpenStreetMap tiles from public CDNs.
- Default to dark mode and persist the theme preference in `localStorage`.
- Run directly in a modern browser. A lightweight local static server is recommended when a provider blocks `file://` requests or applies CORS restrictions.
- Do not embed API secrets. Sources requiring private credentials are outside the scope of this client-only design.

## Visual Design

The page uses a restrained operations-dashboard layout:

- A compact heading and context line introduce the monitor.
- A top control card contains theme, time-range, source, and type controls.
- The map occupies 85vh and remains the dominant visual element.
- Statistics appear in a top-right map overlay; the legend appears in a bottom-right overlay.
- Cards use rounded corners, translucent surfaces, soft shadows, and a subtle lift on hover.
- On narrow screens, controls wrap, overlay cards shrink, and content remains readable without obscuring most of the map.

Dark mode uses `#121212` for the page and `#1e1e1e` for cards. Light mode uses `#f8f9fa` and `#ffffff`. Popup, legend, controls, loading state, and map chrome change together when the theme changes.

## Architecture

Although the deliverable is one file, the script is divided into clearly labeled modules:

1. Configuration and application state
2. Theme toggle module
3. Shared normalization and validation helpers
4. NASA EONET data-source module
5. USGS Earthquake data-source module
6. GDACS data-source module
7. Filtering and statistics
8. Leaflet marker and popup rendering
9. Controls, refresh scheduling, and initialization

The source adapter registry exposes the same interface for every provider. Each adapter fetches its feed and returns normalized event records. A new API can be added later by registering one adapter and, when necessary, a source switch or disaster type.

## Normalized Event Model

Every provider maps its response into this conceptual shape:

```js
{
  id,
  name,
  type,
  severity,
  timestamp,
  latitude,
  longitude,
  sourceId,
  sourceName,
  detailUrl
}
```

Coordinates are normalized exactly once. GeoJSON arrays are read as `[longitude, latitude]`, then passed to Leaflet as `[latitude, longitude]`. Records with non-finite or out-of-range coordinates are rejected.

Supported display types are Earthquake, Wildfire, Volcano, Storm, and Flood. Provider categories outside those five types are ignored because the requested controls and legend do not define them.

## Data Sources

### NASA EONET

Fetch the v3 events endpoint, read each event's category, select the most recent valid point geometry, and map supported categories to the five display types. The event's magnitude or category description may be used as a human-readable severity when available; otherwise severity is shown as `Not specified`.

### USGS Earthquakes

Fetch the all-hour GeoJSON feed. Read point coordinates in GeoJSON order, use magnitude as severity, and link to the USGS event page. Because the feed only covers the past hour, the 7-day, 30-day, and all-time filters do not expand its intrinsic coverage.

### GDACS

Fetch the event-list search endpoint and support both the documented GeoJSON-like event list and defensively handled property variants. Map event types to the five display types. Normalize GDACS alert levels to red, orange, or yellow and use those values as marker-outline highlights.

Each request has its own `try/catch`. A failed source reports an inline status and does not remove successful results from other enabled sources.

## State and Data Flow

Application state stores:

- current theme;
- selected time range;
- enabled sources;
- enabled disaster types;
- normalized event records;
- per-source loading and error status;
- last successful refresh time.

On refresh:

1. Mark enabled sources as loading and disable duplicate refresh actions.
2. Fetch enabled adapters independently using settled promises.
3. Normalize and validate every successful response.
4. Replace the previous in-memory records as one refresh result.
5. Apply time, source, and type filters.
6. Clear and rebuild the marker-cluster group.
7. Recompute total, source-grouped, and type-grouped statistics.
8. Update per-source success or failure hints and the last-refresh timestamp.

Switching a source triggers a fresh fetch so a newly enabled source has current data. Switching a type or time range only filters the records already loaded. An automatic refresh repeats every ten minutes.

## Map Rendering

Initialize Leaflet at `[0, 0]`, zoom level `2`, with OpenStreetMap attribution. All visible point markers live in one MarkerCluster group.

Type colors:

- Earthquake: `#ff4444`
- Wildfire: `#ff9100`
- Volcano: `#8b4513`
- Storm: `#0099ff`
- Flood: `#66ccff`

Markers use lightweight HTML `divIcon` circles so both fill color and optional GDACS severity outline are controllable. Non-GDACS markers use a neutral contrasting border. Cluster appearance follows the active theme.

Popups show the disaster name, type, severity, localized timestamp, coordinates, data source, and an official detail link. All provider text and URLs are escaped or validated before insertion into popup markup.

## Controls and Feedback

- The theme control switches dark/light presentation and saves the preference.
- Three source switches control NASA EONET, USGS, and GDACS independently.
- Five type switches control Earthquake, Wildfire, Volcano, Storm, and Flood.
- The time dropdown supports last 7 days, last 30 days, and all events.
- A manual refresh button complements the ten-minute timer.
- A loading indicator identifies active network work.
- Per-source status rows identify failures without masking healthy sources.
- Statistics show the current filtered total plus counts by source and by disaster type.
- The legend shows all type colors and GDACS alert-outline meanings.

## Error Handling and Resilience

- Handle HTTP failures, invalid JSON, malformed records, and missing coordinates per source.
- Use an empty result for a failed source while retaining results from successful sources in the same refresh.
- Prevent stale refreshes from overwriting newer results with a monotonically increasing request token.
- Ignore unsupported event types and invalid dates safely.
- Keep the existing map usable if every source fails; display a clear retry message.

## Security and Browser Limitations

- Escape provider-controlled strings before building popup HTML.
- Accept detail links only when they use `http:` or `https:`.
- Use `noopener noreferrer` on external links.
- Public API and tile providers can impose rate limits, CORS policies, outages, or schema changes. The page documents these constraints in its in-page usage notes.
- A production deployment should serve the file over HTTPS and may require a proxy for providers that do not allow browser-origin requests.

## Verification

Verification covers:

- Static structure: required CDN versions, map container, control groups, statistics, legend, usage instructions, and module comments.
- Data correctness: GeoJSON longitude/latitude conversion, category normalization, time filtering, and severity mapping.
- Refresh behavior: marker clearing, settled independent requests, stale-request protection, and ten-minute scheduling.
- Safety: popup escaping and URL validation.
- Interactive browser checks: default dark theme, persisted theme toggle, responsive layout, map initialization, filters, loading states, popups, marker clustering, and source-specific failures.

## Extensibility

Future public browser-safe APIs can be added through the adapter registry. An adapter must return normalized event records and declare its label. Sources requiring authentication secrets should be integrated through a backend or serverless proxy, not by embedding credentials in this file.

## Completion Criteria

The work is complete when `index.html` opens as a functional single-page monitor, renders all reachable selected feeds independently, applies every source/type/time filter, updates markers and statistics without duplicates, persists theme preference, and contains end-user instructions plus API and rate-limit notes.

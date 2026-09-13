# Global Disaster Monitor

Global Disaster Monitor is a browser-based Leaflet map for exploring recent
worldwide hazards. The current Phase 1 dashboard aggregates public data from
NASA EONET, the USGS earthquake feed, and GDACS. It supports dark and light
themes, clustered markers, source and hazard filters, time ranges, statistics,
and provider-specific loading status.

## Prerequisites

Use Node.js 22.22.2 or newer in the 22.x line, 24.15.0 or newer in the 24.x line, or 26.0.0 or newer. npm is supplied with Node.js. This matches the supported runtime range of the pinned jsdom release and includes the Node 24 version used in CI.

## Run locally

Install the pinned dependencies once, then start Vite's development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The dashboard calls its providers directly
from the browser, so data availability can differ by network and provider.

## Verify and build

Run the complete production verification path before delivery:

```bash
npx playwright install --with-deps chromium
npm run verify
```

Install Playwright's managed Chromium once before running verification on a
fresh development machine. `npm run verify` runs the unit suite, creates a
production build, and executes the Playwright browser suite against that build.
To create only the static production artifact, run:

```bash
npm run build
```

Vite writes the deployable files to `dist/`. Do not edit or commit that
generated directory.

## GitHub Pages delivery

The `Verify` workflow runs on every push and pull request using `npm ci`, the
Playwright-managed Chromium browser, and `npm run verify`. The `Deploy GitHub
Pages` workflow runs only for pushes to `main` (or a manual dispatch), repeats
that verification, and uploads only `dist/` as the Pages artifact before
deploying it.

To enable the deployment in a repository, open **Settings → Pages** and set
the build and deployment source to **GitHub Actions**. The existing Vite
configuration preserves the repository base path on GitHub Actions
(`/global-disaster-monitor/`) while using `/` for local development; do not
replace it with a root-only Pages path.

## Data and map-service limitations

This Phase 1 app reads NASA EONET, USGS, and GDACS directly from the public
browser APIs. Those services may be temporarily unavailable, slow, rate
limited, or inaccessible from a particular network. Browser CORS policy can
also prevent a provider response from reaching the app. The dashboard keeps
healthy sources visible when another provider fails, but it cannot bypass a
provider's availability, CORS, authentication, or usage restrictions.

The basemap uses OpenStreetMap tiles. Keep the visible OpenStreetMap
attribution, comply with the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/), and do not use this public
tile endpoint for bulk, offline, or high-volume traffic without appropriate
arrangements.

## Current architecture and future proxy setting

Phase 1 is a static, direct-source browser application: there is no server,
serverless function, proxy deployment, API credential, or secret required.
The empty value in [`.env.example`](.env.example) reserves
`VITE_PROXY_BASE_URL` for a later serverless proxy phase. Leave it empty for
the current direct-source mode. A future proxy may centralize provider access
and protect credentials, but it is not implemented or deployed by this
project today.

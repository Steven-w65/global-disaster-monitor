const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(millisecondsAgo) {
  return new Date(Date.now() - millisecondsAgo).toISOString();
}

function usgsFeature(id, magnitude, overrides = {}) {
  return {
    type: 'Feature',
    id,
    properties: {
      mag: magnitude,
      title: `M ${magnitude} - Fixture earthquake ${id}`,
      time: Date.parse(isoDate(DAY_MS)),
      url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
      ...overrides.properties
    },
    geometry: overrides.geometry ?? { type: 'Point', coordinates: [142.4, 38.1, 10] }
  };
}

function eonetEvent({ id, title, category, date, coordinates }) {
  return {
    id,
    title,
    link: `https://eonet.gsfc.nasa.gov/api/v3/events/${id}`,
    categories: [{ id: category.toLowerCase().replaceAll(' ', '-'), title: category }],
    sources: [{ id: 'TEST', url: `https://example.test/eonet/${id}` }],
    geometry: [{ date, type: 'Point', coordinates }]
  };
}

function createPayloads() {
  const eonetPayload = {
    events: [
      eonetEvent({
        id: 'eonet-fire',
        title: 'Fixture wildfire',
        category: 'Wildfires',
        date: isoDate(DAY_MS),
        coordinates: [151.2, -33.8]
      }),
      eonetEvent({
        id: 'eonet-storm',
        title: 'Fixture storm',
        category: 'Severe Storms',
        date: isoDate(2 * DAY_MS),
        coordinates: [-74.5, 18.25]
      }),
      eonetEvent({
        id: 'eonet-old-fire',
        title: 'Old fixture wildfire',
        category: 'Wildfires',
        date: isoDate(40 * DAY_MS),
        coordinates: [118.4, 45.2]
      })
    ]
  };
  const gdacsPayload = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'gdacs-flood',
      properties: {
        eventid: 'gdacs-flood',
        eventname: 'Fixture flood',
        eventtype: 'FL',
        alertlevel: 'Orange',
        fromdate: isoDate(DAY_MS),
        url: { report: 'https://www.gdacs.org/report.aspx?eventid=gdacs-flood' }
      },
      geometry: { type: 'Point', coordinates: [90.3, 23.7] }
    }]
  };
  return {
    eonetPayload,
    gdacsPayload,
    usgsFeatures: [usgsFeature('usgs-recent', 4.9)]
  };
}

function failedRoute(route) {
  return route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Fixture provider unavailable' })
  });
}

export async function installFeedRoutes(page, scenario) {
  const supportedScenarios = new Set([
    'healthy',
    'partial-failure',
    'all-failure',
    'slow-eonet',
    'malicious-text'
  ]);
  if (!supportedScenarios.has(scenario)) throw new RangeError(`Unknown feed scenario: ${scenario}`);

  const payloads = createPayloads();
  let nextUsgsFeatures = payloads.usgsFeatures;
  let releaseHeldEonet;
  const heldEonet = new Promise(resolve => { releaseHeldEonet = resolve; });

  if (scenario === 'malicious-text') {
    nextUsgsFeatures = [usgsFeature('usgs-malicious', 4.9, {
      properties: { title: '<b>Malicious</b> earthquake' }
    })];
  }

  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XRNvAAAAAElFTkSuQmCC', 'base64')
  }));

  await page.route('**/api/v3/events**', async route => {
    if (scenario === 'all-failure') return failedRoute(route);
    if (scenario === 'slow-eonet') {
      const payload = await heldEonet;
      return route.fulfill({ json: payload });
    }
    return route.fulfill({ json: payloads.eonetPayload });
  });
  await page.route('**/all_hour.geojson', route => {
    if (scenario === 'all-failure') return failedRoute(route);
    return route.fulfill({
      json: { type: 'FeatureCollection', features: nextUsgsFeatures }
    });
  });
  await page.route('**/events/geteventlist/SEARCH**', route => {
    if (scenario === 'partial-failure' || scenario === 'all-failure') return failedRoute(route);
    return route.fulfill({ json: payloads.gdacsPayload });
  });

  return Object.freeze({
    eonetPayload: payloads.eonetPayload,
    gdacsPayload: payloads.gdacsPayload,
    releaseEonet(payload) {
      releaseHeldEonet(payload);
    },
    replaceUsgs(features) {
      nextUsgsFeatures = features;
    },
    usgsFeature
  });
}

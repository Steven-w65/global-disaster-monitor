const feature = (id, mag, overrides = {}) => ({
  type: 'Feature',
  id,
  properties: {
    mag,
    place: `Test ${id}`,
    time: Date.parse('2026-09-12T11:00:00Z'),
    url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    ...overrides.properties
  },
  geometry: overrides.geometry ?? { type: 'Point', coordinates: [142.4, 38.1, 10] }
});

export const usgsPayload = {
  type: 'FeatureCollection',
  features: [
    feature('usgs-valid', '4.9'),
    feature('usgs-zero', 0),
    feature('usgs-zero-string', '0'),
    feature('usgs-finite-string', ' 2.5 '),
    feature('usgs-null', null),
    feature('usgs-undefined', undefined),
    feature('usgs-empty', ''),
    feature('usgs-blank', ' '),
    feature('usgs-false', false),
    feature('usgs-true', true),
    feature('usgs-nan', Number.NaN),
    feature('usgs-infinity', Number.POSITIVE_INFINITY),
    feature('usgs-unsafe-url', 3, { properties: { url: 'javascript:alert(1)' } }),
    feature('usgs-bad-point', 3, { geometry: { type: 'Point', coordinates: [181, 0] } }),
    feature('usgs-missing-date', 3, { properties: { time: null } })
  ]
};

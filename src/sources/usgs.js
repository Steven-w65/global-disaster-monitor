import { parseGeoPoint, validateEvent } from './source-contract.js';

const USGS_HOUR_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

function formatMagnitude(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return 'Not specified';
  if (typeof value === 'string' && !value.trim()) return 'Not specified';
  const magnitude = Number(value);
  return Number.isFinite(magnitude) ? `Magnitude ${magnitude.toFixed(1)}` : 'Not specified';
}

function normalizeUsgsFeature(feature) {
  const point = parseGeoPoint(feature?.geometry?.coordinates);
  if (!point) return null;
  const properties = feature?.properties || {};

  return validateEvent({
    id: String(feature?.id || properties.code || `${point.latitude},${point.longitude}`),
    sourceId: 'usgs',
    sourceName: 'USGS Earthquakes',
    name: String(properties.title || 'Unnamed earthquake'),
    type: 'Earthquake',
    severity: formatMagnitude(properties.mag),
    timestamp: properties.time,
    geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
    detailUrl: properties.url
  });
}

export default Object.freeze({
  id: 'usgs',
  label: 'USGS Earthquakes',
  defaultEnabled: true,
  supportedTypes: Object.freeze(['Earthquake']),
  transport: 'direct',
  buildRequest() {
    return {
      url: USGS_HOUR_FEED,
      options: { headers: { Accept: 'application/geo+json, application/json' } }
    };
  },
  parseResponse(payload) {
    return (Array.isArray(payload?.features) ? payload.features : [])
      .map(normalizeUsgsFeature)
      .filter(Boolean);
  }
});

import { normalizeType, parseGeoPoint, safeUrl, validateEvent } from './source-contract.js';

const EONET_EVENTS_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const SUPPORTED_TYPES = Object.freeze(['Earthquake', 'Wildfire', 'Volcano', 'Storm', 'Flood']);

function normalizeEonetEvent(event) {
  const geometries = Array.isArray(event?.geometry) ? event.geometry : [];
  const geometry = [...geometries]
    .reverse()
    .find(item => item?.type === 'Point' && parseGeoPoint(item.coordinates));
  const point = geometry ? parseGeoPoint(geometry.coordinates) : null;
  const type = (Array.isArray(event?.categories) ? event.categories : [])
    .map(item => normalizeType(item?.title || item?.id))
    .find(Boolean);
  if (!point || !type) return null;

  return validateEvent({
    id: String(event?.id || event?.title || `${point.latitude},${point.longitude}`),
    sourceId: 'eonet',
    sourceName: 'NASA EONET',
    name: String(event?.title || event?.id || 'Unnamed event'),
    type,
    severity: 'Not specified',
    timestamp: geometry.date || event?.closed || event?.updated,
    geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
    detailUrl: safeUrl(event?.link || event?.sources?.[0]?.url)
  });
}

export default Object.freeze({
  id: 'eonet',
  label: 'NASA EONET',
  defaultEnabled: true,
  supportedTypes: SUPPORTED_TYPES,
  transport: 'direct',
  buildRequest() {
    return { url: EONET_EVENTS_URL, options: { headers: { Accept: 'application/json' } } };
  },
  parseResponse(payload) {
    return (Array.isArray(payload?.events) ? payload.events : [])
      .map(normalizeEonetEvent)
      .filter(Boolean);
  }
});

import {
  getCaseInsensitive,
  normalizeSeverity,
  normalizeType,
  parseGeoPoint,
  safeUrl,
  validateEvent
} from './source-contract.js';

const GDACS_EVENTS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH';
const GDACS_SEVERITIES = new Set(['Red', 'Orange', 'Yellow']);
const SUPPORTED_TYPES = Object.freeze(['Earthquake', 'Wildfire', 'Volcano', 'Storm', 'Flood']);

function normalizeGdacsSeverity(value) {
  const severity = normalizeSeverity(value);
  return GDACS_SEVERITIES.has(severity) ? severity : 'Not specified';
}

function gdacsDetailUrl(value) {
  const report = getCaseInsensitive(value, 'report');
  const candidate = typeof value === 'string'
    ? value
    : (typeof report === 'string' && report.trim() ? report : getCaseInsensitive(value, 'details'));
  return safeUrl(candidate);
}

function normalizeGdacsEvent(event) {
  const properties = event?.properties && typeof event.properties === 'object' ? event.properties : event;
  const geometry = event?.geometry || getCaseInsensitive(properties, 'geometry');
  let point = parseGeoPoint(geometry?.coordinates);
  if (!point) {
    point = parseGeoPoint([
      getCaseInsensitive(properties, 'longitude', 'lon', 'lng', 'geolon'),
      getCaseInsensitive(properties, 'latitude', 'lat', 'geolat')
    ]);
  }
  const type = normalizeType(getCaseInsensitive(properties, 'eventtype', 'type', 'event_type'));
  if (!point || !type) return null;

  const eventId = getCaseInsensitive(properties, 'eventid', 'event_id', 'id') || event?.id;
  return validateEvent({
    id: String(eventId || `${point.latitude},${point.longitude}`),
    sourceId: 'gdacs',
    sourceName: 'GDACS UN',
    name: String(getCaseInsensitive(properties, 'eventname', 'name', 'title') || 'Unnamed event'),
    type,
    severity: normalizeGdacsSeverity(getCaseInsensitive(properties, 'alertlevel', 'alert_level', 'severity')),
    timestamp: getCaseInsensitive(properties, 'fromdate', 'from_date', 'date', 'eventdate'),
    geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
    detailUrl: gdacsDetailUrl(getCaseInsensitive(properties, 'url', 'eventurl', 'link'))
  });
}

export default Object.freeze({
  id: 'gdacs',
  label: 'GDACS UN',
  defaultEnabled: true,
  supportedTypes: SUPPORTED_TYPES,
  transport: 'direct',
  buildRequest() {
    return { url: GDACS_EVENTS_URL, options: { headers: { Accept: 'application/json' } } };
  },
  parseResponse(payload) {
    const events = Array.isArray(payload?.features) ? payload.features : (Array.isArray(payload) ? payload : []);
    return events.map(normalizeGdacsEvent).filter(Boolean);
  }
});

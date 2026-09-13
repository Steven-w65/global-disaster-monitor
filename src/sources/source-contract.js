export function parseGeoPoint(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const [rawLongitude, rawLatitude] = coordinates;
  const containsOnlyNumbers = [rawLongitude, rawLatitude].every(value =>
    (typeof value === 'number' || typeof value === 'string') &&
    (typeof value !== 'string' || value.trim() !== '')
  );
  if (!containsOnlyNumbers) return null;

  const longitude = Number(rawLongitude);
  const latitude = Number(rawLatitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return { longitude, latitude };
}

export function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function normalizeType(value) {
  if (typeof value !== 'string') return null;
  const type = value.trim().toLowerCase();
  if (!type) return null;
  if (/earthquake|seismic/.test(type) || type === 'eq') return 'Earthquake';
  if (/wildfire|wild fire|\bfire\b/.test(type) || type === 'wf') return 'Wildfire';
  if (/volcan/.test(type) || type === 'vo') return 'Volcano';
  if (/storm|cyclone|hurricane|typhoon/.test(type) || type === 'tc') return 'Storm';
  if (/flood/.test(type) || type === 'fl') return 'Flood';
  return null;
}

export function normalizeSeverity(value) {
  if (value === null || value === undefined) return 'Not specified';
  const providerValue = String(value).trim().replace(/\s+/g, ' ');
  if (!providerValue) return 'Not specified';

  const canonicalSeverity = {
    red: 'Red',
    orange: 'Orange',
    yellow: 'Yellow'
  }[providerValue.toLowerCase()];
  return canonicalSeverity ?? providerValue;
}

export function getCaseInsensitive(object, ...keys) {
  if (!object || typeof object !== 'object') return undefined;
  const wantedKeys = new Set(keys.map(key => key.toLowerCase()));
  const actualKey = Object.keys(object).find(key => wantedKeys.has(key.toLowerCase()));
  return actualKey === undefined ? undefined : object[actualKey];
}

export function validateEvent(event) {
  const point = event?.geometry?.type === 'Point' ? parseGeoPoint(event.geometry.coordinates) : null;
  const timestamp = normalizeTimestamp(event?.timestamp);
  const type = normalizeType(event?.type);
  if (!event?.id || !event?.sourceId || !event?.name || !point || !timestamp || !type) return null;

  return Object.freeze({
    ...event,
    type,
    timestamp,
    geometry: Object.freeze({
      type: 'Point',
      coordinates: Object.freeze([point.longitude, point.latitude])
    }),
    detailUrl: safeUrl(event.detailUrl)
  });
}

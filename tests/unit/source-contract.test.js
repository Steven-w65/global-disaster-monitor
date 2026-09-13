import { describe, expect, it } from 'vitest';
import {
  getCaseInsensitive,
  normalizeSeverity,
  normalizeTimestamp,
  normalizeType,
  parseGeoPoint,
  safeUrl,
  validateEvent
} from '../../src/sources/source-contract.js';

describe('source contract', () => {
  it('preserves GeoJSON order and rejects invalid coordinates', () => {
    expect(parseGeoPoint([151.2, -33.8])).toEqual({ longitude: 151.2, latitude: -33.8 });
    expect(parseGeoPoint([-181, 0])).toBeNull();
    expect(parseGeoPoint([0, 91])).toBeNull();
    expect(parseGeoPoint(['', 0])).toBeNull();
    expect(parseGeoPoint(['151.2', '-33.8'])).toEqual({ longitude: 151.2, latitude: -33.8 });
    expect(parseGeoPoint([null, null])).toBeNull();
  });

  it('normalizes dates and accepts only web detail links', () => {
    expect(normalizeTimestamp('2026-09-13T00:00:00Z')).toBe('2026-09-13T00:00:00.000Z');
    expect(normalizeTimestamp('not-a-date')).toBeNull();
    expect(safeUrl('https://example.gov/event/1')).toBe('https://example.gov/event/1');
    expect(safeUrl('javascript:alert(1)')).toBe('');
  });

  it('normalizes provider type and severity aliases', () => {
    expect(normalizeType('seismic activity')).toBe('Earthquake');
    expect(normalizeType('wildfires')).toBe('Wildfire');
    expect(normalizeType('volcanic eruption')).toBe('Volcano');
    expect(normalizeType('typhoon')).toBe('Storm');
    expect(normalizeType('flooding')).toBe('Flood');
    expect(normalizeType('drought')).toBeNull();
    expect(normalizeSeverity('  ORANGE  ')).toBe('Orange');
    expect(normalizeSeverity('Provider <status>')).toBe('Provider <status>');
    expect(normalizeSeverity(' ')).toBe('Not specified');
  });

  it('reads provider properties without depending on key casing', () => {
    expect(getCaseInsensitive({ EVENTTYPE: 'FL' }, 'eventtype', 'type')).toBe('FL');
    expect(getCaseInsensitive(null, 'eventtype')).toBeUndefined();
  });

  it('validates one normalized point event', () => {
    expect(validateEvent({
      id: 'usgs:abc', sourceId: 'usgs', sourceName: 'USGS Earthquakes',
      name: 'M 4.2 test', type: 'Earthquake', severity: 'Magnitude 4.2',
      timestamp: '2026-09-13T00:00:00Z',
      geometry: { type: 'Point', coordinates: [2, 1] },
      detailUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/abc'
    })).toMatchObject({ id: 'usgs:abc', geometry: { type: 'Point', coordinates: [2, 1] } });
  });

  it('rejects normalized events missing required point, date, or canonical type data', () => {
    const event = {
      id: 'example:1', sourceId: 'example', sourceName: 'Example', name: 'Example',
      type: 'Flood', severity: 'Yellow', timestamp: '2026-09-13T00:00:00Z',
      geometry: { type: 'Point', coordinates: [2, 1] }, detailUrl: ''
    };
    expect(validateEvent({ ...event, timestamp: null })).toBeNull();
    expect(validateEvent({ ...event, type: 'Drought' })).toBeNull();
    expect(validateEvent({ ...event, geometry: { type: 'Polygon', coordinates: [] } })).toBeNull();
  });
});

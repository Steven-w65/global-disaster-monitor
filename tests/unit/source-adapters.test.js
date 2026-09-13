import { describe, expect, it } from 'vitest';
import eonet from '../../src/sources/eonet.js';
import usgs from '../../src/sources/usgs.js';
import gdacs from '../../src/sources/gdacs.js';
import { SOURCE_REGISTRY, getSource, listSources } from '../../src/sources/source-registry.js';
import { eonetPayload } from '../fixtures/eonet.js';
import { usgsPayload } from '../fixtures/usgs.js';
import { gdacsPayload } from '../fixtures/gdacs.js';

describe.each([
  ['eonet', eonet, eonetPayload],
  ['usgs', usgs, usgsPayload],
  ['gdacs', gdacs, gdacsPayload]
])('%s adapter', (id, adapter, payload) => {
  it('implements the source contract and returns validated events', () => {
    expect(adapter.id).toBe(id);
    expect(adapter.defaultEnabled).toBe(true);
    expect(adapter.buildRequest({ timeRange: { start: null, end: null } }).url).toMatch(/^https:/);
    const events = adapter.parseResponse(payload, { now: new Date('2026-09-13T00:00:00Z') });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(event => event.sourceId === id)).toBe(true);
    expect(events.every(event => event.geometry?.type === 'Point' && event.geometry.coordinates.every(Number.isFinite))).toBe(true);
  });

  it('returns an empty collection for a malformed payload', () => {
    expect(adapter.parseResponse(null, {})).toEqual([]);
  });
});

describe('EONET adapter parity', () => {
  it('selects the newest valid Point, preserves raw names, and isolates malformed events', () => {
    const events = eonet.parseResponse(eonetPayload, {});
    expect(events.map(event => event.id)).toEqual(['EONET_1', 'EONET_UNSAFE']);
    expect(events[0]).toMatchObject({
      name: '<b>Recent fire</b>', type: 'Wildfire', severity: 'Not specified',
      timestamp: '2026-09-12T10:00:00.000Z', geometry: { coordinates: [151.2, -33.8] },
      detailUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1'
    });
    expect(events[1]).toMatchObject({ type: 'Volcano', detailUrl: '' });
  });
});

describe('USGS adapter parity', () => {
  it('preserves zero and finite numeric strings while treating invalid magnitudes as missing', () => {
    const events = usgs.parseResponse(usgsPayload, {});
    expect(Object.fromEntries(events.map(event => [event.id, event.severity]))).toEqual({
      'usgs-valid': 'Magnitude 4.9',
      'usgs-zero': 'Magnitude 0.0',
      'usgs-zero-string': 'Magnitude 0.0',
      'usgs-finite-string': 'Magnitude 2.5',
      'usgs-null': 'Not specified',
      'usgs-blank': 'Not specified',
      'usgs-false': 'Not specified',
      'usgs-nan': 'Not specified',
      'usgs-infinity': 'Not specified',
      'usgs-unsafe-url': 'Magnitude 3.0'
    });
    expect(events.find(event => event.id === 'usgs-unsafe-url')?.detailUrl).toBe('');
  });
});

describe('GDACS adapter parity', () => {
  it('supports case-insensitive fields, coordinate fallbacks, and nested detail URLs', () => {
    const events = gdacs.parseResponse(gdacsPayload, {});
    expect(events.map(event => event.id)).toEqual([
      'GDACS_1', 'GDACS_UNSAFE', 'nested-details', 'unsafe-report', 'blank-report', 'GDACS_FALLBACK'
    ]);
    expect(Object.fromEntries(events.map(event => [event.id, event.detailUrl]))).toEqual({
      GDACS_1: 'https://www.gdacs.org/report.aspx?eventid=GDACS_1',
      GDACS_UNSAFE: '',
      'nested-details': 'https://example.test/details-only',
      'unsafe-report': '',
      'blank-report': 'https://example.test/details-after-blank',
      GDACS_FALLBACK: 'https://example.test/direct'
    });
    expect(events.find(event => event.id === 'nested-details')).toMatchObject({ type: 'Storm', severity: 'Red' });
    expect(events.find(event => event.id === 'blank-report')).toMatchObject({ type: 'Earthquake', severity: 'Not specified' });
    expect(events.find(event => event.id === 'GDACS_FALLBACK')).toMatchObject({
      type: 'Wildfire', geometry: { coordinates: [12.5, -4.5] }
    });
  });
});

describe('source registry', () => {
  it('exposes an immutable ordered registry and returns defensive list copies', () => {
    expect(SOURCE_REGISTRY.map(source => source.id)).toEqual(['eonet', 'usgs', 'gdacs']);
    expect(Object.isFrozen(SOURCE_REGISTRY)).toBe(true);
    expect(getSource('usgs')).toBe(usgs);
    expect(getSource('missing')).toBeNull();
    expect(listSources()).toEqual(SOURCE_REGISTRY);
    expect(listSources()).not.toBe(SOURCE_REGISTRY);
  });
});

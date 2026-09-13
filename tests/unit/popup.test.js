import { describe, expect, it } from 'vitest';
import { buildPopupContent, markerAccessibleName } from '../../src/ui/popup.js';

const event = overrides => ({
  id: 'usgs:test',
  sourceId: 'usgs',
  sourceName: 'USGS Earthquakes',
  name: 'Test event',
  type: 'Earthquake',
  severity: 'Magnitude 4.2',
  timestamp: '2026-09-13T00:00:00.000Z',
  geometry: { type: 'Point', coordinates: [20, 10] },
  detailUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/test',
  ...overrides
});

describe('popup content', () => {
  it('escapes provider text and secures an allowed official link', () => {
    const html = buildPopupContent(event({ name: '<img src=x onerror=alert(1)>', detailUrl: 'https://example.gov/event' }));
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('omits unsafe links and creates an accessible marker name', () => {
    const unsafe = event({ detailUrl: 'javascript:alert(1)' });
    expect(buildPopupContent(unsafe)).not.toContain('javascript:');
    expect(markerAccessibleName(unsafe)).toBe('Earthquake: Test event (USGS Earthquakes)');
  });
});

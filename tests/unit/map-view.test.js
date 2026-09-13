import { describe, expect, it, vi } from 'vitest';
import { SEVERITY_COLORS, TYPE_COLORS } from '../../src/config.js';
import { createMapView } from '../../src/map/map-view.js';

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

function setup() {
  const cluster = { addLayer: vi.fn(), clearLayers: vi.fn(), addTo: vi.fn().mockReturnThis() };
  const map = { setView: vi.fn().mockReturnThis(), invalidateSize: vi.fn(), remove: vi.fn() };
  const tileLayer = { addTo: vi.fn().mockReturnThis() };
  const markerElements = [];
  const markers = [];
  const leaflet = {
    map: vi.fn(() => map),
    tileLayer: vi.fn(() => tileLayer),
    markerClusterGroup: vi.fn(() => cluster),
    divIcon: vi.fn(options => options),
    marker: vi.fn(() => {
      const markerElement = document.createElement('button');
      const marker = {
        bindPopup: vi.fn().mockReturnThis(),
        getElement: vi.fn(() => markerElement),
        on: vi.fn((name, listener) => { if (name === 'add') listener(); return marker; })
      };
      markerElements.push(markerElement);
      markers.push(marker);
      return marker;
    })
  };
  return { cluster, leaflet, map, markerElements, markers, tileLayer };
}

describe('map view', () => {
  it('initializes OpenStreetMap and replaces clustered markers without mutating GeoJSON coordinates', () => {
    const { cluster, leaflet, map, markerElements, markers, tileLayer } = setup();
    const element = document.createElement('div');
    const point = event({ geometry: { type: 'Point', coordinates: [151.2, -33.8] } });
    const view = createMapView({ element, leaflet, colors: TYPE_COLORS });
    view.render([point]);

    expect(leaflet.map).toHaveBeenCalledWith(element, { worldCopyJump: true });
    expect(map.setView).toHaveBeenCalledWith([0, 0], 2);
    expect(leaflet.tileLayer).toHaveBeenCalledWith('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    expect(tileLayer.addTo).toHaveBeenCalledWith(map);
    expect(leaflet.markerClusterGroup).toHaveBeenCalledWith({
      chunkedLoading: true,
      showCoverageOnHover: false
    });
    expect(cluster.addTo).toHaveBeenCalledWith(map);
    expect(cluster.clearLayers).toHaveBeenCalledTimes(1);
    expect(point.geometry.coordinates).toEqual([151.2, -33.8]);
    expect(leaflet.marker).toHaveBeenCalledWith([-33.8, 151.2], expect.objectContaining({
      title: 'Earthquake: Test event (USGS Earthquakes)',
      alt: 'Earthquake: Test event (USGS Earthquakes)',
      riseOnHover: true
    }));
    expect(markerElements[0].getAttribute('aria-label')).toBe('Earthquake: Test event (USGS Earthquakes)');
    expect(markers[0].bindPopup).toHaveBeenCalledWith(expect.stringContaining('Test event'));
    expect(cluster.addLayer).toHaveBeenCalledWith(markers[0]);

    view.render([]);
    expect(cluster.clearLayers).toHaveBeenCalledTimes(2);
    expect(cluster.addLayer).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Red', SEVERITY_COLORS.red],
    ['Orange', SEVERITY_COLORS.orange],
    ['Yellow', SEVERITY_COLORS.yellow]
  ])('uses the GDACS %s severity only for the marker outline', (severity, outline) => {
    const { leaflet } = setup();
    const view = createMapView({ element: document.createElement('div'), leaflet, colors: TYPE_COLORS });
    view.render([event({ sourceId: 'gdacs', sourceName: 'GDACS UN', type: 'Flood', severity })]);

    const icon = leaflet.divIcon.mock.calls[0][0];
    expect(icon.html).toContain(`background:${TYPE_COLORS.Flood}`);
    expect(icon.html).toContain(`border:3px solid ${outline}`);
  });

  it('clears the visible layer and removes the map when destroyed', () => {
    const { cluster, leaflet, map } = setup();
    const view = createMapView({ element: document.createElement('div'), leaflet, colors: TYPE_COLORS });
    view.render([event({})]);
    view.setTheme('light');
    view.destroy();

    expect(map.invalidateSize).toHaveBeenCalledTimes(1);
    expect(cluster.clearLayers).toHaveBeenCalledTimes(2);
    expect(map.remove).toHaveBeenCalledTimes(1);
  });
});

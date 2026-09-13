import { afterEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import 'leaflet.markercluster';
import { TYPE_COLORS } from '../../src/config.js';
import { createMapView } from '../../src/map/map-view.js';

const event = (name, index) => ({
  id: `usgs:${name}-${index}`,
  sourceId: 'usgs',
  sourceName: 'USGS Earthquakes',
  name: `${name}-${index}`,
  type: 'Earthquake',
  severity: 'Magnitude 4.2',
  timestamp: '2026-09-13T00:00:00.000Z',
  geometry: { type: 'Point', coordinates: [20 + (index % 10), 10 + (index % 10)] },
  detailUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/test'
});

function createEvents(name, count) {
  return Array.from({ length: count }, (_, index) => event(name, index));
}

function createRealLeaflet() {
  const maps = [];
  const groups = [];
  let markerIndex = 0;
  return {
    groups,
    leaflet: {
      ...L,
      map: (...args) => {
        const map = L.map(...args);
        maps.push(map);
        return map;
      },
      markerClusterGroup: options => {
        const group = L.markerClusterGroup(options);
        groups.push(group);
        return group;
      },
      marker: (...args) => {
        const marker = L.marker(...args);
        if (markerIndex++ === 199) {
          const getLatLng = marker.getLatLng.bind(marker);
          let delayed = false;
          marker.getLatLng = (...latLngArgs) => {
            if (!delayed) {
              delayed = true;
              // Cross MarkerCluster's default 200 ms budget before it checks offset 200.
              const deadline = performance.now() + 210;
              while (performance.now() < deadline) {}
            }
            return getLatLng(...latLngArgs);
          };
        }
        return marker;
      }
    },
    maps
  };
}

function createMapElement() {
  const element = document.createElement('div');
  Object.defineProperties(element, {
    clientHeight: { value: 600 },
    clientWidth: { value: 800 }
  });
  document.body.append(element);
  return element;
}

function captureTimers() {
  const callbacks = [];
  let handle = 0;
  const schedule = callback => {
    callbacks.push(callback);
    handle += 1;
    return handle;
  };
  const timers = [
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(schedule),
    vi.spyOn(window, 'setTimeout').mockImplementation(schedule)
  ];
  vi.spyOn(globalThis, 'clearTimeout');
  vi.spyOn(window, 'clearTimeout');
  return { callbacks, timers };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('map view with Leaflet 1.9.4 and Leaflet.markercluster 1.5.3', () => {
  it('does not let an interrupted real cluster continuation repopulate an old group', () => {
    const { groups, leaflet } = createRealLeaflet();
    const { callbacks, timers } = captureTimers();
    const view = createMapView({ element: createMapElement(), leaflet, colors: TYPE_COLORS });

    view.render(createEvents('old', 401));
    expect(groups[0].getLayers()).toHaveLength(200);
    view.render(createEvents('new', 1));

    expect(timers.some(timer => timer.mock.calls.length > 0)).toBe(true);
    expect(() => callbacks.forEach(callback => callback())).not.toThrow();
    expect(groups[0].getLayers()).toHaveLength(0);
    expect(groups[1].getLayers().map(marker => marker.options.title)).toEqual([
      'Earthquake: new-0 (USGS Earthquakes)'
    ]);

    view.destroy();
  });

  it('does not let a real cluster continuation resume after destruction', () => {
    const { groups, leaflet, maps } = createRealLeaflet();
    const { callbacks, timers } = captureTimers();
    const view = createMapView({ element: createMapElement(), leaflet, colors: TYPE_COLORS });
    const map = maps[0];
    const removeLayer = vi.spyOn(map, 'removeLayer');
    const remove = vi.spyOn(map, 'remove');

    view.render(createEvents('old', 401));
    expect(groups[0].getLayers()).toHaveLength(200);
    view.destroy();

    expect(timers.some(timer => timer.mock.calls.length > 0)).toBe(true);
    expect(() => callbacks.forEach(callback => callback())).not.toThrow();
    expect(groups[0].getLayers()).toHaveLength(0);
    expect(removeLayer).toHaveBeenCalledWith(groups[0]);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

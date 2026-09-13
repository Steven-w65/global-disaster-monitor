import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY, TYPE_COLORS } from '../../src/config.js';
import { listSources } from '../../src/sources/source-registry.js';
import { createStore } from '../../src/state/store.js';
import { bindControls, renderControlState } from '../../src/ui/controls.js';
import { createAppRenderer } from '../../src/ui/render-app.js';
import { renderSourceStatus } from '../../src/ui/source-status.js';
import { renderStatistics } from '../../src/ui/statistics.js';

const sources = listSources();

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = 'dark';
  document.body.innerHTML = `
    <main id="monitor-region" aria-busy="false">
      <span id="visible-total"></span><div id="source-stats"></div><div id="type-stats"></div>
      <div id="source-statuses"></div><span id="last-refresh"></span>
      <div id="source-controls"></div><div id="type-controls"></div>
      <select id="time-range"><option value="7d">7d</option><option value="30d">30d</option><option value="all">all</option></select>
      <button id="theme-toggle"><span id="theme-icon"></span><span id="theme-label"></span></button>
      <span id="loading-indicator" hidden></span><button id="refresh-button"></button>
    </main>`;
});

describe('dashboard renderers', () => {
  it('renders exact source and type statistics from registries', () => {
    renderStatistics(document, {
      total: 3,
      bySource: { eonet: 1, usgs: 1, gdacs: 1 },
      byType: { Earthquake: 1, Wildfire: 1, Volcano: 0, Storm: 0, Flood: 1 }
    }, sources);

    expect(document.querySelector('#visible-total').textContent).toBe('3');
    expect([...document.querySelector('#source-stats').children].map(row => row.textContent)).toEqual([
      'NASA EONET1', 'USGS Earthquakes1', 'GDACS UN1'
    ]);
    expect([...document.querySelector('#type-stats').children].map(row => row.textContent)).toEqual([
      'Earthquake1', 'Wildfire1', 'Volcano0', 'Storm0', 'Flood1'
    ]);
  });

  it('renders success, loading, and error source states with refresh time', () => {
    renderSourceStatus(document, {
      sourceStatus: {
        eonet: { kind: 'success', count: 1 },
        usgs: { kind: 'loading' },
        gdacs: { kind: 'error', message: 'Unable to load' }
      },
      lastRefresh: '2026-09-13T00:00:00.000Z'
    }, sources);

    const text = document.querySelector('#source-statuses').textContent;
    expect(text).toContain('NASA EONET');
    expect(text).toContain('1 loaded');
    expect(text).toContain('USGS Earthquakes');
    expect(text).toContain('Loading…');
    expect(text).toContain('GDACS UN');
    expect(text).toContain('Unable to load');
    expect(document.querySelector('#last-refresh').textContent).toContain('Last refreshed');
  });

  it('synchronizes filters and exposes loading state accessibly', () => {
    const state = {
      isLoading: true,
      enabledSources: ['eonet', 'gdacs'],
      enabledTypes: ['Earthquake', 'Flood'],
      timeRange: '30d',
      theme: 'light'
    };
    bindControls(document, {
      store: createStore({ sourceIds: sources.map(source => source.id) }),
      requestRefresh: vi.fn()
    });
    renderControlState(document, state);

    expect(document.querySelector('[data-source-toggle="eonet"]').checked).toBe(true);
    expect(document.querySelector('[data-source-toggle="usgs"]').checked).toBe(false);
    expect(document.querySelector('[data-type-toggle="Flood"]').checked).toBe(true);
    expect(document.querySelector('[data-type-toggle="Storm"]').checked).toBe(false);
    expect(document.querySelector('#time-range').value).toBe('30d');
    expect(document.querySelector('#loading-indicator').hidden).toBe(false);
    expect(document.querySelector('#refresh-button').disabled).toBe(true);
    expect(document.querySelector('#monitor-region').getAttribute('aria-busy')).toBe('true');
    expect(document.querySelector('#theme-toggle').getAttribute('aria-label')).toBe('Switch to dark theme');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');

    renderControlState(document, { ...state, isLoading: false });
    expect(document.querySelector('#loading-indicator').hidden).toBe(true);
    expect(document.querySelector('#refresh-button').disabled).toBe(false);
    expect(document.querySelector('#monitor-region').getAttribute('aria-busy')).toBe('false');
  });

  it('binds every control to the store and removes every listener', () => {
    const store = createStore({ sourceIds: sources.map(source => source.id) });
    const requestRefresh = vi.fn();
    const dispose = bindControls(document, { store, requestRefresh });
    expect(document.querySelector('#source-controls').textContent).toContain('NASA EONET');
    expect(document.querySelector('#type-controls').textContent).toContain(Object.keys(TYPE_COLORS)[0]);

    const sourceToggle = document.querySelector('[data-source-toggle="eonet"]');
    sourceToggle.checked = false;
    sourceToggle.dispatchEvent(new Event('change'));
    expect(store.getState().enabledSources).not.toContain('eonet');
    expect(requestRefresh).toHaveBeenCalledTimes(1);

    const typeToggle = document.querySelector('[data-type-toggle="Flood"]');
    typeToggle.checked = false;
    typeToggle.dispatchEvent(new Event('change'));
    expect(store.getState().enabledTypes).not.toContain('Flood');
    document.querySelector('#time-range').value = 'all';
    document.querySelector('#time-range').dispatchEvent(new Event('change'));
    expect(store.getState().timeRange).toBe('all');
    document.querySelector('#theme-toggle').dispatchEvent(new Event('click'));
    expect(store.getState().theme).toBe('light');
    document.querySelector('#refresh-button').dispatchEvent(new Event('click'));
    expect(requestRefresh).toHaveBeenCalledTimes(2);

    dispose();
    sourceToggle.checked = true;
    sourceToggle.dispatchEvent(new Event('change'));
    document.querySelector('#refresh-button').dispatchEvent(new Event('click'));
    expect(store.getState().enabledSources).not.toContain('eonet');
    expect(requestRefresh).toHaveBeenCalledTimes(2);
  });

  it('renders the current snapshot, subscribes once, and returns an unsubscribe function', () => {
    const visibleEvent = {
      id: 'eonet:test', sourceId: 'eonet', sourceName: 'NASA EONET', name: 'Test fire',
      type: 'Wildfire', severity: 'Not specified', timestamp: '2026-09-12T00:00:00.000Z',
      geometry: { type: 'Point', coordinates: [20, 10] }, detailUrl: null
    };
    const store = createStore({
      sourceIds: sources.map(source => source.id),
      initialState: { eventsBySource: { eonet: [visibleEvent] } }
    });
    const mapView = { render: vi.fn(), setTheme: vi.fn() };
    const unsubscribe = createAppRenderer({
      root: document,
      store,
      mapView,
      sources,
      now: () => new Date('2026-09-13T00:00:00.000Z')
    });

    expect(mapView.render).toHaveBeenLastCalledWith([visibleEvent]);
    expect(mapView.setTheme).toHaveBeenLastCalledWith('dark');
    store.setTheme('light');
    expect(mapView.setTheme).toHaveBeenLastCalledWith('light');
    expect(mapView.render).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.setTimeRange('all');
    expect(mapView.render).toHaveBeenCalledTimes(2);
  });
});

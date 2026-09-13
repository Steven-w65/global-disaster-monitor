import { describe, expect, it, vi } from 'vitest';
import { createStore, selectStatistics, selectVisibleEvents } from '../../src/state/store.js';

const now = new Date('2026-09-13T00:00:00Z');
const event = (id, sourceId, type, timestamp = '2026-09-12T00:00:00Z') => ({
  id, sourceId, sourceName: sourceId, name: id, type, severity: 'Not specified', timestamp,
  geometry: { type: 'Point', coordinates: [20, 10] }, detailUrl: 'https://example.gov/event'
});
const setup = () => {
  const store = createStore({ sourceIds: ['eonet', 'usgs', 'gdacs'] });
  store.beginRefresh(1);
  store.completeSource(1, 'usgs', [event('eq', 'usgs', 'Earthquake')]);
  store.completeSource(1, 'eonet', [
    event('boundary', 'eonet', 'Wildfire', '2026-09-06T00:00:00Z'),
    event('month', 'eonet', 'Storm', '2026-08-14T00:00:00Z'),
    event('old', 'eonet', 'Flood', '2026-08-01T00:00:00Z')
  ]);
  store.finishRefresh(1, now);
  return store;
};

describe('store selectors', () => {
  it('combines source, type, and inclusive time filters with zero-filled statistics', () => {
    const store = setup();
    expect(selectVisibleEvents(store.getState(), now).map(item => item.id)).toEqual(['boundary', 'eq']);
    expect(selectStatistics(store.getState(), now)).toEqual({
      total: 2, bySource: { eonet: 1, usgs: 1, gdacs: 0 },
      byType: { Earthquake: 1, Wildfire: 1, Volcano: 0, Storm: 0, Flood: 0 }
    });
    store.setTimeRange('30d');
    expect(selectStatistics(store.getState(), now).total).toBe(3);
    store.setTimeRange('all');
    expect(selectStatistics(store.getState(), now).total).toBe(4);
    store.setTypeEnabled('Wildfire', false);
    store.setSourceEnabled('usgs', false);
    expect(selectVisibleEvents(store.getState(), now).map(item => item.id)).toEqual(['month', 'old']);
  });

  it('publishes frozen snapshots detached from caller-owned records and previous snapshots', () => {
    const initialState = { theme: 'light', enabledSources: ['usgs'] };
    const store = createStore({ sourceIds: ['eonet', 'usgs'], initialState });
    initialState.enabledSources.push('eonet');
    const previous = store.getState();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.beginRefresh(1);
    const input = event('eq', 'usgs', 'Earthquake');
    store.completeSource(1, 'usgs', [input]);
    input.geometry.coordinates[0] = 99;
    const state = store.getState();
    expect(state.eventsBySource.usgs[0].geometry.coordinates).toEqual([20, 10]);
    expect(previous.eventsBySource.usgs).toEqual([]);
    expect(state.enabledSources).toEqual(['usgs']);
    expect(() => state.enabledSources.push('eonet')).toThrow();
    expect(() => state.eventsBySource.usgs[0].geometry.coordinates.push(99)).toThrow();
    expect(() => { state.sourceStatus.usgs.kind = 'error'; }).toThrow();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toBe(state);
    unsubscribe();
    store.setTheme('dark');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(previous.theme).toBe('light');
    expect(store.getState().theme).toBe('dark');
  });

  it('ignores every stale mutation and clears only a failing source', () => {
    const store = setup();
    store.beginRefresh(2);
    const snapshot = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);
    store.beginRefresh(1);
    store.completeSource(1, 'usgs', [event('stale', 'usgs', 'Earthquake')]);
    store.failSource(1, 'eonet', 'stale error');
    store.finishRefresh(1, '2026-09-14T00:00:00Z');
    expect(store.getState()).toBe(snapshot);
    expect(listener).not.toHaveBeenCalled();
    store.failSource(2, 'usgs', 'Unable to load — retry refresh.');
    store.finishRefresh(2, '2026-09-14T00:00:00Z');
    expect(store.getState().eventsBySource.usgs).toEqual([]);
    expect(store.getState().eventsBySource.eonet).toHaveLength(3);
    expect(store.getState().lastRefresh).toBe('2026-09-13T00:00:00.000Z');
    expect(store.getState().isLoading).toBe(false);
  });

  it('marks disabled sources, restores toggles, and preserves the timestamp when no source succeeds', () => {
    const store = setup();
    store.setSourceEnabled('gdacs', false);
    expect(store.getState().sourceStatus.gdacs.kind).toBe('disabled');
    store.setSourceEnabled('gdacs', true);
    store.setTypeEnabled('Storm', false);
    store.setTypeEnabled('Storm', true);
    store.beginRefresh(2);
    store.completeSource(2, 'gdacs', []);
    store.finishRefresh(2, '2026-09-14T00:00:00Z');
    expect(store.getState().lastRefresh).toBe('2026-09-14T00:00:00.000Z');
    expect(store.getState().sourceStatus.gdacs).toMatchObject({ kind: 'success', count: 0 });
    expect(store.getState().enabledTypes).toContain('Storm');
  });
});

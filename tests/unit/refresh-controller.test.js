import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../../src/state/store.js';
import { createRefreshController } from '../../src/services/refresh-controller.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const normalized = (id, sourceId) => ({
  id,
  sourceId,
  sourceName: sourceId,
  name: id,
  type: sourceId === 'usgs' ? 'Earthquake' : 'Storm',
  severity: 'Not specified',
  timestamp: '2026-09-13T00:00:00.000Z',
  geometry: { type: 'Point', coordinates: [20, 10] },
  detailUrl: 'https://example.gov/event'
});

const source = id => ({
  id,
  label: id,
  buildRequest: () => ({ url: `https://example.gov/${id}`, options: {} }),
  parseResponse: payload => (payload.events ?? []).map(item => normalized(item.id, id))
});

const fixedNow = () => new Date('2026-09-13T00:00:00Z');

describe('refresh controller', () => {
  it('settles source failures independently while publishing successful sources', async () => {
    const sources = [source('eonet'), source('usgs'), source('gdacs')];
    const store = createStore({ sourceIds: sources.map(sourceItem => sourceItem.id) });
    const fetchJson = vi.fn()
      .mockResolvedValueOnce({ events: [{ id: 'eonet-new' }] })
      .mockRejectedValueOnce(new Error('offline at https://secret.invalid/?token=secret'))
      .mockResolvedValueOnce({ events: [{ id: 'gdacs-new' }] });
    const controller = createRefreshController({ store, sources, fetchJson, timeoutMs: 50, now: fixedNow });

    await controller.refresh();

    expect(store.getState()).toMatchObject({
      isLoading: false,
      lastRefresh: '2026-09-13T00:00:00.000Z',
      sourceStatus: {
        eonet: { kind: 'success', count: 1 },
        usgs: { kind: 'error', message: 'Unable to load — retry refresh.' },
        gdacs: { kind: 'success', count: 1 }
      }
    });
    expect(store.getState().eventsBySource.eonet[0].id).toBe('eonet-new');
    expect(store.getState().eventsBySource.usgs).toEqual([]);
    expect(store.getState().eventsBySource.gdacs[0].id).toBe('gdacs-new');
  });

  it('ignores every completion and status update from an older overlapping refresh', async () => {
    const sources = [source('eonet'), source('usgs'), source('gdacs')];
    const store = createStore({ sourceIds: sources.map(sourceItem => sourceItem.id) });
    const oldEonet = deferred();
    const oldUsgs = deferred();
    const signals = [];
    const fetchJson = vi.fn()
      .mockImplementationOnce((_request, options) => {
        signals.push(options.signal);
        return oldEonet.promise;
      })
      .mockImplementationOnce(() => oldUsgs.promise)
      .mockResolvedValueOnce({ events: [{ id: 'eonet-newest' }] });
    const controller = createRefreshController({ store, sources, fetchJson, timeoutMs: 50, now: fixedNow });

    const older = controller.refresh({ sourceIds: ['eonet', 'usgs'] });
    const newer = controller.refresh({ sourceIds: ['eonet'] });
    await newer;
    oldEonet.resolve({ events: [{ id: 'eonet-stale' }] });
    oldUsgs.reject(new Error('older USGS failure'));
    await older;

    expect(signals[0].aborted).toBe(true);
    expect(store.getState().eventsBySource.eonet.map(item => item.id)).toEqual(['eonet-newest']);
    expect(store.getState().sourceStatus.eonet).toEqual({ kind: 'success', count: 1 });
    expect(store.getState().sourceStatus.usgs).toEqual({ kind: 'idle' });
    expect(store.getState().isLoading).toBe(false);
  });

  it('aborts active work on dispose and rejects later refreshes', async () => {
    const sources = [source('eonet')];
    const store = createStore({ sourceIds: ['eonet'] });
    let requestSignal;
    const fetchJson = vi.fn((_request, { signal }) => {
      requestSignal = signal;
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    });
    const controller = createRefreshController({ store, sources, fetchJson, timeoutMs: 50, now: fixedNow });

    const active = controller.refresh();
    controller.dispose();
    await active;

    expect(requestSignal.aborted).toBe(true);
    await expect(controller.refresh()).rejects.toMatchObject({ code: 'DISPOSED' });
  });
});

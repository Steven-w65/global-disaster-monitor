const REFRESH_FAILURE_MESSAGE = 'Unable to load — retry refresh.';

function disposedError() {
  return Object.assign(new Error('The refresh controller has been disposed.'), { code: 'DISPOSED' });
}

function requestTimeRange(range, currentTime) {
  if (range === 'all') return { start: null, end: null };
  const days = range === '30d' ? 30 : 7;
  return {
    start: new Date(currentTime.getTime() - days * 24 * 60 * 60 * 1000).toISOString(),
    end: currentTime.toISOString()
  };
}

export function createRefreshController({ store, sources, fetchJson, timeoutMs, now = () => new Date() }) {
  if (!store || !Array.isArray(sources) || typeof fetchJson !== 'function') {
    throw new TypeError('store, sources, and fetchJson are required.');
  }

  const sourcesById = new Map(sources.map(source => [source.id, source]));
  let generation = Number(store.getState().activeGeneration) || 0;
  let activeController = null;
  let disposed = false;

  async function refresh(options = {}) {
    if (disposed) throw disposedError();

    const refreshGeneration = ++generation;
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    const state = store.getState();
    const requestedIds = options.sourceIds === undefined ? state.enabledSources : options.sourceIds;
    const selectedSources = [...new Set(requestedIds)]
      .filter(id => state.enabledSources.includes(id))
      .map(id => sourcesById.get(id))
      .filter(Boolean);
    const selectedIds = selectedSources.map(source => source.id);
    const currentTime = now();
    const context = {
      signal: controller.signal,
      timeRange: requestTimeRange(state.timeRange, currentTime),
      now: currentTime
    };

    store.beginRefresh(refreshGeneration, selectedIds);

    const results = await Promise.allSettled(selectedSources.map(async source => {
      try {
        const request = source.buildRequest(context);
        const payload = await fetchJson(request, {
          signal: controller.signal,
          timeoutMs
        });
        const events = source.parseResponse(payload, context);
        store.completeSource(refreshGeneration, source.id, Array.isArray(events) ? events : []);
        return events;
      } catch (error) {
        store.failSource(refreshGeneration, source.id, REFRESH_FAILURE_MESSAGE);
        throw error;
      }
    }));

    store.finishRefresh(refreshGeneration, now());
    if (activeController === controller) activeController = null;
    return results;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    activeController?.abort();
    activeController = null;
  }

  return Object.freeze({ refresh, dispose });
}

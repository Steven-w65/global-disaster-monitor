const EVENT_TYPES = Object.freeze(['Earthquake', 'Wildfire', 'Volcano', 'Storm', 'Flood']);
const TIME_RANGES = Object.freeze({ '7d': 7, '30d': 30, all: null });

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function initialSnapshot(sourceIds, initialState = {}) {
  const enabledSources = initialState.enabledSources === undefined
    ? [...sourceIds]
    : [...initialState.enabledSources].filter(id => sourceIds.includes(id));
  const enabledTypes = initialState.enabledTypes === undefined
    ? [...EVENT_TYPES]
    : [...initialState.enabledTypes].filter(type => EVENT_TYPES.includes(type));
  const suppliedEvents = initialState.eventsBySource || {};
  const suppliedStatus = initialState.sourceStatus || {};
  const eventsBySource = Object.fromEntries(sourceIds.map(id => [id, clone(suppliedEvents[id] || [])]));
  const sourceStatus = Object.fromEntries(sourceIds.map(id => [
    id,
    clone(suppliedStatus[id] || { kind: enabledSources.includes(id) ? 'idle' : 'disabled' })
  ]));

  return freeze({
    theme: initialState.theme === 'light' ? 'light' : 'dark',
    timeRange: Object.hasOwn(TIME_RANGES, initialState.timeRange) ? initialState.timeRange : '7d',
    enabledSources,
    enabledTypes,
    eventsBySource,
    sourceStatus,
    activeGeneration: Number.isFinite(initialState.activeGeneration) ? initialState.activeGeneration : 0,
    isLoading: Boolean(initialState.isLoading),
    lastRefresh: normalizeTimestamp(initialState.lastRefresh),
    selectedEvent: clone(initialState.selectedEvent ?? null)
  });
}

export function createStore({ sourceIds, initialState } = {}) {
  if (!Array.isArray(sourceIds) || new Set(sourceIds).size !== sourceIds.length) {
    throw new TypeError('sourceIds must be an array of unique IDs.');
  }

  const knownSources = new Set(sourceIds);
  const listeners = new Set();
  let snapshot = initialSnapshot([...sourceIds], initialState);
  let successfulGeneration = null;

  const publish = next => {
    snapshot = freeze(next);
    for (const listener of [...listeners]) listener(snapshot);
  };

  const replace = changes => publish({ ...snapshot, ...changes });
  const ensureSource = id => {
    if (!knownSources.has(id)) throw new RangeError(`Unknown source: ${id}`);
  };

  return Object.freeze({
    getState() {
      return snapshot;
    },

    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setTheme(theme) {
      if (theme !== 'dark' && theme !== 'light') throw new RangeError('theme must be dark or light.');
      if (snapshot.theme !== theme) replace({ theme });
    },

    setTimeRange(range) {
      if (!Object.hasOwn(TIME_RANGES, range)) throw new RangeError('time range must be 7d, 30d, or all.');
      if (snapshot.timeRange !== range) replace({ timeRange: range });
    },

    setSourceEnabled(id, enabled) {
      ensureSource(id);
      const shouldEnable = Boolean(enabled);
      const isEnabled = snapshot.enabledSources.includes(id);
      if (shouldEnable === isEnabled) return;

      const enabledSources = shouldEnable
        ? sourceIds.filter(sourceId => sourceId === id || snapshot.enabledSources.includes(sourceId))
        : snapshot.enabledSources.filter(sourceId => sourceId !== id);
      replace({
        enabledSources,
        sourceStatus: {
          ...snapshot.sourceStatus,
          [id]: shouldEnable ? { kind: 'idle' } : { kind: 'disabled' }
        }
      });
    },

    setTypeEnabled(type, enabled) {
      if (!EVENT_TYPES.includes(type)) throw new RangeError(`Unknown event type: ${type}`);
      const shouldEnable = Boolean(enabled);
      const isEnabled = snapshot.enabledTypes.includes(type);
      if (shouldEnable === isEnabled) return;
      const enabledTypes = shouldEnable
        ? EVENT_TYPES.filter(eventType => eventType === type || snapshot.enabledTypes.includes(eventType))
        : snapshot.enabledTypes.filter(eventType => eventType !== type);
      replace({ enabledTypes });
    },

    beginRefresh(generation, requestedSourceIds = snapshot.enabledSources) {
      if (!Number.isFinite(generation) || generation <= snapshot.activeGeneration) return;
      const requested = new Set(requestedSourceIds.filter(id => knownSources.has(id) && snapshot.enabledSources.includes(id)));
      const sourceStatus = Object.fromEntries(sourceIds.map(id => {
        if (!snapshot.enabledSources.includes(id)) return [id, { kind: 'disabled' }];
        if (requested.has(id)) return [id, { kind: 'loading' }];
        return [id, snapshot.sourceStatus[id]?.kind === 'loading' ? { kind: 'idle' } : snapshot.sourceStatus[id]];
      }));
      successfulGeneration = null;
      replace({ activeGeneration: generation, isLoading: true, sourceStatus });
    },

    completeSource(generation, sourceId, events) {
      if (generation !== snapshot.activeGeneration) return;
      ensureSource(sourceId);
      const copiedEvents = clone(Array.isArray(events) ? events : []);
      successfulGeneration = generation;
      replace({
        eventsBySource: { ...snapshot.eventsBySource, [sourceId]: copiedEvents },
        sourceStatus: { ...snapshot.sourceStatus, [sourceId]: { kind: 'success', count: copiedEvents.length } }
      });
    },

    failSource(generation, sourceId, message) {
      if (generation !== snapshot.activeGeneration) return;
      ensureSource(sourceId);
      replace({
        eventsBySource: { ...snapshot.eventsBySource, [sourceId]: [] },
        sourceStatus: {
          ...snapshot.sourceStatus,
          [sourceId]: { kind: 'error', message: String(message || 'Unable to load — retry refresh.') }
        }
      });
    },

    finishRefresh(generation, completedAt) {
      if (generation !== snapshot.activeGeneration) return;
      const changes = { isLoading: false };
      if (successfulGeneration === generation) changes.lastRefresh = normalizeTimestamp(completedAt);
      replace(changes);
    }
  });
}

export function selectVisibleEvents(state, now = new Date()) {
  const enabledSources = new Set(state.enabledSources);
  const enabledTypes = new Set(state.enabledTypes);
  const rangeDays = TIME_RANGES[state.timeRange] ?? null;
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const minimumTime = rangeDays === null ? null : currentTime - rangeDays * 24 * 60 * 60 * 1000;

  return Object.entries(state.eventsBySource).flatMap(([sourceId, events]) => {
    if (!enabledSources.has(sourceId) || !Array.isArray(events)) return [];
    return events.filter(event => {
      if (!enabledTypes.has(event.type)) return false;
      if (minimumTime === null) return true;
      const eventTime = new Date(event.timestamp).getTime();
      return Number.isFinite(eventTime) && eventTime >= minimumTime && eventTime <= currentTime;
    });
  });
}

export function selectStatistics(state, now = new Date()) {
  const events = selectVisibleEvents(state, now);
  const bySource = Object.fromEntries(Object.keys(state.eventsBySource).map(id => [id, 0]));
  const byType = Object.fromEntries(EVENT_TYPES.map(type => [type, 0]));
  for (const event of events) {
    if (Object.hasOwn(bySource, event.sourceId)) bySource[event.sourceId] += 1;
    if (Object.hasOwn(byType, event.type)) byType[event.type] += 1;
  }
  return { total: events.length, bySource, byType };
}

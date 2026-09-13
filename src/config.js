export const THEME_KEY = 'global-disaster-monitor-theme';
export const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
export const SOURCE_REQUEST_TIMEOUT_MS = 15_000;

export const TYPE_COLORS = Object.freeze({
  Earthquake: '#ff4444', Wildfire: '#ff9100', Volcano: '#8b4513',
  Storm: '#0099ff', Flood: '#66ccff'
});

export const SEVERITY_COLORS = Object.freeze({
  red: '#ef4444', orange: '#f97316', yellow: '#eab308'
});

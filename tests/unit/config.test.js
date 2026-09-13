import { describe, expect, it } from 'vitest';
import {
  REFRESH_INTERVAL_MS,
  SEVERITY_COLORS,
  SOURCE_REQUEST_TIMEOUT_MS,
  THEME_KEY,
  TYPE_COLORS
} from '../../src/config.js';

describe('production configuration', () => {
  it('preserves timing and theme contracts', () => {
    expect(REFRESH_INTERVAL_MS).toBe(10 * 60 * 1000);
    expect(SOURCE_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(THEME_KEY).toBe('global-disaster-monitor-theme');
  });

  it('preserves the required disaster and severity colors', () => {
    expect(TYPE_COLORS).toEqual({
      Earthquake: '#ff4444', Wildfire: '#ff9100', Volcano: '#8b4513',
      Storm: '#0099ff', Flood: '#66ccff'
    });
    expect(SEVERITY_COLORS).toEqual({ red: '#ef4444', orange: '#f97316', yellow: '#eab308' });
  });
});

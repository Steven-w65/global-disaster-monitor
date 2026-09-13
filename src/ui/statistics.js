import { TYPE_COLORS } from '../config.js';

function appendCount(root, label, count) {
  const row = root.ownerDocument.createElement('div');
  row.className = `flex items-center justify-between ${count ? '' : 'text-muted'}`.trim();
  const name = root.ownerDocument.createElement('span');
  const value = root.ownerDocument.createElement('span');
  name.textContent = label;
  value.className = 'font-bold';
  value.textContent = String(count);
  row.append(name, value);
  root.append(row);
}

export function renderStatistics(root, statistics, sources) {
  const total = root.querySelector('#visible-total') || root.querySelector('#total-count');
  const sourceStats = root.querySelector('#source-stats');
  const typeStats = root.querySelector('#type-stats');
  if (total) total.textContent = String(statistics.total);

  if (sourceStats) {
    sourceStats.replaceChildren();
    for (const source of sources) appendCount(sourceStats, source.label, statistics.bySource[source.id] || 0);
  }

  if (typeStats) {
    typeStats.replaceChildren();
    for (const type of Object.keys(TYPE_COLORS)) appendCount(typeStats, type, statistics.byType[type] || 0);
  }
}

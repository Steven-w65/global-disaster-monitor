import { safeUrl } from '../sources/source-contract.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatEventTime(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === '') return 'Not available';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function formatCoordinate(value) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate.toFixed(4) : 'Not available';
}

export function buildPopupContent(event) {
  const detailUrl = safeUrl(event?.detailUrl);
  const detailLink = detailUrl
    ? `<a class="popup-cta mt-3 inline-flex rounded px-2 py-1 text-xs font-semibold" href="${escapeHtml(detailUrl)}" target="_blank" rel="noopener noreferrer">View official details</a>`
    : '<span class="text-xs text-muted">No official detail link available</span>';
  const [longitude, latitude] = event?.geometry?.coordinates || [];

  return `<article class="popup-body min-w-56 text-sm">
    <h3 class="mb-2 text-base font-bold">${escapeHtml(event?.name)}</h3>
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt class="font-semibold">Type</dt><dd>${escapeHtml(event?.type)}</dd>
      <dt class="font-semibold">Severity</dt><dd>${escapeHtml(event?.severity || 'Not specified')}</dd>
      <dt class="font-semibold">Time</dt><dd>${escapeHtml(formatEventTime(event?.timestamp))}</dd>
      <dt class="font-semibold">Coordinates</dt><dd>${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}</dd>
      <dt class="font-semibold">Source</dt><dd>${escapeHtml(event?.sourceName || event?.sourceId)}</dd>
    </dl>${detailLink}
  </article>`;
}

export function markerAccessibleName(event) {
  const type = String(event?.type || 'Disaster').trim() || 'Disaster';
  const name = String(event?.name || 'Unnamed event').trim() || 'Unnamed event';
  const source = String(event?.sourceName || event?.sourceId || 'Unknown source').trim() || 'Unknown source';
  return `${type}: ${name} (${source})`;
}

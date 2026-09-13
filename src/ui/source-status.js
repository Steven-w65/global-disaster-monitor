function formatEventTime(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === '') return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function statusMessage(status) {
  if (!status || status.kind === 'idle') return 'Ready';
  if (status.kind === 'disabled') return 'Disabled';
  if (status.kind === 'loading') return 'Loading…';
  if (status.kind === 'success') return `${status.count || 0} loaded`;
  if (status.kind === 'error') return String(status.message || 'Unable to load — retry refresh.');
  return 'Ready';
}

export function renderSourceStatus(root, state, sources) {
  const statuses = root.querySelector('#source-statuses');
  const lastRefresh = root.querySelector('#last-refresh');

  if (statuses) {
    statuses.replaceChildren();
    for (const source of sources) {
      const message = statusMessage(state.sourceStatus?.[source.id]);
      const card = statuses.ownerDocument.createElement('div');
      card.className = 'rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-2';
      const label = statuses.ownerDocument.createElement('span');
      label.className = 'font-semibold';
      label.textContent = source.label;
      const status = statuses.ownerDocument.createElement('span');
      status.className = `ml-2 text-xs ${message === 'Disabled' || message === 'Ready' ? 'text-muted' : ''}`.trim();
      status.textContent = message;
      card.append(label, status);
      statuses.append(card);
    }
  }

  if (lastRefresh) {
    const formatted = formatEventTime(state.lastRefresh);
    lastRefresh.textContent = formatted ? `Last refreshed ${formatted}` : 'Waiting for first refresh';
  }
}

import { THEME_KEY, TYPE_COLORS } from '../config.js';
import { listSources } from '../sources/source-registry.js';

function renderSourceControls(root) {
  const container = root.querySelector('#source-controls');
  if (!container) return;
  container.replaceChildren();
  for (const source of listSources()) {
    const label = container.ownerDocument.createElement('label');
    label.className = 'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-sm transition';
    const input = container.ownerDocument.createElement('input');
    input.type = 'checkbox';
    input.dataset.sourceToggle = source.id;
    input.className = 'accent-[#0099ff]';
    label.append(input, ` ${source.label}`);
    container.append(label);
  }
}

function renderTypeControls(root) {
  const container = root.querySelector('#type-controls');
  if (!container) return;
  container.replaceChildren();
  for (const [type, color] of Object.entries(TYPE_COLORS)) {
    const label = container.ownerDocument.createElement('label');
    label.className = 'inline-flex cursor-pointer items-center gap-2 text-sm';
    const input = container.ownerDocument.createElement('input');
    input.type = 'checkbox';
    input.dataset.typeToggle = type;
    input.style.accentColor = color;
    label.append(input, ` ${type}`);
    container.append(label);
  }
}

export function renderControlState(root, state) {
  if (Array.isArray(state.enabledSources)) {
    const enabledSources = new Set(state.enabledSources);
    root.querySelectorAll('[data-source-toggle]').forEach(control => {
      control.checked = enabledSources.has(control.dataset.sourceToggle);
    });
  }
  if (Array.isArray(state.enabledTypes)) {
    const enabledTypes = new Set(state.enabledTypes);
    root.querySelectorAll('[data-type-toggle]').forEach(control => {
      control.checked = enabledTypes.has(control.dataset.typeToggle);
    });
  }

  const range = root.querySelector('#time-range');
  if (range && state.timeRange) range.value = state.timeRange;

  const documentRoot = root.documentElement || root.ownerDocument?.documentElement;
  const theme = state.theme === 'light' ? 'light' : 'dark';
  if (documentRoot && state.theme) {
    documentRoot.dataset.theme = theme;
    documentRoot.classList.toggle('dark', theme === 'dark');
    documentRoot.style.colorScheme = theme;
    try {
      (root.defaultView || root.ownerDocument?.defaultView)?.localStorage.setItem(THEME_KEY, theme);
    } catch (error) { /* storage is optional */ }
  }
  const themeToggle = root.querySelector('#theme-toggle');
  const themeIcon = root.querySelector('#theme-icon');
  const themeLabel = root.querySelector('#theme-label');
  if (themeToggle && state.theme) {
    themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  if (themeIcon && state.theme) themeIcon.textContent = theme === 'dark' ? '☾' : '☀';
  if (themeLabel && state.theme) themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';

  const isLoading = Boolean(state.isLoading);
  const loadingIndicator = root.querySelector('#loading-indicator');
  const refreshButton = root.querySelector('#refresh-button');
  const monitorRegion = root.querySelector('#monitor-region');
  if (loadingIndicator) loadingIndicator.hidden = !isLoading;
  if (refreshButton) refreshButton.disabled = isLoading;
  if (monitorRegion) monitorRegion.setAttribute('aria-busy', String(isLoading));
}

export function bindControls(root, { store, requestRefresh }) {
  renderSourceControls(root);
  renderTypeControls(root);
  renderControlState(root, store.getState());
  const removers = [];
  const listen = (element, name, listener) => {
    if (!element) return;
    element.addEventListener(name, listener);
    removers.push(() => element.removeEventListener(name, listener));
  };

  root.querySelectorAll('[data-source-toggle]').forEach(control => {
    listen(control, 'change', event => {
      store.setSourceEnabled(event.currentTarget.dataset.sourceToggle, event.currentTarget.checked);
      requestRefresh();
    });
  });
  root.querySelectorAll('[data-type-toggle]').forEach(control => {
    listen(control, 'change', event => {
      store.setTypeEnabled(event.currentTarget.dataset.typeToggle, event.currentTarget.checked);
    });
  });
  listen(root.querySelector('#time-range'), 'change', event => store.setTimeRange(event.currentTarget.value));
  listen(root.querySelector('#theme-toggle'), 'click', () => {
    store.setTheme(store.getState().theme === 'dark' ? 'light' : 'dark');
  });
  listen(root.querySelector('#refresh-button'), 'click', requestRefresh);

  return () => removers.splice(0).forEach(remove => remove());
}

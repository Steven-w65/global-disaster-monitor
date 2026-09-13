import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './styles.css';
import { REFRESH_INTERVAL_MS, SOURCE_REQUEST_TIMEOUT_MS, TYPE_COLORS } from './config.js';
import { createMapView } from './map/map-view.js';
import { fetchJson } from './services/api-client.js';
import { createRefreshController } from './services/refresh-controller.js';
import { listSources } from './sources/source-registry.js';
import { createStore } from './state/store.js';
import { bindControls } from './ui/controls.js';
import { createAppRenderer } from './ui/render-app.js';

export function initializeApp(root = document) {
  const sources = listSources();
  const store = createStore({
    sourceIds: sources.map(source => source.id),
    initialState: { theme: root.documentElement.dataset.theme === 'light' ? 'light' : 'dark' }
  });
  const mapView = createMapView({ element: root.querySelector('#map'), leaflet: L, colors: TYPE_COLORS });
  const refreshController = createRefreshController({ store, sources, fetchJson, timeoutMs: SOURCE_REQUEST_TIMEOUT_MS });
  const stopRendering = createAppRenderer({ root, store, mapView, sources, now: () => new Date() });
  const unbindControls = bindControls(root, { store, requestRefresh: () => refreshController.refresh() });
  const interval = window.setInterval(() => refreshController.refresh(), REFRESH_INTERVAL_MS);
  refreshController.refresh();
  return { dispose() { clearInterval(interval); unbindControls(); stopRendering(); refreshController.dispose(); mapView.destroy(); } };
}

initializeApp();

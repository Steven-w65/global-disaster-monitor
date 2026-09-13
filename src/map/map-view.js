import { SEVERITY_COLORS } from '../config.js';
import { buildPopupContent, markerAccessibleName } from '../ui/popup.js';

const MARKER_BATCH_SIZE = 200;

function createPointIcon(event, colors, leaflet) {
  const fillColor = colors[event.type] || '#64748b';
  const severityColor = event.sourceId === 'gdacs'
    ? SEVERITY_COLORS[String(event.severity || '').toLowerCase()]
    : null;
  const borderColor = severityColor || '#f8fafc';
  return leaflet.divIcon({
    className: 'disaster-marker',
    html: `<span aria-hidden="true" style="display:block;width:18px;height:18px;border-radius:9999px;background:${fillColor};border:${severityColor ? '3px' : '2px'} solid ${borderColor};box-shadow:0 1px 4px rgba(15,23,42,.55)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });
}

export function createMapView({
  element,
  leaflet,
  markerClusterFactory = () => leaflet.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false
  }),
  colors
}) {
  const map = leaflet.map(element, { worldCopyJump: true }).setView([0, 0], 2);
  leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  let markerCluster = markerClusterFactory();
  markerCluster.addTo(map);
  let currentTheme = null;
  let destroyed = false;
  let hasRendered = false;
  let pendingBatchTimer = null;
  let renderGeneration = 0;

  const cancelPendingBatches = () => {
    renderGeneration += 1;
    if (pendingBatchTimer !== null) {
      clearTimeout(pendingBatchTimer);
      pendingBatchTimer = null;
    }
    return renderGeneration;
  };

  const addMarkerBatches = (cluster, markers, generation) => {
    let offset = 0;
    const addNextBatch = () => {
      if (destroyed || generation !== renderGeneration) return;
      const batch = markers.slice(offset, offset + MARKER_BATCH_SIZE);
      cluster.addLayers(batch);
      offset += batch.length;
      if (offset < markers.length) {
        let timer;
        timer = setTimeout(() => {
          if (destroyed || generation !== renderGeneration) return;
          if (pendingBatchTimer === timer) pendingBatchTimer = null;
          addNextBatch();
        }, 0);
        pendingBatchTimer = timer;
      }
    };
    addNextBatch();
  };

  const createMarker = event => {
    const [longitude, latitude] = event.geometry.coordinates;
    const accessibleName = markerAccessibleName(event);
    const marker = leaflet.marker([latitude, longitude], {
      icon: createPointIcon(event, colors, leaflet),
      title: accessibleName,
      alt: accessibleName,
      riseOnHover: true
    });
    marker.on('add', () => marker.getElement()?.setAttribute('aria-label', accessibleName));
    return marker.bindPopup(buildPopupContent(event));
  };

  return Object.freeze({
    render(events) {
      if (destroyed) return;
      const generation = cancelPendingBatches();
      if (hasRendered) {
        markerCluster.clearLayers();
        map.removeLayer(markerCluster);
        markerCluster = markerClusterFactory();
        markerCluster.addTo(map);
      } else {
        markerCluster.clearLayers();
        hasRendered = true;
      }
      addMarkerBatches(markerCluster, events.map(createMarker), generation);
    },

    setTheme(theme) {
      if (destroyed || theme === currentTheme) return;
      currentTheme = theme;
      map.invalidateSize?.();
    },

    destroy() {
      if (destroyed) return;
      cancelPendingBatches();
      destroyed = true;
      markerCluster.clearLayers();
      map.removeLayer(markerCluster);
      map.remove();
    }
  });
}

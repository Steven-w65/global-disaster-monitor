import { selectStatistics, selectVisibleEvents } from '../state/store.js';
import { renderControlState } from './controls.js';
import { renderSourceStatus } from './source-status.js';
import { renderStatistics } from './statistics.js';

export function createAppRenderer({ root, store, mapView, sources, now = () => new Date() }) {
  let visibleEventsSignature = null;

  const render = state => {
    const currentTime = now();
    const visibleEvents = selectVisibleEvents(state, currentTime);
    const nextVisibleEventsSignature = JSON.stringify(visibleEvents);
    if (nextVisibleEventsSignature !== visibleEventsSignature) {
      visibleEventsSignature = nextVisibleEventsSignature;
      mapView.render(visibleEvents);
    }
    mapView.setTheme(state.theme);
    renderStatistics(root, selectStatistics(state, currentTime), sources);
    renderSourceStatus(root, state, sources);
    renderControlState(root, state);
  };

  render(store.getState());
  return store.subscribe(render);
}

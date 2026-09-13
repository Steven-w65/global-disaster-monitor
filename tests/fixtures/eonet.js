export const eonetPayload = {
  events: [{
    id: 'EONET_1',
    title: '<b>Recent fire</b>',
    categories: [{ id: 'wildfires', title: 'Wildfires' }],
    geometry: [
      { date: '2026-09-11T10:00:00Z', type: 'Point', coordinates: [150, -34] },
      { date: '2026-09-12T10:00:00Z', type: 'Point', coordinates: [151.2, -33.8] }
    ],
    sources: [{ id: 'EO', url: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1' }]
  }, {
    id: 'EONET_BAD',
    title: 'Invalid coordinates',
    categories: [{ id: 'wildfires' }],
    geometry: [{ date: '2026-09-12T10:00:00Z', type: 'Point', coordinates: [999, 999] }]
  }, {
    id: 'EONET_MALFORMED',
    title: 'Malformed geometry collection',
    categories: [{ id: 'wildfires' }],
    geometry: { date: '2026-09-12T10:00:00Z', type: 'Point', coordinates: [120, 45] }
  }, {
    id: 'EONET_UNSAFE',
    title: 'Unsafe source link',
    link: 'javascript:alert(1)',
    categories: [{ title: 'Volcanic eruption' }],
    geometry: [{ date: '2026-09-12T09:00:00Z', type: 'Point', coordinates: ['140.1', '35.2'] }]
  }, {
    id: 'EONET_MISSING_DATE',
    title: 'Missing date',
    categories: [{ title: 'Flooding' }],
    geometry: [{ type: 'Point', coordinates: [10, 20] }]
  }, {
    id: 'EONET_UNSUPPORTED',
    title: 'Unsupported type',
    categories: [{ title: 'Drought' }],
    geometry: [{ date: '2026-09-12T08:00:00Z', type: 'Point', coordinates: [10, 20] }]
  }]
};

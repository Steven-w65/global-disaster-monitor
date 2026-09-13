export const gdacsPayload = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {
      eventid: 'GDACS_1', eventname: 'Test flood', eventtype: 'FL', alertlevel: 'Orange',
      fromdate: '2026-09-12T12:00:00Z', url: { report: 'https://www.gdacs.org/report.aspx?eventid=GDACS_1' }
    },
    geometry: { type: 'Point', coordinates: [90.3, 23.7] }
  }, {
    type: 'Feature',
    properties: {
      eventid: 'GDACS_UNSAFE', eventname: 'Unsafe link', eventtype: 'FL', alertlevel: 'Yellow',
      fromdate: '2026-09-12T12:00:00Z', url: 'javascript:alert(1)'
    },
    geometry: { type: 'Point', coordinates: [91, 24] }
  }, {
    type: 'Feature',
    id: 'uppercase-report',
    properties: {
      EventName: 'Uppercase report', EventType: 'FL', AlertLevel: 'Orange', FromDate: '2026-09-12T12:30:00Z',
      URL: { REPORT: 'https://example.test/uppercase-report', details: 'https://example.test/unused-details' }
    },
    geometry: { type: 'Point', coordinates: [78.5, 22.1] }
  }, {
    type: 'Feature',
    id: 'nested-details',
    properties: {
      EventName: 'Nested details', EventType: 'TC', AlertLevel: 'red',
      FromDate: '2026-09-12T13:00:00Z', URL: { Details: 'https://example.test/details-only' }
    },
    geometry: { type: 'Point', coordinates: [79.5, 23.1] }
  }, {
    type: 'Feature',
    id: 'unsafe-report',
    properties: {
      EventName: 'Unsafe report', EventType: 'VO', AlertLevel: 'Red', FromDate: '2026-09-12T14:00:00Z',
      url: { report: 'javascript:alert(1)', details: 'https://example.test/should-not-bypass-report' }
    },
    geometry: { type: 'Point', coordinates: [80.5, 24.1] }
  }, {
    type: 'Feature',
    id: 'blank-report',
    properties: {
      EventName: 'Blank report', EventType: 'EQ', AlertLevel: 'Green', FromDate: '2026-09-12T15:00:00Z',
      url: { report: '   ', details: 'https://example.test/details-after-blank' }
    },
    geometry: { type: 'Point', coordinates: [81, 24.5] }
  }, {
    type: 'Feature',
    properties: {
      eventid: 'GDACS_FALLBACK', eventname: 'Coordinate fallback', eventtype: 'WF', alertlevel: 'Yellow',
      fromdate: '2026-09-12T16:00:00Z', longitude: '12.5', latitude: '-4.5', url: 'https://example.test/direct'
    }
  }, {
    type: 'Feature',
    properties: {
      eventid: 'GDACS_UNSUPPORTED', eventname: 'Unsupported type', eventtype: 'DR', alertlevel: 'Yellow',
      fromdate: '2026-09-12T17:00:00Z'
    },
    geometry: { type: 'Point', coordinates: [10, 20] }
  }, {
    type: 'Feature',
    properties: {
      eventid: 'GDACS_MISSING_DATE', eventname: 'Missing date', eventtype: 'FL', alertlevel: 'Yellow'
    },
    geometry: { type: 'Point', coordinates: [10, 20] }
  }]
};

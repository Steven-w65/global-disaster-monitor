import eonet from './eonet.js';
import usgs from './usgs.js';
import gdacs from './gdacs.js';

const sourcesById = new Map([[eonet.id, eonet], [usgs.id, usgs], [gdacs.id, gdacs]]);

export const SOURCE_REGISTRY = Object.freeze([eonet, usgs, gdacs]);
export const getSource = sourceId => sourcesById.get(sourceId) ?? null;
export const listSources = () => [...SOURCE_REGISTRY];

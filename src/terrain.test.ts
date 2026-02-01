import { describe, expect, it, test } from 'vitest';
import {
	getGsiDemProtocolAction,
	gsidem2terrarium,
	useGsiTerrainSource,
} from './terrain';
import maplibregl, {
	Map,
	type RasterDEMSourceSpecification,
} from 'maplibre-gl';

test('getGsiDemProtocolAction', async () => {
	const protocolAction = getGsiDemProtocolAction('myprotocol');
	maplibregl.addProtocol('myprotocol', protocolAction);
	const myProtocolSource: RasterDEMSourceSpecification = {
		type: 'raster-dem',
		tiles: ['myprotocol://https://example.com/{z}/{x}/{y}.png'],
		tileSize: 256,
		minzoom: 1,
		maxzoom: 17,
		attribution: '<a href="https://example.com">example</a>',
	};

	const map = new Map({
		container: document.createElement('div'),
		style: {
			version: 8,
			sources: { myProtocolSource },
			layers: [],
			terrain: { source: 'myProtocolSource', exaggeration: 1.2 },
		},
	});

	await new Promise((resolve) => map.on('load', resolve));

	expect(map.getSource('myProtocolSource')).toBeDefined();
	expect(map.getTerrain()).toEqual({
		source: 'myProtocolSource',
		exaggeration: 1.2,
	});
});

test('useGsiTerrainSource', async () => {
	const gsiTerrainSource = useGsiTerrainSource(maplibregl.addProtocol);
	const map = new Map({
		container: document.createElement('div'),
		style: {
			version: 8,
			sources: { terrain: gsiTerrainSource },
			layers: [],
			terrain: { source: 'terrain', exaggeration: 1.234 },
		},
	});

	await new Promise((resolve) => map.on('load', resolve));

	expect(map.getSource('terrain')).toBeDefined();
	expect(map.getTerrain()).toEqual({
		source: 'terrain',
		exaggeration: 1.234,
	});
});

import maplibregl, { RasterDEMSourceSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getGsiDemProtocolAction } from '../src/terrain.ts';

const protocolAction = getGsiDemProtocolAction('gsidem');
maplibregl.addProtocol('gsidem', protocolAction);
const gsiTerrainSource: RasterDEMSourceSpecification = {
	type: 'raster-dem',
	tiles: ['gsidem://https://tiles.gsj.jp/tiles/elev/mixed/{z}/{y}/{x}.png'],
	tileSize: 256,
	encoding: 'terrarium',
	minzoom: 1,
	maxzoom: 17,
	attribution:
		'<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
};

new maplibregl.Map({
	container: 'app',
	zoom: 13,
	center: [138.7, 35.3],
	minZoom: 5,
	maxZoom: 18,
	pitch: 70,
	maxPitch: 100,
	style: {
		version: 8,
		projection: {
			type: 'globe',
		},
		sources: {
			seamlessphoto: {
				type: 'raster',
				tiles: [
					'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
				],
				maxzoom: 18,
				tileSize: 256,
				attribution:
					'<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
			},
			terrain: gsiTerrainSource,
		},
		layers: [
			{
				id: 'seamlessphoto',
				source: 'seamlessphoto',
				type: 'raster',
			},
		],
		terrain: {
			source: 'terrain',
			exaggeration: 1.2,
		},
	},
});

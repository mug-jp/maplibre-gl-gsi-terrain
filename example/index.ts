import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
	getGsiDemProtocolAction,
	useGsiTerrainSource,
} from '../src/terrain.ts';

const protocolAction = getGsiDemProtocolAction('gsidem');
maplibregl.addProtocol('gsidem', protocolAction);
const gsiTerrainSource = useGsiTerrainSource(maplibregl.addProtocol, {
	tileUrl: 'https://tiles.gsj.jp/tiles/elev/mixed/{z}/{y}/{x}.png',
	maxzoom: 17,
	attribution:
		'<a href="https://gbank.gsj.jp/seamless/elev/">産総研シームレス標高タイル</a>',
});

new maplibregl.Map({
	container: 'app',
	zoom: 13,
	center: [138.7, 35.3],
	minZoom: 5,
	maxZoom: 22,
	pitch: 70,
	maxPitch: 85,
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
		},
	},
});

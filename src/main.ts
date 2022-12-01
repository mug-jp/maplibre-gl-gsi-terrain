import maplibreGl, { Map } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useGsiTerrain } from './terrain';

const gsiTerrainSource = useGsiTerrain(maplibreGl.addProtocol);

new Map({
    container: 'app',
    zoom: 5,
    center: [138, 37],
    minZoom: 5,
    maxZoom: 18,
    style: {
        version: 8,
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

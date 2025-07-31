import maplibregl, { RasterDEMSourceSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGsiTerrainSource } from '../src/terrain';

// 1mメッシュ対応の高解像度地形ソース
const highResTerrainSource = useGsiTerrainSource(maplibregl.addProtocol, {
    tileUrl: 'https://your-high-res-dem-endpoint/{z}/{x}/{y}.png',
    maxzoom: 18, // より高解像度に対応
    minzoom: 1,
    attribution: '高解像度DEMデータ（1mメッシュ）'
});

// 地図の初期化
const map = new maplibregl.Map({
    container: 'app',
    zoom: 15, // より詳細な表示
    center: [138.7, 35.3],
    minZoom: 10,
    maxZoom: 20, // より高解像度に対応
    pitch: 70,
    maxPitch: 100,
    style: {
        version: 8,
        projection: {
            type: 'globe',
        },
        sources: {
            // 高解像度航空写真
            highResPhoto: {
                type: 'raster',
                tiles: [
                    'https://your-high-res-photo-endpoint/{z}/{x}/{y}.jpg',
                ],
                maxzoom: 20,
                tileSize: 256,
                attribution: '高解像度航空写真'
            },
            terrain: highResTerrainSource,
        },
        layers: [
            {
                id: 'highResPhoto',
                source: 'highResPhoto',
                type: 'raster',
            },
        ],
        terrain: {
            source: 'terrain',
            exaggeration: 1.0, // 1mメッシュなので誇張を控えめに
        },
    },
});

// 地形の詳細表示設定
map.on('load', () => {
    // 地形の詳細度を調整
    map.setTerrain({
        source: 'terrain',
        exaggeration: 1.0,
    });
    
    // 高解像度表示のための設定
    map.setMaxZoom(20);
    map.setMinZoom(10);
}); 
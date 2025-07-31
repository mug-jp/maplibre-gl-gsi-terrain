import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getGsiDemProtocolAction } from '../src/terrain.ts';
import { 
    importDataFromFile, 
    exportDataToCSV, 
    clearData, 
    addDroneObjects, 
    addDroneTrails, 
    parseDroneCSV, 
    parseGeoJSON, 
    exportDroneDataToCSV, 
    exportDroneDataToGeoJSON, 
    downloadFile, 
    generateSampleDroneData, 
    clearDroneData,
    type Point3D, 
    type MeshVertex,
    type DroneObject 
} from '../src/data-import-export';

// 地理院DEM設定
const protocolAction = getGsiDemProtocolAction('gsidem');
maplibregl.addProtocol('gsidem', protocolAction);
const gsiTerrainSource = {
    type: 'raster-dem' as const,
    tiles: ['gsidem://https://tiles.gsj.jp/tiles/elev/mixed/{z}/{y}/{x}.png'],
    tileSize: 256,
    encoding: 'terrarium' as const,
    minzoom: 1,
    maxzoom: 17,
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
};

// 地図初期化
const map = new maplibregl.Map({
    container: 'map',
    zoom: 15,
    center: [139.7454, 35.6586], // 東京タワー
    minZoom: 5,
    maxZoom: 18,
    pitch: 60,
    maxPitch: 85,
    style: {
        version: 8,
        sources: {
            seamlessphoto: {
                type: 'raster',
                tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
                maxzoom: 18,
                tileSize: 256,
                attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
            },
            terrain: gsiTerrainSource,
            'drone-objects': {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            },
            'drone-connections': {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            },
            'altitude-lines': {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            },
            'drawing-polygon': {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            }
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
            exaggeration: 1.5,
        },
    },
});

// グローバル変数
let loadedObjects: DroneObject[] = [];
let is3D = true;
let drawMode = false;
let polygonDrawingMode = false;
let currentPolygonPoints: [number, number][] = [];
let droneSimulationInterval: number | null = null;
let sampleDataLoaded = false;

// フライトログ管理
interface FlightLogEntry {
    timestamp: string;
    phase: string;
    action: string;
    details: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

let flightLog: FlightLogEntry[] = [];
let flightPlanActive = false;
let flightPlanInterval: number | null = null;
let currentFlightPhase = 0;

// フライトプラン定義
const flightPlan = [
    { phase: '離陸', action: '東京タワー南側から離陸開始', duration: 3000, position: [139.7454, 35.6586, 100] },
    { phase: '外側旋回1', action: '北東角へ移動・ホバリング', duration: 4000, position: [139.7456, 35.6588, 150] },
    { phase: '外側旋回2', action: '北西角へ移動・ホバリング', duration: 4000, position: [139.7452, 35.6588, 150] },
    { phase: '外側旋回3', action: '南西角へ移動・ホバリング', duration: 4000, position: [139.7452, 35.6584, 150] },
    { phase: '外側旋回4', action: '南東角へ移動・ホバリング', duration: 4000, position: [139.7456, 35.6584, 150] },
    { phase: '内側旋回1', action: '内側北東へ移動・詳細撮影', duration: 3000, position: [139.7455, 35.6587, 120] },
    { phase: '内側旋回2', action: '内側北西へ移動・詳細撮影', duration: 3000, position: [139.7453, 35.6587, 120] },
    { phase: '内側旋回3', action: '内側南西へ移動・詳細撮影', duration: 3000, position: [139.7453, 35.6585, 120] },
    { phase: '内側旋回4', action: '内側南東へ移動・詳細撮影', duration: 3000, position: [139.7455, 35.6585, 120] },
    { phase: '中心部撮影', action: '東京タワー中心部で詳細撮影', duration: 5000, position: [139.7454, 35.6586, 200] },
    { phase: '着陸', action: '離陸地点に戻って着陸', duration: 3000, position: [139.7454, 35.6586, 0] }
];

// Toast通知システム
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'rgba(34, 197, 94, 0.9)' : type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(59, 130, 246, 0.9)'};
        backdrop-filter: blur(4px);
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        max-width: 300px;
        word-wrap: break-word;
        border: 1px solid ${type === 'success' ? 'rgba(34, 197, 94, 0.3)' : type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'};
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // アニメーション開始
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 100);
    
    // 自動で消える
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
};

// フライトログ管理機能
const addFlightLog = (phase: string, action: string, details: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('ja-JP');
    
    const logEntry: FlightLogEntry = {
        timestamp,
        phase,
        action,
        details,
        type
    };
    
    flightLog.push(logEntry);
    updateFlightLogDisplay();
    
    // ログが多すぎる場合は古いものを削除
    if (flightLog.length > 50) {
        flightLog = flightLog.slice(-30);
    }
};

const updateFlightLogDisplay = () => {
    const logContainer = document.getElementById('flightLog');
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    
    flightLog.forEach(entry => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const timestamp = document.createElement('span');
        timestamp.className = 'log-timestamp';
        timestamp.textContent = entry.timestamp;
        
        const phase = document.createElement('span');
        phase.className = 'log-phase';
        phase.textContent = entry.phase;
        
        const action = document.createElement('span');
        action.className = `log-action ${entry.type}`;
        action.textContent = entry.action;
        
        const details = document.createElement('span');
        details.className = 'log-details';
        details.textContent = entry.details;
        
        logEntry.appendChild(timestamp);
        logEntry.appendChild(phase);
        logEntry.appendChild(action);
        logEntry.appendChild(details);
        
        logContainer.appendChild(logEntry);
    });
    
    // 最新のログまでスクロール
    logContainer.scrollTop = logContainer.scrollHeight;
};

const clearFlightLog = () => {
    flightLog = [];
    updateFlightLogDisplay();
    addFlightLog('システム', 'ログクリア', 'フライトログをクリアしました', 'info');
};

const exportFlightLog = () => {
    const logText = flightLog.map(entry => 
        `${entry.timestamp},${entry.phase},${entry.action},${entry.details},${entry.type}`
    ).join('\n');
    
    const headers = 'timestamp,phase,action,details,type\n';
    const csvContent = headers + logText;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokyo_tower_flight_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addFlightLog('システム', 'ログエクスポート', 'フライトログをCSVファイルでエクスポートしました', 'success');
};

// ステータス更新
const updateStatus = (message: string) => {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = message;
    }
    console.log('Status:', message);
};

// レイヤー設定
const setupLayers = () => {
    // 高度表示ライン
    map.addLayer({
        id: 'altitude-lines-layer',
        type: 'line',
        source: 'altitude-lines',
        paint: {
            'line-color': '#ffaa00',
            'line-width': 1,
            'line-opacity': 0.4
        }
    });

    // ドローンオブジェクト（3D）
    map.addLayer({
        id: 'drone-objects-3d',
        type: 'circle',
        source: 'drone-objects',
        paint: {
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, ['interpolate', ['linear'], ['get', 'altitude'], 50, 3, 300, 8],
                18, ['interpolate', ['linear'], ['get', 'altitude'], 50, 6, 300, 16]
            ],
            'circle-color': [
                'match',
                ['get', 'type'],
                'drone', '#ff4444',
                'building', '#44ff44',
                'sensor', '#4444ff',
                'base', '#ffaa00',
                'weather', '#ff44ff',
                'manual', '#888888',
                'flight', '#ff6b6b',
                '#cccccc'
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
        }
    });

    // ドローンオブジェクト（2D）
    map.addLayer({
        id: 'drone-objects-2d',
        type: 'circle',
        source: 'drone-objects',
        layout: { 'visibility': 'none' },
        paint: {
            'circle-radius': 6,
            'circle-color': [
                'match',
                ['get', 'type'],
                'drone', '#ff4444',
                'building', '#44ff44',
                'sensor', '#4444ff',
                'base', '#ffaa00',
                'weather', '#ff44ff',
                'manual', '#888888',
                'flight', '#ff6b6b',
                '#cccccc'
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
        }
    });

    // 接続線
    map.addLayer({
        id: 'drone-connections',
        type: 'line',
        source: 'drone-connections',
        paint: {
            'line-color': '#00ff00',
            'line-width': 2,
            'line-opacity': 0.7,
            'line-dasharray': [2, 2]
        }
    });

    // ラベル
    map.addLayer({
        id: 'drone-labels',
        type: 'symbol',
        source: 'drone-objects',
        layout: {
            'text-field': [
                'format',
                ['get', 'name'], {},
                '\n', {},
                ['concat', ['to-string', ['get', 'altitude']], 'm'], { 'font-scale': 0.8 }
            ],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 12,
            'text-offset': [0, -2],
            'text-anchor': 'bottom'
        },
        paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
        }
    });

    // 多角形描画レイヤー
    map.addLayer({
        id: 'polygon-fill',
        type: 'fill',
        source: 'drawing-polygon',
        paint: {
            'fill-color': '#ff6b6b',
            'fill-opacity': 0.3
        }
    });

    map.addLayer({
        id: 'polygon-stroke',
        type: 'line',
        source: 'drawing-polygon',
        paint: {
            'line-color': '#ff6b6b',
            'line-width': 3,
            'line-opacity': 0.8
        }
    });

    map.addLayer({
        id: 'polygon-points',
        type: 'circle',
        source: 'drawing-polygon',
        paint: {
            'circle-radius': 6,
            'circle-color': '#ff6b6b',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });
};

// 表示更新
const updateDisplay = () => {
    // オブジェクト表示
    const features = loadedObjects.map(obj => ({
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [obj.longitude, obj.latitude]
        },
        properties: {
            id: obj.id,
            name: obj.name,
            altitude: obj.altitude,
            type: obj.type
        }
    }));

    (map.getSource('drone-objects') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: features
    });

    // 高度ライン表示
    const altitudeFeatures = loadedObjects.map(obj => ({
        type: 'Feature' as const,
        geometry: {
            type: 'LineString' as const,
            coordinates: [
                [obj.longitude, obj.latitude],
                [obj.longitude, obj.latitude]
            ]
        },
        properties: {
            altitude: obj.altitude
        }
    }));

    (map.getSource('altitude-lines') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: altitudeFeatures
    });

    // 接続線表示
    updateConnections();
    
    console.log(`表示更新: ${loadedObjects.length}個のオブジェクト`);
};

// 接続線更新
const updateConnections = () => {
    if (loadedObjects.length < 2) {
        (map.getSource('drone-connections') as maplibregl.GeoJSONSource)?.setData({
            type: 'FeatureCollection',
            features: []
        });
        return;
    }

    // タイプ別にグループ化して接続線作成
    const typeGroups: { [key: string]: DroneObject[] } = {};
    loadedObjects.forEach(obj => {
        if (!typeGroups[obj.type]) typeGroups[obj.type] = [];
        typeGroups[obj.type].push(obj);
    });

    const connectionFeatures: any[] = [];
    Object.values(typeGroups).forEach(objects => {
        if (objects.length >= 2) {
            const coordinates = objects.map(obj => [obj.longitude, obj.latitude]);
            connectionFeatures.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                },
                properties: {
                    type: 'connection'
                }
            });
        }
    });

    (map.getSource('drone-connections') as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: connectionFeatures
    });
};

// 多角形描画関数
const handlePolygonClick = (lngLat: maplibregl.LngLat) => {
    const point: [number, number] = [lngLat.lng, lngLat.lat];
    
    // 3点以上ある場合、始点に近いかチェック
    if (currentPolygonPoints.length >= 3) {
        const firstPoint = currentPolygonPoints[0];
        const distance = Math.sqrt(
            Math.pow((point[0] - firstPoint[0]) * 111000, 2) + 
            Math.pow((point[1] - firstPoint[1]) * 111000, 2)
        );
        
        // 100m以内なら多角形を完成
        if (distance < 100) {
            completePolygon();
            return;
        }
    }
    
    currentPolygonPoints.push(point);
    updatePolygonDisplay();
    
    showToast(`頂点${currentPolygonPoints.length}を追加 (${currentPolygonPoints.length >= 3 ? '始点をクリックして完成' : ''})`,'info');
};

const updatePolygonDisplay = () => {
    const features = [];
    
    // 現在の点を表示
    currentPolygonPoints.forEach((point, index) => {
        features.push({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: point
            },
            properties: {
                index,
                isFirst: index === 0
            }
        });
    });
    
    // 3点以上あれば線も表示
    if (currentPolygonPoints.length >= 2) {
        const lineCoords = [...currentPolygonPoints];
        // 描画中は最後の点から最初の点への線も表示（3点以上の場合）
        if (currentPolygonPoints.length >= 3) {
            lineCoords.push(currentPolygonPoints[0]);
        }
        
        features.push({
            type: 'Feature' as const,
            geometry: {
                type: 'LineString' as const,
                coordinates: lineCoords
            },
            properties: {
                type: 'drawing-line'
            }
        });
    }
    
    (map.getSource('drawing-polygon') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: features
    });
};

const completePolygon = () => {
    if (currentPolygonPoints.length < 3) {
        showToast('多角形を作成するには最低3点が必要です', 'warning');
        return;
    }
    
    // 多角形を閉じる
    const closedPoints = [...currentPolygonPoints, currentPolygonPoints[0]];
    
    // 面積計算 (概算)
    const area = calculatePolygonArea(currentPolygonPoints);
    
    // 多角形オブジェクトとして保存
    const polygonObject: DroneObject = {
        id: `polygon_${Date.now()}`,
        name: `検査エリア_${loadedObjects.filter(obj => obj.type === 'polygon').length + 1}`,
        longitude: currentPolygonPoints[0][0], // 中心点代表座標
        latitude: currentPolygonPoints[0][1],
        altitude: 0,
        type: 'polygon',
        source: 'polygon_draw'
    } as DroneObject;
    
    loadedObjects.push(polygonObject);
    
    resetPolygonDrawing();
    updateDisplay();
    
    showToast(`多角形「${polygonObject.name}」を作成しました (面積: ${area.toFixed(0)}㎡)`, 'success');
};

const calculatePolygonArea = (coordinates: [number, number][]): number => {
    // Shoelace formula for polygon area calculation
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += coordinates[i][0] * coordinates[j][1];
        area -= coordinates[j][0] * coordinates[i][1];
    }
    
    // 度から平方メートルへの概算変換（緯度35度付近）
    area = Math.abs(area) / 2;
    const metersPerDegree = 111000; // 概算値
    return area * metersPerDegree * metersPerDegree;
};

const resetPolygonDrawing = () => {
    currentPolygonPoints = [];
    (map.getSource('drawing-polygon') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: []
    });
};

// オブジェクト追加
const addObjectAtLocation = (lngLat: maplibregl.LngLat) => {
    const newObject: DroneObject = {
        id: `manual_${Date.now()}`,
        name: `点検ポイント_${loadedObjects.filter(obj => obj.type === 'manual').length + 1}`,
        longitude: lngLat.lng,
        latitude: lngLat.lat,
        altitude: 150 + Math.random() * 100,
        type: 'manual',
        source: 'manual_draw'
    };
    
    loadedObjects.push(newObject);
    updateDisplay();
    showToast(`点検ポイントを追加: ${newObject.name}`, 'success');
};

// 2D/3D切り替え
const toggle3D = () => {
    is3D = !is3D;
    if (is3D) {
        map.easeTo({ pitch: 60, duration: 1000 });
        map.setLayoutProperty('drone-objects-3d', 'visibility', 'visible');
        map.setLayoutProperty('drone-objects-2d', 'visibility', 'none');
        updateStatus('3D表示に切り替え');
    } else {
        map.easeTo({ pitch: 0, duration: 1000 });
        map.setLayoutProperty('drone-objects-3d', 'visibility', 'none');
        map.setLayoutProperty('drone-objects-2d', 'visibility', 'visible');
        updateStatus('2D表示に切り替え');
    }
};

// イベントハンドラー設定
const setupEventHandlers = () => {
    // ポイントデータ読み込み
    document.getElementById('loadPoints')?.addEventListener('click', async () => {
        try {
            const response = await fetch('./data/mock-3d-data.csv');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const csvContent = await response.text();
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], 'sample-points.csv', { type: 'text/csv' });
            
            await importDataFromFile(file, map, 'points');
            showToast('ポイントデータを読み込みました', 'success');
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            showToast('データの読み込みに失敗しました', 'error');
        }
    });

    // メッシュデータ読み込み
    document.getElementById('loadMesh')?.addEventListener('click', async () => {
        try {
            const response = await fetch('./data/mock-mesh-data.csv');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const csvContent = await response.text();
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], 'sample-mesh.csv', { type: 'text/csv' });
            
            await importDataFromFile(file, map, 'mesh');
            showToast('メッシュデータを読み込みました', 'success');
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            showToast('データの読み込みに失敗しました', 'error');
        }
    });

    // 建物点検データ読み込み
    document.getElementById('loadBuilding')?.addEventListener('click', async () => {
        try {
            console.log('建物点検データ読み込み開始');
            
            const [pointsResponse, meshResponse] = await Promise.all([
                fetch('./data/mock-building-inspection-points.csv'),
                fetch('./data/mock-building-inspection-mesh.csv')
            ]);
            
            console.log('レスポンス確認:', {
                points: { ok: pointsResponse.ok, status: pointsResponse.status },
                mesh: { ok: meshResponse.ok, status: meshResponse.status }
            });
            
            if (!pointsResponse.ok || !meshResponse.ok) {
                throw new Error(`建物点検データの読み込みに失敗しました: HTTP error! status: points=${pointsResponse.status}, mesh=${meshResponse.status}`);
            }
            
            const [pointsContent, meshContent] = await Promise.all([
                pointsResponse.text(),
                meshResponse.text()
            ]);
            
            console.log('CSV内容確認:', {
                pointsLength: pointsContent.length,
                meshLength: meshContent.length,
                pointsPreview: pointsContent.substring(0, 200),
                meshPreview: meshContent.substring(0, 200)
            });
            
            const pointsBlob = new Blob([pointsContent], { type: 'text/csv' });
            const pointsFile = new File([pointsBlob], 'building-points.csv', { type: 'text/csv' });
            await importDataFromFile(pointsFile, map, 'building-inspection');
            
            const meshBlob = new Blob([meshContent], { type: 'text/csv' });
            const meshFile = new File([meshBlob], 'building-mesh.csv', { type: 'text/csv' });
            await importDataFromFile(meshFile, map, 'building-inspection-mesh');
            
            showToast('建物点検データを読み込みました', 'success');
        } catch (error) {
            console.error('建物点検データ読み込みエラー:', error);
            showToast(`建物点検データの読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`, 'error');
        }
    });

    // ドローン点検データ読み込み
    document.getElementById('loadDroneData')?.addEventListener('click', () => {
        if (!sampleDataLoaded) {
            const sampleData = generateSampleDroneData([139.7454, 35.6586]);
            loadedObjects.push(...sampleData);
            updateDisplay();
            sampleDataLoaded = true;
            updateStatus(`東京タワー点検データ読み込み完了: ${sampleData.length}オブジェクト`);
            showToast('東京タワー周辺点検ドローンを配置しました', 'success');
        } else {
            showToast('点検ドローンは既に配置済みです', 'info');
        }
    });

    // 飛行シミュレーション
    document.getElementById('startSimulation')?.addEventListener('click', () => {
        if (droneSimulationInterval) {
            clearInterval(droneSimulationInterval);
            droneSimulationInterval = null;
            updateStatus('シミュレーション停止');
            return;
        }

        if (loadedObjects.length === 0) {
            showToast('シミュレーションするドローンがありません', 'error');
            return;
        }

        updateStatus('ドローンシミュレーション開始');
        droneSimulationInterval = setInterval(() => {
            loadedObjects.forEach(obj => {
                if (obj.type === 'drone') {
                    obj.longitude += (Math.random() - 0.5) * 0.0002;
                    obj.latitude += (Math.random() - 0.5) * 0.0002;
                    obj.altitude += (Math.random() - 0.5) * 10;
                    obj.altitude = Math.max(50, Math.min(400, obj.altitude));
                }
            });
            updateDisplay();
        }, 1000) as any;
    });

    // 描画モード切り替え
    document.getElementById('toggleDrawMode')?.addEventListener('click', () => {
        drawMode = !drawMode;
        
        if (drawMode) {
            polygonDrawingMode = false; // 他のモードを無効化
            const polygonButton = document.getElementById('togglePolygonMode');
            if (polygonButton) {
                polygonButton.textContent = '多角形';
            }
            resetPolygonDrawing();
        }
        
        const button = document.getElementById('toggleDrawMode');
        if (button) {
            button.textContent = drawMode ? '描画モード停止' : '描画モード';
        }
        map.getCanvas().style.cursor = drawMode ? 'crosshair' : '';
        updateStatus(drawMode ? '描画モード有効 - マップをクリックして点検ポイントを追加' : '描画モード無効');
        showToast(drawMode ? '描画モードを有効にしました' : '描画モードを無効にしました', 'info');
    });

    // 多角形描画モード切り替え
    document.getElementById('togglePolygonMode')?.addEventListener('click', () => {
        polygonDrawingMode = !polygonDrawingMode;
        
        if (polygonDrawingMode) {
            drawMode = false; // 他のモードを無効化
            const drawButton = document.getElementById('toggleDrawMode');
            if (drawButton) {
                drawButton.textContent = '描画モード';
            }
        } else {
            resetPolygonDrawing(); // 描画中のデータをクリア
        }
        
        const button = document.getElementById('togglePolygonMode');
        if (button) {
            button.textContent = polygonDrawingMode ? '多角形停止' : '多角形';
        }
        map.getCanvas().style.cursor = polygonDrawingMode ? 'crosshair' : '';
        updateStatus(polygonDrawingMode ? '多角形描画モード有効 - クリックして頂点を追加、始点をクリックして完成' : '多角形描画モード無効');
        showToast(polygonDrawingMode ? '多角形描画モードを有効にしました' : '多角形描画モードを無効にしました', 'info');
    });

    // CSVエクスポート
    document.getElementById('exportCSV')?.addEventListener('click', () => {
        if (loadedObjects.length > 0) {
            const csv = exportDroneDataToCSV(loadedObjects);
            downloadFile(csv, 'tokyo_tower_drone_data.csv', 'text/csv');
            updateStatus('CSV書き出し完了');
            showToast('CSVファイルをダウンロードしました', 'success');
        } else {
            showToast('エクスポートするデータがありません', 'error');
        }
    });

    // GeoJSONエクスポート
    document.getElementById('exportGeoJSON')?.addEventListener('click', () => {
        if (loadedObjects.length > 0) {
            const geojson = exportDroneDataToGeoJSON(loadedObjects);
            downloadFile(geojson, 'tokyo_tower_drone_data.geojson', 'application/geo+json');
            updateStatus('GeoJSON書き出し完了');
            showToast('GeoJSONファイルをダウンロードしました', 'success');
        } else {
            showToast('エクスポートするデータがありません', 'error');
        }
    });

    // データクリア
    document.getElementById('clearData')?.addEventListener('click', () => {
        if (loadedObjects.length > 0 && confirm(`${loadedObjects.length}個のオブジェクトを全て削除しますか？`)) {
            loadedObjects = [];
            updateDisplay();
            clearData(map);
            sampleDataLoaded = false;
            if (droneSimulationInterval) {
                clearInterval(droneSimulationInterval);
                droneSimulationInterval = null;
            }
            updateStatus('全データクリア完了');
            showToast('全てのデータをクリアしました', 'info');
        }
    });

    // 2D/3D切り替え
    document.getElementById('toggle3D')?.addEventListener('click', () => {
        toggle3D();
        const button = document.getElementById('toggle3D');
        if (button) {
            button.textContent = is3D ? '2D表示' : '3D表示';
        }
        showToast(is3D ? '3D表示に切り替えました' : '2D表示に切り替えました', 'info');
    });

    // フライトログクリア
    document.getElementById('clearFlightLog')?.addEventListener('click', () => {
        clearFlightLog();
    });

    // フライトログエクスポート
    document.getElementById('exportFlightLog')?.addEventListener('click', () => {
        exportFlightLog();
    });

    // フライトプラン管理
    document.getElementById('startFlightPlan')?.addEventListener('click', () => {
        startFlightPlan();
    });

    document.getElementById('pauseFlightPlan')?.addEventListener('click', () => {
        pauseFlightPlan();
    });

    document.getElementById('exportFlightPlan')?.addEventListener('click', () => {
        exportFlightPlan();
    });

    document.getElementById('importFlightPlan')?.addEventListener('click', () => {
        importFlightPlan();
    });

    // フライトログ表示切替
    document.getElementById('toggleLog')?.addEventListener('click', () => {
        const flightLog = document.getElementById('flightLog') as HTMLElement;
        const toggleButton = document.getElementById('toggleLog') as HTMLButtonElement;
        
        console.log('Toggleボタンがクリックされました');
        console.log('FlightLog要素:', flightLog);
        console.log('Toggleボタン要素:', toggleButton);
        console.log('現在のFlightLog表示状態:', flightLog?.classList.contains('hidden'));
        
        if (flightLog && toggleButton) {
            // ログリストの表示状態を判定
            const isCurrentlyVisible = !flightLog.classList.contains('hidden');
            
            console.log('現在の表示状態:', isCurrentlyVisible);
            
            if (isCurrentlyVisible) {
                // ログリストを非表示にする
                flightLog.classList.add('hidden');
                toggleButton.textContent = 'ログ表示';
                addFlightLog('システム', 'ログ表示切替', 'ログ表示を無効にしました', 'info');
                console.log('ログリストを非表示にしました');
            } else {
                // ログリストを表示にする
                flightLog.classList.remove('hidden');
                toggleButton.textContent = 'ログ非表示';
                addFlightLog('システム', 'ログ表示切替', 'ログ表示を有効にしました', 'info');
                console.log('ログリストを表示にしました');
            }
        } else {
            console.error('FlightLogまたはToggleボタンが見つかりません');
        }
    });
};

// フライトプラン管理機能
const startFlightPlan = () => {
    if (flightPlanActive) {
        addFlightLog('システム', 'フライトプラン', 'フライトプランは既に実行中です', 'warning');
        return;
    }

    flightPlanActive = true;
    currentFlightPhase = 0;
    
    addFlightLog('システム', 'フライトプラン開始', '東京タワー点検フライトプランを開始します', 'success');
    
    // ドローンオブジェクトを作成
    if (loadedObjects.length === 0) {
        const droneObject: DroneObject = {
            id: 'inspection-drone-1',
            name: '東京タワー点検ドローン',
            longitude: 139.7454,
            latitude: 35.6586,
            altitude: 0,
            type: 'drone',
            source: 'flight-plan'
        };
        loadedObjects.push(droneObject);
        updateDisplay();
    }
    
    executeFlightPhase();
};

const executeFlightPhase = () => {
    if (!flightPlanActive || currentFlightPhase >= flightPlan.length) {
        completeFlightPlan();
        return;
    }
    
    const phase = flightPlan[currentFlightPhase];
    const drone = loadedObjects.find(obj => obj.type === 'drone');
    
    if (!drone) {
        addFlightLog('エラー', 'ドローン不在', '点検ドローンが見つかりません', 'error');
        return;
    }
    
    // ドローンの位置を更新
    drone.longitude = phase.position[0];
    drone.latitude = phase.position[1];
    drone.altitude = phase.position[2];
    
    addFlightLog(phase.phase, '実行中', phase.action, 'info');
    
    // 地図をドローンの位置に移動
    map.flyTo({
        center: [drone.longitude, drone.latitude],
        zoom: 18,
        duration: 2000
    });
    
    updateDisplay();
    
    // 次のフェーズへ
    setTimeout(() => {
        currentFlightPhase++;
        executeFlightPhase();
    }, phase.duration);
};

const pauseFlightPlan = () => {
    if (!flightPlanActive) {
        addFlightLog('システム', 'フライトプラン', 'フライトプランは実行されていません', 'warning');
        return;
    }
    
    flightPlanActive = false;
    addFlightLog('システム', 'フライトプラン一時停止', `フェーズ${currentFlightPhase + 1}で一時停止しました`, 'warning');
};

const completeFlightPlan = () => {
    flightPlanActive = false;
    addFlightLog('システム', 'フライトプラン完了', '東京タワー点検フライトプランが完了しました', 'success');
    showToast('フライトプランが完了しました', 'success');
};

const exportFlightPlan = () => {
    const planData = {
        name: '東京タワー点検フライトプラン',
        description: '東京タワー周辺の包括的点検フライトプラン',
        created: new Date().toISOString(),
        phases: flightPlan,
        totalDuration: flightPlan.reduce((sum, phase) => sum + phase.duration, 0)
    };
    
    const jsonContent = JSON.stringify(planData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokyo_tower_flight_plan_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addFlightLog('システム', 'フライトプランエクスポート', 'フライトプランをJSONファイルでエクスポートしました', 'success');
};

const importFlightPlan = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const planData = JSON.parse(e.target?.result as string);
                    // フライトプランの読み込み処理
                    addFlightLog('システム', 'フライトプランインポート', `${planData.name}をインポートしました`, 'success');
                    showToast('フライトプランをインポートしました', 'success');
                } catch (error) {
                    addFlightLog('エラー', 'フライトプランインポート', 'ファイルの読み込みに失敗しました', 'error');
                    showToast('フライトプランの読み込みに失敗しました', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
};

// 地図のクリックイベント
map.on('click', (e) => {
    if (polygonDrawingMode) {
        handlePolygonClick(e.lngLat);
    } else if (drawMode) {
        addObjectAtLocation(e.lngLat);
    }
});

// 地図の読み込み完了
map.on('load', () => {
    setupLayers();
    setupEventHandlers();
    updateStatus('地図読み込み完了 - 東京タワー周辺のドローン点検を開始してください');
    console.log('システム準備完了');
    
    // フライトログ初期化
    addFlightLog('システム', '初期化', '東京タワー点検システムが起動しました', 'success');
    addFlightLog('システム', '準備完了', 'フライトプランとリアルタイムログ機能が利用可能です', 'info');
    
    // Footerを初期表示状態にする（より確実な処理）
    setTimeout(() => {
        const flightLog = document.getElementById('flightLog') as HTMLElement;
        const toggleButton = document.getElementById('toggleLog') as HTMLButtonElement;
        
        if (flightLog && toggleButton) {
            // ログリストを表示状態に設定
            flightLog.classList.remove('hidden');
            toggleButton.textContent = 'ログ非表示';
            console.log('ログリストを初期表示状態に設定しました');
        } else {
            console.error('FlightLogまたはToggleボタンの初期化に失敗しました');
        }
    }, 100); // 少し遅延させて確実にDOMが準備されるようにする
});
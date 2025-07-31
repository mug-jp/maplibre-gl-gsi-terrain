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
    convertDroneObjectToUnified,
    convertUnifiedToDroneObject,
    createFlightMission,
    calculateMissionDistance,
    estimateMissionDuration,
    exportUnifiedFlightDataToCSV,
    exportUnifiedFlightDataToGeoJSON,
    exportFlightMissionToKML,
    parseUnifiedFlightDataCSV,
    parseUnifiedFlightDataGeoJSON,
    parseFlightMissionJSON,
    type Point3D, 
    type MeshVertex,
    type DroneObject,
    type UnifiedFlightData,
    type FlightMission,
    type FlightExecutionResult
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
            },
            'selected-object': {
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
let editMode = false;
let selectedObject: DroneObject | null = null;
let isDragging = false;
let dragStartPos: [number, number] | null = null;
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

// 動的フライトプラン管理
let currentFlightPlan: FlightPlanPhase[] = [];
let currentFlightPlanName = '';
let currentFlightPlanDescription = '';

interface FlightPlanPhase {
    phase: string;
    action: string;
    duration: number;
    position: [number, number, number];
}

interface FlightPlanData {
    name: string;
    description: string;
    created: string;
    phases: FlightPlanPhase[];
    totalDuration: number;
}

// デフォルトのフライトプラン定義（東京タワー）
const defaultFlightPlan: FlightPlanPhase[] = [
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

// 初期化時にデフォルトプランを設定
currentFlightPlan = defaultFlightPlan;
currentFlightPlanName = '東京タワー点検フライトプラン';
currentFlightPlanDescription = '東京タワー周辺の包括的点検フライトプラン';

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

    // 多角形レイヤー
    map.addLayer({
        id: 'polygon-fill-layer',
        type: 'fill',
        source: 'drone-objects',
        filter: ['==', ['get', 'type'], 'polygon'],
        paint: {
            'fill-color': '#ff6b6b',
            'fill-opacity': 0.3
        }
    });

    map.addLayer({
        id: 'polygon-stroke-layer',
        type: 'line',
        source: 'drone-objects',
        filter: ['==', ['get', 'type'], 'polygon'],
        paint: {
            'line-color': '#ff6b6b',
            'line-width': 2,
            'line-opacity': 0.8
        }
    });

    // ドローンオブジェクト（3D）
    map.addLayer({
        id: 'drone-objects-3d',
        type: 'circle',
        source: 'drone-objects',
        filter: ['!=', ['get', 'type'], 'polygon'],
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
        filter: ['!=', ['get', 'type'], 'polygon'],
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

    // 選択オブジェクトのハイライト表示
    map.addLayer({
        id: 'selected-object-highlight',
        type: 'fill',
        source: 'selected-object',
        paint: {
            'fill-color': '#00ff00',
            'fill-opacity': 0.2
        }
    });

    map.addLayer({
        id: 'selected-object-stroke',
        type: 'line',
        source: 'selected-object',
        paint: {
            'line-color': '#00ff00',
            'line-width': 4,
            'line-opacity': 0.8
        }
    });

    map.addLayer({
        id: 'selected-object-points',
        type: 'circle',
        source: 'selected-object',
        paint: {
            'circle-radius': 8,
            'circle-color': '#00ff00',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
        }
    });
};

// 表示更新
const updateDisplay = () => {
    // オブジェクト表示
    const features = loadedObjects.map(obj => {
        const extendedObj = obj as any; // 拡張プロパティアクセス用
        
        if (obj.type === 'polygon' && extendedObj.geometry) {
            // 多角形の場合は保存されたgeometryを使用
            const feature = {
                type: 'Feature' as const,
                geometry: extendedObj.geometry,
                properties: {
                    id: obj.id,
                    name: obj.name,
                    altitude: obj.altitude,
                    type: obj.type,
                    area: extendedObj.area || 0
                }
            };
            console.log('多角形フィーチャー作成:', feature);
            return feature;
        } else {
            // 点の場合は従来通り
            return {
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
            };
        }
    });

    console.log('updateDisplay: 全フィーチャー:', features);
    
    const geoJSONData = {
        type: 'FeatureCollection',
        features: features
    };
    
    console.log('drone-objectsソースに設定するデータ:', geoJSONData);
    
    (map.getSource('drone-objects') as maplibregl.GeoJSONSource)?.setData(geoJSONData);

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
    const polygonObject = {
        id: `polygon_${Date.now()}`,
        name: `検査エリア_${loadedObjects.filter(obj => obj.type === 'polygon').length + 1}`,
        longitude: currentPolygonPoints[0][0], // 中心点代表座標
        latitude: currentPolygonPoints[0][1],
        altitude: 0,
        type: 'polygon' as const,
        source: 'polygon_draw',
        geometry: {
            type: 'Polygon',
            coordinates: [closedPoints]
        },
        area: area
    } as DroneObject & { geometry: any, area: number };
    
    loadedObjects.push(polygonObject);
    console.log('多角形オブジェクトを追加:', polygonObject);
    console.log('現在のloadedObjects:', loadedObjects);
    
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

// オブジェクト選択機能
const selectObject = (lngLat: maplibregl.LngLat) => {
    const point = map.project(lngLat);
    const tolerance = 20; // クリック許容範囲（ピクセル）
    
    // 最も近いオブジェクトを探す
    let closestObject: DroneObject | null = null;
    let minDistance = Infinity;
    
    loadedObjects.forEach(obj => {
        const objPoint = map.project([obj.longitude, obj.latitude]);
        const distance = Math.sqrt(
            Math.pow(point.x - objPoint.x, 2) + 
            Math.pow(point.y - objPoint.y, 2)
        );
        
        if (distance < tolerance && distance < minDistance) {
            minDistance = distance;
            closestObject = obj;
        }
    });
    
    if (closestObject) {
        selectedObject = closestObject;
        updateSelectedObjectDisplay();
        showToast(`「${closestObject.name}」を選択しました`, 'info');
        return true;
    } else {
        deselectObject();
        return false;
    }
};

const deselectObject = () => {
    selectedObject = null;
    updateSelectedObjectDisplay();
};

const updateSelectedObjectDisplay = () => {
    if (!selectedObject) {
        (map.getSource('selected-object') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: []
        });
        return;
    }
    
    const features = [];
    
    if (selectedObject.type === 'polygon') {
        // 多角形の場合は形状を表示
        const polygonData = selectedObject as any; // 拡張プロパティアクセス用
        if (polygonData.geometry && polygonData.geometry.coordinates) {
            features.push({
                type: 'Feature' as const,
                geometry: polygonData.geometry,
                properties: {
                    id: selectedObject.id,
                    type: 'selected-polygon'
                }
            });
            
            // 各頂点も表示
            polygonData.geometry.coordinates[0].slice(0, -1).forEach((coord: [number, number], index: number) => {
                features.push({
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: coord
                    },
                    properties: {
                        id: selectedObject!.id,
                        type: 'selected-vertex',
                        vertexIndex: index
                    }
                });
            });
        }
    } else {
        // 点の場合
        features.push({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: [selectedObject.longitude, selectedObject.latitude]
            },
            properties: {
                id: selectedObject.id,
                type: 'selected-point'
            }
        });
    }
    
    (map.getSource('selected-object') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: features
    });
};

// マップ操作制御関数
const disableMapInteraction = () => {
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
};

const enableMapInteraction = () => {
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.dragRotate.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
};

// オブジェクト移動機能
const startDragObject = (lngLat: maplibregl.LngLat) => {
    if (!selectedObject) return false;
    
    isDragging = true;
    dragStartPos = [lngLat.lng, lngLat.lat];
    map.getCanvas().style.cursor = 'grabbing';
    
    // オブジェクトドラッグ中はマップ操作を無効化
    disableMapInteraction();
    
    return true;
};

const dragObject = (lngLat: maplibregl.LngLat) => {
    if (!isDragging || !selectedObject || !dragStartPos) return;
    
    const deltaLng = lngLat.lng - dragStartPos[0];
    const deltaLat = lngLat.lat - dragStartPos[1];
    
    if (selectedObject.type === 'polygon') {
        // 多角形の場合は全頂点を移動
        const polygonData = selectedObject as any;
        if (polygonData.geometry && polygonData.geometry.coordinates) {
            polygonData.geometry.coordinates[0] = polygonData.geometry.coordinates[0].map((coord: [number, number]) => [
                coord[0] + deltaLng,
                coord[1] + deltaLat
            ]);
        }
    }
    
    // オブジェクトの基準座標を更新
    selectedObject.longitude += deltaLng;
    selectedObject.latitude += deltaLat;
    
    dragStartPos = [lngLat.lng, lngLat.lat];
    updateDisplay();
    updateSelectedObjectDisplay();
};

const endDragObject = () => {
    if (isDragging && selectedObject) {
        isDragging = false;
        dragStartPos = null;
        map.getCanvas().style.cursor = editMode ? 'crosshair' : '';
        
        // マップ操作を再有効化
        enableMapInteraction();
        
        showToast(`「${selectedObject.name}」を移動しました`, 'success');
    }
};

// オブジェクト削除機能
const deleteSelectedObject = () => {
    if (!selectedObject) {
        showToast('削除するオブジェクトが選択されていません', 'warning');
        return;
    }
    
    const objectName = selectedObject.name;
    const confirmed = confirm(`「${objectName}」を削除しますか？`);
    
    if (confirmed) {
        loadedObjects = loadedObjects.filter(obj => obj.id !== selectedObject!.id);
        deselectObject();
        updateDisplay();
        showToast(`「${objectName}」を削除しました`, 'success');
    }
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
                polygonButton.textContent = '多角形作成';
            }
            resetPolygonDrawing();
        }
        
        const button = document.getElementById('toggleDrawMode');
        if (button) {
            button.textContent = drawMode ? 'ポイント作成停止' : 'ポイント作成';
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
            // 多角形描画停止時は描画中のデータのみクリア（完成した多角形は保持）
            resetPolygonDrawing();
        }
        
        const button = document.getElementById('togglePolygonMode');
        if (button) {
            button.textContent = polygonDrawingMode ? '多角形作成停止' : '多角形作成';
        }
        map.getCanvas().style.cursor = polygonDrawingMode ? 'crosshair' : '';
        updateStatus(polygonDrawingMode ? '多角形描画モード有効 - クリックして頂点を追加、始点をクリックして完成' : '多角形描画モード無効');
        showToast(polygonDrawingMode ? '多角形描画モードを有効にしました' : '多角形描画モードを無効にしました', 'info');
    });

    // 編集モード切り替え
    document.getElementById('toggleEditMode')?.addEventListener('click', () => {
        editMode = !editMode;
        
        if (editMode) {
            drawMode = false;
            polygonDrawingMode = false;
            const drawButton = document.getElementById('toggleDrawMode');
            const polygonButton = document.getElementById('togglePolygonMode');
            if (drawButton) drawButton.textContent = 'ポイント作成';
            if (polygonButton) polygonButton.textContent = '多角形作成';
            resetPolygonDrawing();
        } else {
            deselectObject();
        }
        
        const button = document.getElementById('toggleEditMode');
        if (button) {
            button.textContent = editMode ? 'オブジェクト編集停止' : 'オブジェクト編集';
        }
        map.getCanvas().style.cursor = editMode ? 'crosshair' : '';
        updateStatus(editMode ? '編集モード有効 - オブジェクトをクリックして選択、ドラッグで移動、Deleteキーで削除' : '編集モード無効');
        showToast(editMode ? '編集モードを有効にしました' : '編集モードを無効にしました', 'info');
    });

    // CSVインポート
    document.getElementById('importCSV')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    updateStatus('CSVファイル読み込み中...');
                    const csvContent = await file.text();
                    const importedObjects = parseDroneCSV(csvContent, file.name);
                    
                    if (importedObjects.length > 0) {
                        loadedObjects.push(...importedObjects);
                        updateDisplay();
                        updateStatus(`CSV読み込み完了: ${importedObjects.length}個のオブジェクト`);
                        showToast(`CSVから${importedObjects.length}個のオブジェクトをインポートしました`, 'success');
                        addFlightLog('データ管理', 'CSVインポート', `${file.name}から${importedObjects.length}個のオブジェクトを読み込み`, 'success');
                    } else {
                        showToast('CSVファイルからデータを読み込めませんでした', 'warning');
                        addFlightLog('データ管理', 'CSVインポート', 'CSVファイルの読み込みに失敗', 'warning');
                    }
                } catch (error) {
                    console.error('CSVインポートエラー:', error);
                    showToast('CSVファイルの読み込みに失敗しました', 'error');
                    addFlightLog('データ管理', 'CSVインポートエラー', `${file.name}の読み込みに失敗`, 'error');
                    updateStatus('CSVインポートエラー');
                }
            }
        };
        input.click();
    });

    // GeoJSONインポート
    document.getElementById('importGeoJSON')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.geojson,.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    updateStatus('GeoJSONファイル読み込み中...');
                    const jsonContent = await file.text();
                    const importedObjects = parseGeoJSON(jsonContent, file.name);
                    
                    if (importedObjects.length > 0) {
                        loadedObjects.push(...importedObjects);
                        updateDisplay();
                        updateStatus(`GeoJSON読み込み完了: ${importedObjects.length}個のオブジェクト`);
                        showToast(`GeoJSONから${importedObjects.length}個のオブジェクトをインポートしました`, 'success');
                        addFlightLog('データ管理', 'GeoJSONインポート', `${file.name}から${importedObjects.length}個のオブジェクトを読み込み`, 'success');
                    } else {
                        showToast('GeoJSONファイルからデータを読み込めませんでした', 'warning');
                        addFlightLog('データ管理', 'GeoJSONインポート', 'GeoJSONファイルの読み込みに失敗', 'warning');
                    }
                } catch (error) {
                    console.error('GeoJSONインポートエラー:', error);
                    showToast('GeoJSONファイルの読み込みに失敗しました', 'error');
                    addFlightLog('データ管理', 'GeoJSONインポートエラー', `${file.name}の読み込みに失敗`, 'error');
                    updateStatus('GeoJSONインポートエラー');
                }
            }
        };
        input.click();
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
        console.log('現在のFlightLog表示状態:', flightLog?.classList.contains('visible'));
        
        if (flightLog && toggleButton) {
            // ログリストの表示状態を判定
            const isCurrentlyVisible = flightLog.classList.contains('visible');
            
            console.log('現在の表示状態:', isCurrentlyVisible);
            
            if (isCurrentlyVisible) {
                // ログリストを非表示にする
                flightLog.classList.remove('visible');
                flightLog.classList.add('hidden');
                toggleButton.textContent = 'ログ表示';
                addFlightLog('システム', 'ログ表示切替', 'ログ表示を無効にしました', 'info');
                console.log('ログリストを非表示にしました');
            } else {
                // ログリストを表示にする
                flightLog.classList.remove('hidden');
                flightLog.classList.add('visible');
                toggleButton.textContent = 'ログ非表示';
                addFlightLog('システム', 'ログ表示切替', 'ログ表示を有効にしました', 'info');
                console.log('ログリストを表示にしました');
            }
        } else {
            console.error('FlightLogまたはToggleボタンが見つかりません');
        }
    });

    // UnifiedFlightDataインポート
    document.getElementById('importFlightData')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.json,.geojson';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    updateStatus('フライトデータ読み込み中...');
                    const content = await file.text();
                    let importedData: UnifiedFlightData[] = [];
                    
                    if (file.name.endsWith('.csv')) {
                        importedData = parseUnifiedFlightDataCSV(content, file.name);
                    } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
                        importedData = parseUnifiedFlightDataGeoJSON(content, file.name);
                    }
                    
                    if (importedData.length > 0) {
                        // UnifiedFlightDataをDroneObjectに変換して追加
                        const convertedObjects = importedData.map(data => convertUnifiedToDroneObject(data));
                        loadedObjects.push(...convertedObjects);
                        updateDisplay();
                        updateStatus(`フライトデータ読み込み完了: ${importedData.length}個のオブジェクト`);
                        showToast(`フライトデータから${importedData.length}個のオブジェクトをインポートしました`, 'success');
                        addFlightLog('データ管理', 'フライトデータインポート', `${file.name}から${importedData.length}個のオブジェクトを読み込み`, 'success');
                    } else {
                        showToast('フライトデータファイルからデータを読み込めませんでした', 'warning');
                        addFlightLog('データ管理', 'フライトデータインポート', 'ファイルの読み込みに失敗', 'warning');
                    }
                } catch (error) {
                    console.error('フライトデータインポートエラー:', error);
                    showToast('フライトデータファイルの読み込みに失敗しました', 'error');
                    addFlightLog('データ管理', 'フライトデータインポートエラー', `${file.name}の読み込みに失敗`, 'error');
                    updateStatus('フライトデータインポートエラー');
                }
            }
        };
        input.click();
    });

    // フライトミッションインポート
    document.getElementById('importMission')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    updateStatus('フライトミッション読み込み中...');
                    const content = await file.text();
                    const mission = parseFlightMissionJSON(content, file.name);
                    
                    if (mission && mission.waypoints.length > 0) {
                        // ミッションの各ウェイポイントをDroneObjectとして追加
                        const waypointObjects: DroneObject[] = mission.waypoints.map((waypoint, index) => ({
                            id: `mission_waypoint_${index + 1}`,
                            name: `ミッション_${mission.name}_WP${index + 1}`,
                            longitude: waypoint.position.longitude,
                            latitude: waypoint.position.latitude,
                            altitude: waypoint.position.altitude,
                            type: 'flight',
                            source: `mission_${file.name}`
                        }));
                        
                        loadedObjects.push(...waypointObjects);
                        updateDisplay();
                        updateStatus(`フライトミッション読み込み完了: ${mission.waypoints.length}個のウェイポイント`);
                        showToast(`ミッション「${mission.name}」から${mission.waypoints.length}個のウェイポイントをインポートしました`, 'success');
                        addFlightLog('データ管理', 'ミッションインポート', `${mission.name}: ${mission.waypoints.length}個のウェイポイント`, 'success');
                        
                        // 地図をミッション開始地点に移動
                        const firstWaypoint = mission.waypoints[0];
                        map.flyTo({
                            center: [firstWaypoint.position.longitude, firstWaypoint.position.latitude],
                            zoom: 16,
                            duration: 2000
                        });
                    } else {
                        showToast('フライトミッションファイルからデータを読み込めませんでした', 'warning');
                        addFlightLog('データ管理', 'ミッションインポート', 'ファイルの読み込みに失敗', 'warning');
                    }
                } catch (error) {
                    console.error('フライトミッションインポートエラー:', error);
                    showToast('フライトミッションファイルの読み込みに失敗しました', 'error');
                    addFlightLog('データ管理', 'ミッションインポートエラー', `${file.name}の読み込みに失敗`, 'error');
                    updateStatus('フライトミッションインポートエラー');
                }
            }
        };
        input.click();
    });

    // サンプルフライトデータ読み込み
    document.getElementById('loadSampleFlightData')?.addEventListener('click', async () => {
        try {
            updateStatus('サンプルフライトデータ読み込み中...');
            const response = await fetch('./data/sample-flight-data.csv');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const content = await response.text();
            const importedData = parseUnifiedFlightDataCSV(content, 'sample-flight-data.csv');
            
            if (importedData.length > 0) {
                const convertedObjects = importedData.map(data => convertUnifiedToDroneObject(data));
                loadedObjects.push(...convertedObjects);
                updateDisplay();
                updateStatus(`サンプルフライトデータ読み込み完了: ${importedData.length}個のオブジェクト`);
                showToast(`サンプルフライトデータから${importedData.length}個のオブジェクトを読み込みました`, 'success');
                addFlightLog('データ管理', 'サンプルフライトデータ', `${importedData.length}個のオブジェクトを読み込み`, 'success');
            } else {
                showToast('サンプルフライトデータの読み込みに失敗しました', 'error');
                addFlightLog('データ管理', 'サンプルフライトデータ', 'データの読み込みに失敗', 'error');
            }
        } catch (error) {
            console.error('サンプルフライトデータ読み込みエラー:', error);
            showToast('サンプルフライトデータの読み込みに失敗しました', 'error');
            addFlightLog('データ管理', 'サンプルフライトデータエラー', 'データの読み込みに失敗', 'error');
            updateStatus('サンプルフライトデータ読み込みエラー');
        }
    });

    // サンプル軌跡データ読み込み
    document.getElementById('loadSampleTrajectory')?.addEventListener('click', async () => {
        try {
            updateStatus('サンプル軌跡データ読み込み中...');
            const response = await fetch('./data/sample-trajectory-data.csv');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const content = await response.text();
            const importedData = parseUnifiedFlightDataCSV(content, 'sample-trajectory-data.csv');
            
            if (importedData.length > 0) {
                const trajectoryData = importedData
                    .filter(data => data.timestamp)
                    .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
                
                const convertedObjects = trajectoryData.map((data, index) => {
                    const obj = convertUnifiedToDroneObject(data);
                    obj.name = `軌跡点_${index + 1}`;
                    obj.type = 'flight';
                    return obj;
                });
                
                loadedObjects.push(...convertedObjects);
                updateDisplay();
                updateStatus(`サンプル軌跡データ読み込み完了: ${trajectoryData.length}個の軌跡点`);
                showToast(`サンプル軌跡データから${trajectoryData.length}個の軌跡点を読み込みました`, 'success');
                addFlightLog('データ管理', 'サンプル軌跡データ', `${trajectoryData.length}個の軌跡点を読み込み`, 'success');
                
                // 軌跡の開始地点に地図を移動
                if (trajectoryData.length > 0) {
                    const firstPoint = trajectoryData[0];
                    map.flyTo({
                        center: [firstPoint.position.longitude, firstPoint.position.latitude],
                        zoom: 16,
                        duration: 2000
                    });
                }
            } else {
                showToast('サンプル軌跡データの読み込みに失敗しました', 'error');
                addFlightLog('データ管理', 'サンプル軌跡データ', 'データの読み込みに失敗', 'error');
            }
        } catch (error) {
            console.error('サンプル軌跡データ読み込みエラー:', error);
            showToast('サンプル軌跡データの読み込みに失敗しました', 'error');
            addFlightLog('データ管理', 'サンプル軌跡データエラー', 'データの読み込みに失敗', 'error');
            updateStatus('サンプル軌跡データ読み込みエラー');
        }
    });

    // UnifiedFlightDataエクスポート
    document.getElementById('exportFlightData')?.addEventListener('click', () => {
        if (loadedObjects.length > 0) {
            // DroneObjectをUnifiedFlightDataに変換
            const unifiedData = loadedObjects.map(obj => convertDroneObjectToUnified(obj));
            
            // 複数形式での一括エクスポート
            try {
                // CSV形式
                const csvData = exportUnifiedFlightDataToCSV(unifiedData);
                downloadFile(csvData, 'unified_flight_data.csv', 'text/csv');
                
                // GeoJSON形式
                const geoJsonData = exportUnifiedFlightDataToGeoJSON(unifiedData);
                downloadFile(geoJsonData, 'unified_flight_data.geojson', 'application/geo+json');
                
                updateStatus('フライトデータエクスポート完了');
                showToast('フライトデータをCSVとGeoJSON形式でエクスポートしました', 'success');
                addFlightLog('データ管理', 'フライトデータエクスポート', `${unifiedData.length}個のオブジェクトをエクスポート`, 'success');
            } catch (error) {
                console.error('フライトデータエクスポートエラー:', error);
                showToast('フライトデータのエクスポートに失敗しました', 'error');
                addFlightLog('データ管理', 'フライトデータエクスポートエラー', 'エクスポートに失敗', 'error');
            }
        } else {
            showToast('エクスポートするフライトデータがありません', 'warning');
            addFlightLog('データ管理', 'フライトデータエクスポート', 'エクスポートするデータがありません', 'warning');
        }
    });

    // フライトミッションエクスポート
    document.getElementById('exportMission')?.addEventListener('click', () => {
        if (loadedObjects.length > 0) {
            // DroneObjectからフライトミッションを作成
            const flightTypeObjects = loadedObjects.filter(obj => obj.type === 'flight' || obj.type === 'drone');
            
            if (flightTypeObjects.length > 0) {
                try {
                    const mission = createFlightMission(
                        'Generated_Mission',
                        'システム生成フライトミッション',
                        flightTypeObjects.map(obj => convertDroneObjectToUnified(obj))
                    );
                    
                    // KML形式でエクスポート
                    const kmlData = exportFlightMissionToKML(mission);
                    downloadFile(kmlData, `flight_mission_${new Date().toISOString().slice(0, 10)}.kml`, 'application/vnd.google-earth.kml+xml');
                    
                    // JSON形式でもエクスポート
                    const jsonData = JSON.stringify(mission, null, 2);
                    downloadFile(jsonData, `flight_mission_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
                    
                    updateStatus('フライトミッションエクスポート完了');
                    showToast('フライトミッションをKMLとJSON形式でエクスポートしました', 'success');
                    addFlightLog('データ管理', 'ミッションエクスポート', `${mission.waypoints.length}個のウェイポイント`, 'success');
                } catch (error) {
                    console.error('フライトミッションエクスポートエラー:', error);
                    showToast('フライトミッションのエクスポートに失敗しました', 'error');
                    addFlightLog('データ管理', 'ミッションエクスポートエラー', 'エクスポートに失敗', 'error');
                }
            } else {
                showToast('フライト関連のオブジェクトがありません', 'warning');
                addFlightLog('データ管理', 'ミッションエクスポート', 'フライトオブジェクトが見つかりません', 'warning');
            }
        } else {
            showToast('エクスポートするデータがありません', 'warning');
            addFlightLog('データ管理', 'ミッションエクスポート', 'エクスポートするデータがありません', 'warning');
        }
    });

    // 軌跡データインポート
    document.getElementById('importTrajectory')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.json,.geojson';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    updateStatus('軌跡データ読み込み中...');
                    const content = await file.text();
                    let importedData: UnifiedFlightData[] = [];
                    
                    if (file.name.endsWith('.csv')) {
                        importedData = parseUnifiedFlightDataCSV(content, file.name);
                    } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
                        importedData = parseUnifiedFlightDataGeoJSON(content, file.name);
                    }
                    
                    // 軌跡データとして処理（時系列ソート）
                    const trajectoryData = importedData
                        .filter(data => data.timestamp)
                        .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
                    
                    if (trajectoryData.length > 0) {
                        const convertedObjects = trajectoryData.map((data, index) => {
                            const obj = convertUnifiedToDroneObject(data);
                            obj.name = `軌跡点_${index + 1}`;
                            obj.type = 'flight';
                            return obj;
                        });
                        
                        loadedObjects.push(...convertedObjects);
                        updateDisplay();
                        updateStatus(`軌跡データ読み込み完了: ${trajectoryData.length}個の軌跡点`);
                        showToast(`軌跡データから${trajectoryData.length}個の軌跡点をインポートしました`, 'success');
                        addFlightLog('データ管理', '軌跡データインポート', `${file.name}から${trajectoryData.length}個の軌跡点を読み込み`, 'success');
                        
                        // 軌跡の開始地点に地図を移動
                        if (trajectoryData.length > 0) {
                            const firstPoint = trajectoryData[0];
                            map.flyTo({
                                center: [firstPoint.position.longitude, firstPoint.position.latitude],
                                zoom: 16,
                                duration: 2000
                            });
                        }
                    } else {
                        showToast('軌跡データファイルからデータを読み込めませんでした', 'warning');
                        addFlightLog('データ管理', '軌跡データインポート', 'ファイルの読み込みに失敗', 'warning');
                    }
                } catch (error) {
                    console.error('軌跡データインポートエラー:', error);
                    showToast('軌跡データファイルの読み込みに失敗しました', 'error');
                    addFlightLog('データ管理', '軌跡データインポートエラー', `${file.name}の読み込みに失敗`, 'error');
                    updateStatus('軌跡データインポートエラー');
                }
            }
        };
        input.click();
    });

    // 軌跡データエクスポート
    document.getElementById('exportTrajectory')?.addEventListener('click', () => {
        if (loadedObjects.length > 0) {
            // フライト関連のオブジェクトのみを軌跡として処理
            const trajectoryObjects = loadedObjects.filter(obj => 
                obj.type === 'flight' || obj.type === 'drone'
            );
            
            if (trajectoryObjects.length > 0) {
                try {
                    // 軌跡データとしてタイムスタンプを付与
                    const trajectoryData = trajectoryObjects.map((obj, index) => {
                        const unified = convertDroneObjectToUnified(obj);
                        // タイムスタンプがない場合は順序に基づいて付与
                        if (!unified.timestamp) {
                            unified.timestamp = new Date(Date.now() + index * 10000).toISOString(); // 10秒間隔
                        }
                        unified.type = 'trajectory_point';
                        return unified;
                    });
                    
                    // CSV形式でエクスポート
                    const csvData = exportUnifiedFlightDataToCSV(trajectoryData);
                    downloadFile(csvData, 'flight_trajectory.csv', 'text/csv');
                    
                    // GeoJSON形式でもエクスポート
                    const geoJsonData = exportUnifiedFlightDataToGeoJSON(trajectoryData);
                    downloadFile(geoJsonData, 'flight_trajectory.geojson', 'application/geo+json');
                    
                    updateStatus('軌跡データエクスポート完了');
                    showToast('軌跡データをCSVとGeoJSON形式でエクスポートしました', 'success');
                    addFlightLog('データ管理', '軌跡データエクスポート', `${trajectoryData.length}個の軌跡点をエクスポート`, 'success');
                } catch (error) {
                    console.error('軌跡データエクスポートエラー:', error);
                    showToast('軌跡データのエクスポートに失敗しました', 'error');
                    addFlightLog('データ管理', '軌跡データエクスポートエラー', 'エクスポートに失敗', 'error');
                }
            } else {
                showToast('軌跡として出力できるデータがありません', 'warning');
                addFlightLog('データ管理', '軌跡データエクスポート', '軌跡データが見つかりません', 'warning');
            }
        } else {
            showToast('エクスポートするデータがありません', 'warning');
            addFlightLog('データ管理', '軌跡データエクスポート', 'エクスポートするデータがありません', 'warning');
        }
    });

    // 能登半島山間部データ読み込み
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            loadNotoCoastData();
        }
        // 富士山フライトプラン読み込み
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            loadFujiMountainFlightPlan();
        }
        // 大阪エリアフライトプラン読み込み
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            loadOsakaCastleFlightPlan();
        }
        // 札幌エリアフライトプラン読み込み
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            loadSapporoClockTowerFlightPlan();
        }
        // 東京タワーフライトプラン読み込み（デフォルトに戻す）
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            loadTokyoTowerFlightPlan();
        }
    });
};

// フライトプラン管理機能
const startFlightPlan = () => {
    if (flightPlanActive) {
        addFlightLog('システム', 'フライトプラン', 'フライトプランは既に実行中です', 'warning');
        return;
    }

    if (currentFlightPlan.length === 0) {
        addFlightLog('エラー', 'フライトプラン', '実行可能なフライトプランがありません', 'error');
        return;
    }

    flightPlanActive = true;
    currentFlightPhase = 0;
    
    addFlightLog('システム', 'フライトプラン開始', `${currentFlightPlanName}を開始します`, 'success');
    
    // ドローンオブジェクトを作成
    if (loadedObjects.length === 0) {
        const droneObject: DroneObject = {
            id: 'inspection-drone-1',
            name: `${currentFlightPlanName}ドローン`,
            longitude: currentFlightPlan[0].position[0],
            latitude: currentFlightPlan[0].position[1],
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
    if (!flightPlanActive || currentFlightPhase >= currentFlightPlan.length) {
        completeFlightPlan();
        return;
    }
    
    const phase = currentFlightPlan[currentFlightPhase];
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
    addFlightLog('システム', 'フライトプラン完了', `${currentFlightPlanName}が完了しました`, 'success');
    showToast('フライトプランが完了しました', 'success');
};

const exportFlightPlan = () => {
    const planData: FlightPlanData = {
        name: currentFlightPlanName,
        description: currentFlightPlanDescription,
        created: new Date().toISOString(),
        phases: currentFlightPlan,
        totalDuration: currentFlightPlan.reduce((sum, phase) => sum + phase.duration, 0)
    };
    
    const jsonContent = JSON.stringify(planData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFlightPlanName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
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
                    const planData: FlightPlanData = JSON.parse(e.target?.result as string);
                    
                    // フライトプランの検証
                    if (!planData.name || !planData.phases || !Array.isArray(planData.phases)) {
                        throw new Error('無効なフライトプランファイルです');
                    }
                    
                    // 現在のフライトプランを更新
                    currentFlightPlan = planData.phases;
                    currentFlightPlanName = planData.name;
                    currentFlightPlanDescription = planData.description || '';
                    
                    addFlightLog('システム', 'フライトプランインポート', `${planData.name}をインポートしました`, 'success');
                    showToast('フライトプランをインポートしました', 'success');
                    
                    // 地図をフライトプランの開始位置に移動
                    if (planData.phases.length > 0) {
                        const startPosition = planData.phases[0].position;
                        map.flyTo({
                            center: [startPosition[0], startPosition[1]],
                            zoom: 16,
                            duration: 2000
                        });
                    }
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

// エッフェル塔関連の関数・ショートカットは削除

// 富士山フライトプラン読み込み
const loadFujiMountainFlightPlan = async () => {
    try {
        const response = await fetch('./data/fuji-mountain-flight-plan.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const flightPlanData: FlightPlanData = await response.json();
        currentFlightPlan = flightPlanData.phases;
        currentFlightPlanName = flightPlanData.name;
        currentFlightPlanDescription = flightPlanData.description;
        
        addFlightLog('システム', '富士山フライトプラン', '富士山点検フライトプランを読み込みました', 'success');
        showToast('富士山フライトプランを読み込みました', 'success');
        
        // 地図を富士山の位置に移動
        map.flyTo({
            center: [138.7275, 35.3606],
            zoom: 14,
            duration: 2000
        });
    } catch (error) {
        console.error('富士山フライトプラン読み込みエラー:', error);
        addFlightLog('エラー', '富士山フライトプラン', 'フライトプランの読み込みに失敗しました', 'error');
        showToast('富士山フライトプランの読み込みに失敗しました', 'error');
    }
};

// 大阪エリアフライトプラン読み込み
const loadOsakaCastleFlightPlan = async () => {
    try {
        const response = await fetch('./data/osaka-castle-flight-plan.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const flightPlanData: FlightPlanData = await response.json();
        currentFlightPlan = flightPlanData.phases;
        currentFlightPlanName = flightPlanData.name;
        currentFlightPlanDescription = flightPlanData.description;
        
        addFlightLog('システム', '大阪エリアフライトプラン', '大阪エリア点検フライトプランを読み込みました', 'success');
        showToast('大阪エリアフライトプランを読み込みました', 'success');
        
        // 地図を大阪エリアの位置に移動
        map.flyTo({
            center: [135.5022, 34.6873],
            zoom: 16,
            duration: 2000
        });
    } catch (error) {
        console.error('大阪エリアフライトプラン読み込みエラー:', error);
        addFlightLog('エラー', '大阪エリアフライトプラン', 'フライトプランの読み込みに失敗しました', 'error');
        showToast('大阪エリアフライトプランの読み込みに失敗しました', 'error');
    }
};

// 札幌エリアフライトプラン読み込み
const loadSapporoClockTowerFlightPlan = async () => {
    try {
        const response = await fetch('./data/sapporo-clock-tower-flight-plan.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const flightPlanData: FlightPlanData = await response.json();
        currentFlightPlan = flightPlanData.phases;
        currentFlightPlanName = flightPlanData.name;
        currentFlightPlanDescription = flightPlanData.description;
        
        addFlightLog('システム', '札幌エリアフライトプラン', '札幌エリア点検フライトプランを読み込みました', 'success');
        showToast('札幌エリアフライトプランを読み込みました', 'success');
        
        // 地図を札幌エリアの位置に移動
        map.flyTo({
            center: [141.3515, 43.0594],
            zoom: 16,
            duration: 2000
        });
    } catch (error) {
        console.error('札幌エリアフライトプラン読み込みエラー:', error);
        addFlightLog('エラー', '札幌エリアフライトプラン', 'フライトプランの読み込みに失敗しました', 'error');
        showToast('札幌エリアフライトプランの読み込みに失敗しました', 'error');
    }
};

// 東京タワーフライトプラン読み込み（デフォルトに戻す）
const loadTokyoTowerFlightPlan = async () => {
    try {
        // デフォルトの東京タワーフライトプランを設定
        currentFlightPlan = defaultFlightPlan;
        currentFlightPlanName = '東京タワー点検フライトプラン';
        currentFlightPlanDescription = '東京タワー周辺の包括的点検フライトプラン';
        
        addFlightLog('システム', '東京タワーフライトプラン', '東京タワー点検フライトプランを読み込みました', 'success');
        showToast('東京タワーフライトプランを読み込みました', 'success');
        
        // 地図を東京タワーの位置に移動
        map.flyTo({
            center: [139.7454, 35.6586],
            zoom: 15,
            duration: 2000
        });
    } catch (error) {
        console.error('東京タワーフライトプラン読み込みエラー:', error);
        addFlightLog('エラー', '東京タワーフライトプラン', 'フライトプランの読み込みに失敗しました', 'error');
        showToast('東京タワーフライトプランの読み込みに失敗しました', 'error');
    }
};

// 能登半島山間部データ読み込み
const loadNotoCoastData = async () => {
    try {
        // 3Dポイントデータ読み込み
        const pointsResponse = await fetch('./data/noto-coast-3d-points.csv');
        if (!pointsResponse.ok) throw new Error(`HTTP error! status: ${pointsResponse.status}`);
        
        const pointsContent = await pointsResponse.text();
        const pointsBlob = new Blob([pointsContent], { type: 'text/csv' });
        const pointsFile = new File([pointsBlob], 'noto-coast-points.csv', { type: 'text/csv' });
        await importDataFromFile(pointsFile, map, 'points');
        
        // メッシュデータ読み込み
        const meshResponse = await fetch('./data/noto-coast-mesh.csv');
        if (!meshResponse.ok) throw new Error(`HTTP error! status: ${meshResponse.status}`);
        
        const meshContent = await meshResponse.text();
        const meshBlob = new Blob([meshContent], { type: 'text/csv' });
        const meshFile = new File([meshBlob], 'noto-coast-mesh.csv', { type: 'text/csv' });
        await importDataFromFile(meshFile, map, 'mesh');
        
        // ウェイポイントデータ読み込み
        const waypointsResponse = await fetch('./data/noto-coast-waypoints.csv');
        if (!waypointsResponse.ok) throw new Error(`HTTP error! status: ${waypointsResponse.status}`);
        
        const waypointsContent = await waypointsResponse.text();
        const waypointsBlob = new Blob([waypointsContent], { type: 'text/csv' });
        const waypointsFile = new File([waypointsBlob], 'noto-coast-waypoints.csv', { type: 'text/csv' });
        await importDataFromFile(waypointsFile, map, 'waypoints');
        
        // 能登半島用のフライトプランを設定
        currentFlightPlan = [
            { phase: '離陸', action: '輪島港から離陸開始', duration: 3000, position: [137.27, 37.495, 10] },
            { phase: '外側旋回1', action: '北防波堤へ移動・ホバリング', duration: 4000, position: [137.275, 37.498, 15] },
            { phase: '外側旋回2', action: '東防波堤へ移動・ホバリング', duration: 4000, position: [137.265, 37.497, 12] },
            { phase: '外側旋回3', action: '南防波堤へ移動・ホバリング', duration: 4000, position: [137.268, 37.492, 14] },
            { phase: '外側旋回4', action: '西防波堤へ移動・ホバリング', duration: 4000, position: [137.272, 37.493, 13] },
            { phase: '内側旋回1', action: '内側北東へ移動・詳細撮影', duration: 3000, position: [137.273, 37.496, 11] },
            { phase: '内側旋回2', action: '内側北西へ移動・詳細撮影', duration: 3000, position: [137.267, 37.496, 11] },
            { phase: '内側旋回3', action: '内側南西へ移動・詳細撮影', duration: 3000, position: [137.269, 37.494, 12] },
            { phase: '内側旋回4', action: '内側南東へ移動・詳細撮影', duration: 3000, position: [137.271, 37.494, 12] },
            { phase: '中心部撮影', action: '輪島港中心部で詳細撮影', duration: 5000, position: [137.27, 37.495, 20] },
            { phase: '着陸', action: '離陸地点に戻って着陸', duration: 3000, position: [137.27, 37.495, 0] }
        ];
        currentFlightPlanName = '能登半島山間部点検フライトプラン';
        currentFlightPlanDescription = '能登半島山間部の包括的点検フライトプラン';
        
        addFlightLog('システム', '能登半島山間部データ', '能登半島山間部の3Dデータを読み込みました', 'success');
        showToast('能登半島山間部データを読み込みました', 'success');
        
        // 地図を能登半島山間部の位置に移動
        map.flyTo({
            center: [137.27, 37.495],
            zoom: 16,
            duration: 2000
        });
    } catch (error) {
        console.error('能登半島山間部データ読み込みエラー:', error);
        addFlightLog('エラー', '能登半島山間部データ', '3Dデータの読み込みに失敗しました', 'error');
        showToast('能登半島山間部データの読み込みに失敗しました', 'error');
    }
};

// 地図のクリックイベント
map.on('click', (e) => {
    // ドラッグ直後のクリックイベントを無視
    if (isDragging) {
        return;
    }
    
    if (polygonDrawingMode) {
        handlePolygonClick(e.lngLat);
    } else if (drawMode) {
        addObjectAtLocation(e.lngLat);
    } else if (editMode) {
        const objectSelected = selectObject(e.lngLat);
        // オブジェクトが選択されなかった場合は選択解除
        if (!objectSelected) {
            deselectObject();
        }
    }
});

// マウスダウンイベント（ドラッグ開始）
map.on('mousedown', (e) => {
    if (editMode) {
        // クリック位置でオブジェクトを検出
        const point = map.project(e.lngLat);
        const tolerance = 20;
        
        let objectFound = false;
        loadedObjects.forEach(obj => {
            const objPoint = map.project([obj.longitude, obj.latitude]);
            const distance = Math.sqrt(
                Math.pow(point.x - objPoint.x, 2) + 
                Math.pow(point.y - objPoint.y, 2)
            );
            
            if (distance < tolerance) {
                objectFound = true;
                if (selectedObject && selectedObject.id === obj.id) {
                    // 既に選択されているオブジェクトをクリックした場合、ドラッグ開始
                    startDragObject(e.lngLat);
                    e.preventDefault();
                }
            }
        });
        
        // オブジェクトがない場所でのマウスダウンの場合は通常のマップ操作を許可
        if (!objectFound && isDragging) {
            endDragObject();
        }
    }
});

// マウス移動イベント（ドラッグ中）
map.on('mousemove', (e) => {
    if (editMode && isDragging) {
        e.preventDefault();
        dragObject(e.lngLat);
    }
});

// マウスアップイベント（ドラッグ終了）
map.on('mouseup', (e) => {
    if (editMode && isDragging) {
        e.preventDefault();
        endDragObject();
    }
});

// キーボードイベント（削除キー）
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editMode && selectedObject) {
            e.preventDefault();
            deleteSelectedObject();
        }
    }
    if (e.key === 'Escape') {
        if (editMode) {
            deselectObject();
        }
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
            flightLog.classList.add('visible');
            toggleButton.textContent = 'ログ非表示';
            console.log('ログリストを初期表示状態に設定しました');
        } else {
            console.error('FlightLogまたはToggleボタンの初期化に失敗しました');
        }
    }, 100); // 少し遅延させて確実にDOMが準備されるようにする
});
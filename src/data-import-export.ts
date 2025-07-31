import maplibregl from 'maplibre-gl';

// 統一されたフライトデータモデル
export interface UnifiedFlightData {
    // 基本識別情報
    id: string;
    name: string;
    type: 'waypoint' | 'trajectory_point' | 'object' | 'mission' | 'polygon' | 'area';
    source: string;
    
    // 地理空間情報（統一座標系）
    position: {
        longitude: number;
        latitude: number;
        altitude: number;          // 海抜高度 (MSL)
        relativeAltitude?: number; // 相対高度 (AGL)
    };
    
    // 時間情報
    timestamp?: string;            // ISO 8601形式
    duration?: number;             // 滞在時間（秒）
    
    // フライト関連情報
    flight?: {
        speed?: number;            // m/s
        heading?: number;          // 度（北を0として時計回り）
        action?: 'takeoff' | 'land' | 'hover' | 'move' | 'waypoint' | 'rtl' | 'photo' | 'video';
        waypointId?: number;
        sequenceNumber?: number;
    };
    
    // センサー・機体情報
    telemetry?: {
        batteryLevel?: number;     // 0-100%
        signalStrength?: number;   // dBm
        gpsAccuracy?: number;      // メートル
        temperature?: number;      // 摂氏
        humidity?: number;         // %
        windSpeed?: number;        // m/s
        windDirection?: number;    // 度
    };
    
    // 幾何学情報（多角形やエリアの場合）
    geometry?: {
        type: 'Point' | 'LineString' | 'Polygon';
        coordinates: number[][] | number[][][];
    };
    
    // メタデータ
    metadata?: {
        missionId?: string;
        operatorId?: string;
        aircraftModel?: string;
        aircraftSerial?: string;
        softwareVersion?: string;
        description?: string;
        tags?: string[];
    };
    
    // 拡張プロパティ
    properties?: Record<string, any>;
}

// 後方互換性のために既存のDroneObjectを維持
export interface DroneObject {
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    altitude: number;
    type: 'drone' | 'base' | 'sensor' | 'building' | 'weather' | 'manual' | 'flight' | 'polygon' | 'unknown';
    source: string;
    properties?: Record<string, any>;
}

// 3Dポイントデータの型定義（既存との互換性維持）
export interface Point3D {
    x: number;
    y: number;
    z: number;
    elevation: number;
    type?: string;
    description?: string;
    properties?: Record<string, any>;
}

// メッシュデータの型定義
export interface MeshVertex {
    x: number;
    y: number;
    z: number;
    mesh_id: number;
    vertex_id: number;
    elevation: number;
    slope?: number;
    aspect?: number;
    damage_level?: number;
    component_type?: string;
}

// ドローン飛行経路の型定義
export interface DroneWaypoint {
    x: number;
    y: number;
    z: number;
    elevation: number;
    waypoint_id: number;
    timestamp?: string;
    speed?: number;
    action?: string; // 'takeoff', 'land', 'hover', 'move'
    description?: string;
    properties?: Record<string, any>;
}

// ドローン飛行ログの型定義（後方互換）
export interface DroneFlightLog {
    x: number;
    y: number;
    z: number;
    elevation: number;
    timestamp: string;
    speed: number;
    battery_level?: number;
    signal_strength?: number;
    gps_accuracy?: number;
    action?: string;
    description?: string;
    properties?: Record<string, any>;
}

// 新しいミッション定義
export interface FlightMission {
    id: string;
    name: string;
    description?: string;
    created: string;               // ISO 8601
    modified?: string;             // ISO 8601
    
    // ミッション設定
    settings: {
        homePosition: {
            longitude: number;
            latitude: number;   
            altitude: number;
        };
        maxAltitude?: number;      // 最大高度制限
        maxDistance?: number;      // 最大距離制限
        returnToHomeAltitude?: number;
        emergencyAction?: 'rtl' | 'land' | 'hover';
        geofence?: {
            type: 'circle' | 'polygon';
            coordinates: number[][];
            enabled: boolean;
        };
    };
    
    // ウェイポイントリスト
    waypoints: UnifiedFlightData[];
    
    // ミッションメタデータ
    metadata: {
        operatorId?: string;
        aircraftModel?: string;
        totalDistance?: number;     // 計算された総距離
        estimatedDuration?: number; // 推定所要時間（秒）
        maxAltitude?: number;       // ミッション内最大高度
        tags?: string[];
        notes?: string;
    };
}

// フライト実行結果
export interface FlightExecutionResult {
    missionId: string;
    executionId: string;
    startTime: string;             // ISO 8601
    endTime?: string;              // ISO 8601
    status: 'planned' | 'in_progress' | 'completed' | 'aborted' | 'emergency';
    
    // 実行軌跡
    actualTrajectory: UnifiedFlightData[];
    
    // 実行統計
    statistics: {
        totalDistance: number;
        totalDuration: number;
        averageSpeed: number;
        maxAltitude: number;
        waypointsCompleted: number;
        waypointsTotal: number;
    };
    
    // エラーやイベント
    events: {
        timestamp: string;
        type: 'info' | 'warning' | 'error' | 'emergency';
        message: string;
        position?: {
            longitude: number;
            latitude: number;
            altitude: number;
        };
    }[];
}

// CSVデータのパース処理
export const parseCSVData = (csvContent: string): Point3D[] => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const data: Point3D[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 3) {
            const point: Point3D = {
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2]),
                elevation: parseFloat(values[3] || values[2]),
                type: values[4] || 'point',
                description: values[5] || '',
                properties: {}
            };
            
            // 追加のプロパティを設定
            if (headers.length > 6) {
                for (let j = 6; j < headers.length && j < values.length; j++) {
                    point.properties![headers[j]] = values[j];
                }
            }
            
            data.push(point);
        }
    }
    
    return data;
};

// ========================================
// 新しい統一データ変換関数
// ========================================

// DroneObjectからUnifiedFlightDataへの変換
export const convertDroneObjectToUnified = (droneObj: DroneObject): UnifiedFlightData => {
    const unified: UnifiedFlightData = {
        id: droneObj.id,
        name: droneObj.name,
        type: droneObj.type === 'flight' ? 'waypoint' : 'object',
        source: droneObj.source,
        position: {
            longitude: droneObj.longitude,
            latitude: droneObj.latitude,
            altitude: droneObj.altitude
        },
        properties: droneObj.properties
    };
    
    return unified;
};

// UnifiedFlightDataからDroneObjectへの変換（後方互換）
export const convertUnifiedToDroneObject = (unified: UnifiedFlightData): DroneObject => {
    return {
        id: unified.id,
        name: unified.name,
        longitude: unified.position.longitude,
        latitude: unified.position.latitude,
        altitude: unified.position.altitude,
        type: unified.type === 'waypoint' ? 'flight' : 'unknown',
        source: unified.source,
        properties: unified.properties
    };
};

// DroneWaypointからUnifiedFlightDataへの変換
export const convertWaypointToUnified = (waypoint: DroneWaypoint): UnifiedFlightData => {
    return {
        id: `waypoint_${waypoint.waypoint_id}`,
        name: `Waypoint ${waypoint.waypoint_id}`,
        type: 'waypoint',
        source: 'waypoint_conversion',
        position: {
            longitude: waypoint.x,
            latitude: waypoint.y,
            altitude: waypoint.z
        },
        timestamp: waypoint.timestamp,
        flight: {
            speed: waypoint.speed,
            action: waypoint.action as any,
            waypointId: waypoint.waypoint_id,
            sequenceNumber: waypoint.waypoint_id
        },
        properties: waypoint.properties
    };
};

// DroneFlightLogからUnifiedFlightDataへの変換
export const convertFlightLogToUnified = (log: DroneFlightLog): UnifiedFlightData => {
    return {
        id: `log_${Date.parse(log.timestamp)}`,
        name: `Flight Log ${log.timestamp}`,
        type: 'trajectory_point',
        source: 'flight_log_conversion',
        position: {
            longitude: log.x,
            latitude: log.y,
            altitude: log.z
        },
        timestamp: log.timestamp,
        flight: {
            speed: log.speed,
            action: log.action as any
        },
        telemetry: {
            batteryLevel: log.battery_level,
            signalStrength: log.signal_strength,
            gpsAccuracy: log.gps_accuracy
        },
        properties: log.properties
    };
};

// ミッション距離計算
export const calculateMissionDistance = (waypoints: UnifiedFlightData[]): number => {
    if (waypoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < waypoints.length; i++) {
        const prev = waypoints[i - 1].position;
        const curr = waypoints[i].position;
        
        // Haversine公式を使用して距離を計算
        const R = 6371000; // 地球の半径（メートル）
        const lat1 = prev.latitude * Math.PI / 180;
        const lat2 = curr.latitude * Math.PI / 180;
        const deltaLat = (curr.latitude - prev.latitude) * Math.PI / 180;
        const deltaLng = (curr.longitude - prev.longitude) * Math.PI / 180;
        
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const horizontalDistance = R * c;
        
        // 高度差も考慮
        const altitudeDiff = curr.altitude - prev.altitude;
        const distance3D = Math.sqrt(horizontalDistance * horizontalDistance + altitudeDiff * altitudeDiff);
        
        totalDistance += distance3D;
    }
    
    return totalDistance;
};

// ミッション時間推定
export const estimateMissionDuration = (waypoints: UnifiedFlightData[], defaultSpeed: number = 10): number => {
    const totalDistance = calculateMissionDistance(waypoints);
    let totalTime = 0;
    
    for (let i = 1; i < waypoints.length; i++) {
        const speed = waypoints[i].flight?.speed || defaultSpeed;
        const prevPos = waypoints[i - 1].position;
        const currPos = waypoints[i].position;
        
        // セグメント距離計算
        const R = 6371000;
        const lat1 = prevPos.latitude * Math.PI / 180;
        const lat2 = currPos.latitude * Math.PI / 180;
        const deltaLat = (currPos.latitude - prevPos.latitude) * Math.PI / 180;
        const deltaLng = (currPos.longitude - prevPos.longitude) * Math.PI / 180;
        
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const segmentDistance = R * c;
        
        // 移動時間 + 滞在時間
        const moveTime = segmentDistance / speed;
        const hoverTime = waypoints[i].duration || 0;
        totalTime += moveTime + hoverTime;
    }
    
    return totalTime;
};

// フライトミッションの作成
export const createFlightMission = (
    name: string,
    waypoints: UnifiedFlightData[],
    homePosition: { longitude: number; latitude: number; altitude: number },
    options?: Partial<FlightMission['settings']>
): FlightMission => {
    const now = new Date().toISOString();
    
    return {
        id: `mission_${Date.now()}`,
        name,
        created: now,
        settings: {
            homePosition,
            maxAltitude: 400,
            maxDistance: 1000,
            returnToHomeAltitude: 50,
            emergencyAction: 'rtl',
            ...options
        },
        waypoints,
        metadata: {
            totalDistance: calculateMissionDistance(waypoints),
            estimatedDuration: estimateMissionDuration(waypoints),
            maxAltitude: Math.max(...waypoints.map(w => w.position.altitude))
        }
    };
};

// メッシュデータのパース処理
export const parseMeshData = (csvContent: string): MeshVertex[] => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const data: MeshVertex[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 6) {
            const vertex: MeshVertex = {
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2]),
                mesh_id: parseInt(values[3]),
                vertex_id: parseInt(values[4]),
                elevation: parseFloat(values[5]),
                slope: values[6] ? parseFloat(values[6]) : undefined,
                aspect: values[7] ? parseFloat(values[7]) : undefined
            };
            
            data.push(vertex);
        }
    }
    
    return data;
};

// ドローン飛行経路データのパース処理
export const parseDroneWaypointData = (csvContent: string): DroneWaypoint[] => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const data: DroneWaypoint[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 6) {
            const waypoint: DroneWaypoint = {
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2]),
                elevation: parseFloat(values[3]),
                waypoint_id: parseInt(values[4]),
                timestamp: values[5] || undefined,
                speed: values[6] ? parseFloat(values[6]) : undefined,
                action: values[7] || undefined,
                description: values[8] || undefined,
                properties: {}
            };
            
            // 追加のプロパティを設定
            if (headers.length > 9) {
                for (let j = 9; j < headers.length && j < values.length; j++) {
                    waypoint.properties![headers[j]] = values[j];
                }
            }
            
            data.push(waypoint);
        }
    }
    
    return data;
};

// ドローン飛行ログデータのパース処理
export const parseDroneFlightLogData = (csvContent: string): DroneFlightLog[] => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const data: DroneFlightLog[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 6) {
            const log: DroneFlightLog = {
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2]),
                elevation: parseFloat(values[3]),
                timestamp: values[4],
                speed: parseFloat(values[5]),
                battery_level: values[6] ? parseFloat(values[6]) : undefined,
                signal_strength: values[7] ? parseFloat(values[7]) : undefined,
                gps_accuracy: values[8] ? parseFloat(values[8]) : undefined,
                action: values[9] || undefined,
                description: values[10] || undefined,
                properties: {}
            };
            
            // 追加のプロパティを設定
            if (headers.length > 11) {
                for (let j = 11; j < headers.length && j < values.length; j++) {
                    log.properties![headers[j]] = values[j];
                }
            }
            
            data.push(log);
        }
    }
    
    return data;
};

// 建物点検データのパース処理
export const parseBuildingInspectionData = (csvContent: string): Point3D[] => {
    console.log('建物点検データパース開始');
    console.log('CSV内容（最初の500文字）:', csvContent.substring(0, 500));
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    console.log('CSV行数:', lines.length);
    
    if (lines.length < 2) {
        console.error('CSVデータが不足しています');
        throw new Error('建物点検データの形式が正しくありません');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    console.log('ヘッダー:', headers);
    
    const data: Point3D[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length < 6) {
                console.warn(`行 ${i} のデータが不完全です:`, values);
                continue;
            }
            
            const point: Point3D = {
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2]),
                elevation: parseFloat(values[3]),
                type: values[4],
                description: values[5],
                properties: {
                    damage_level: values[6] ? parseInt(values[6]) : 0,
                    component_type: values[7] || 'unknown',
                    inspection_date: values[8] || undefined
                }
            };
            
            if (isNaN(point.x) || isNaN(point.y) || isNaN(point.z)) {
                console.warn(`行 ${i} の座標データが無効です:`, values);
                continue;
            }
            
            data.push(point);
        } catch (error) {
            console.error(`行 ${i} のパースエラー:`, error, lines[i]);
        }
    }
    
    console.log('パース完了:', data.length, '個のポイント');
    console.log('最初の3つのポイント:', data.slice(0, 3));
    
    return data;
};

// 建物点検メッシュデータのパース処理
export const parseBuildingInspectionMeshData = (csvContent: string): MeshVertex[] => {
    console.log('建物点検メッシュデータパース開始');
    console.log('CSV内容（最初の500文字）:', csvContent.substring(0, 500));
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    console.log('CSV行数:', lines.length);
    
    if (lines.length < 2) {
        console.error('CSVデータが不足しています');
        throw new Error('建物点検メッシュデータの形式が正しくありません');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    console.log('ヘッダー:', headers);
    
    const data: MeshVertex[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length < 6) {
                console.warn(`行 ${i} のデータが不完全です:`, values);
                continue;
            }
            
            const vertex: MeshVertex = {
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2]),
                mesh_id: parseInt(values[3]),
                vertex_id: parseInt(values[4]),
                elevation: parseFloat(values[5]),
                slope: values[6] ? parseFloat(values[6]) : undefined,
                aspect: values[7] ? parseFloat(values[7]) : undefined,
                damage_level: values[8] ? parseInt(values[8]) : 0,
                component_type: values[9] || 'unknown'
            };
            
            if (isNaN(vertex.x) || isNaN(vertex.y) || isNaN(vertex.z)) {
                console.warn(`行 ${i} の座標データが無効です:`, values);
                continue;
            }
            
            data.push(vertex);
        } catch (error) {
            console.error(`行 ${i} のパースエラー:`, error, lines[i]);
        }
    }
    
    console.log('パース完了:', data.length, '個の頂点');
    console.log('最初の3つの頂点:', data.slice(0, 3));
    
    return data;
};

// メッシュデータを三角形に変換
export const convertMeshToTriangles = (meshData: MeshVertex[]): number[][][] => {
    const triangles: number[][][] = [];
    const meshGroups = new Map<number, MeshVertex[]>();
    
    // メッシュIDでグループ化
    meshData.forEach(vertex => {
        if (!meshGroups.has(vertex.mesh_id)) {
            meshGroups.set(vertex.mesh_id, []);
        }
        meshGroups.get(vertex.mesh_id)!.push(vertex);
    });
    
    // 各メッシュを三角形に変換
    meshGroups.forEach((vertices, meshId) => {
        // 5x5のグリッドを想定（25個の頂点）
        if (vertices.length === 25) {
            // 三角形の生成（4x4のグリッドから三角形を作成）
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    const topLeft = vertices[row * 5 + col];
                    const topRight = vertices[row * 5 + col + 1];
                    const bottomLeft = vertices[(row + 1) * 5 + col];
                    const bottomRight = vertices[(row + 1) * 5 + col + 1];
                    
                    // 2つの三角形を作成
                    triangles.push([
                        [topLeft.x, topLeft.y, topLeft.z],
                        [topRight.x, topRight.y, topRight.z],
                        [bottomLeft.x, bottomLeft.y, bottomLeft.z]
                    ]);
                    
                    triangles.push([
                        [topRight.x, topRight.y, topRight.z],
                        [bottomRight.x, bottomRight.y, bottomRight.z],
                        [bottomLeft.x, bottomLeft.y, bottomLeft.z]
                    ]);
                }
            }
        }
    });
    
    return triangles;
};

// 3Dポイントデータの描画
export const add3DPoints = (map: maplibregl.Map, points: Point3D[], sourceId: string = '3d-points') => {
    console.log('3Dポイントデータの描画開始:', points.length, '個のポイント');
    console.log('最初のポイント:', points[0]);
    
    const features = points.map(point => ({
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [point.x, point.y] // MapLibreでは2D座標を使用
        },
        properties: {
            elevation: point.elevation,
            z: point.z, // 3D座標をプロパティとして保存
            type: point.type,
            description: point.description,
            damage_level: point.properties?.damage_level || 0,
            ...point.properties
        }
    }));

    console.log('作成されたフィーチャー:', features.slice(0, 3)); // 最初の3つをログ出力

    // 既存のソースがあれば削除
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }

    // 既存のレイヤーがあれば削除
    const layerId = `${sourceId}-layer`;
    if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
    }

    try {
        console.log('ソースを追加中:', sourceId);
        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features
            }
        });

        console.log('レイヤーを追加中:', layerId);
        map.addLayer({
            id: layerId,
            type: 'circle',
            source: sourceId,
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 8,
                    15, 15,
                    20, 25
                ],
                'circle-color': [
                    'match',
                    ['get', 'damage_level'],
                    0, '#00ff00', // 健全（緑）
                    1, '#ffff00', // 軽微（黄）
                    2, '#ffaa00', // 軽度（オレンジ）
                    3, '#ff6600', // 中度（赤オレンジ）
                    4, '#ff0000', // 重度（赤）
                    5, '#990000', // 危険（濃赤）
                    '#ff4444' // デフォルト（赤）
                ],
                'circle-opacity': 0.9,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff'
            }
        });

        console.log('3Dポイントレイヤーが正常に追加されました');
        
        // 地図の中心をデータの中心に移動
        if (points.length > 0) {
            const centerLng = points.reduce((sum, p) => sum + p.x, 0) / points.length;
            const centerLat = points.reduce((sum, p) => sum + p.y, 0) / points.length;
            console.log('地図中心移動:', [centerLng, centerLat]);
            map.flyTo({
                center: [centerLng, centerLat],
                zoom: 16,
                duration: 2000
            });
        }
    } catch (error) {
        console.error('3Dポイントレイヤーの追加に失敗:', error);
        throw error;
    }
};

// 3Dメッシュデータの描画
export const add3DMesh = (map: maplibregl.Map, meshData: MeshVertex[], sourceId: string = '3d-mesh') => {
    console.log('3Dメッシュデータの描画開始:', meshData.length, '個の頂点');
    
    const triangles = convertMeshToTriangles(meshData);
    console.log('生成された三角形:', triangles.length, '個');
    
    const features = triangles.map((triangle, index) => ({
        type: 'Feature' as const,
        geometry: {
            type: 'Polygon' as const,
            coordinates: [triangle.map(coord => [coord[0], coord[1]])] // 2D座標に変換
        },
        properties: {
            id: index,
            elevation: triangle.reduce((sum, coord) => sum + coord[2], 0) / 3,
            z: triangle.reduce((sum, coord) => sum + coord[2], 0) / 3
        }
    }));

    console.log('作成されたメッシュフィーチャー:', features.slice(0, 2)); // 最初の2つをログ出力

    // 既存のソースがあれば削除
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }

    // 既存のレイヤーがあれば削除
    const layerId = `${sourceId}-layer`;
    if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
    }

    try {
        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features
            }
        });

        map.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
                'fill-color': [
                    'match',
                    ['get', 'damage_level'],
                    0, '#00ff00', // 健全（緑）
                    1, '#ffff00', // 軽微（黄）
                    2, '#ffaa00', // 軽度（オレンジ）
                    3, '#ff6600', // 中度（赤オレンジ）
                    4, '#ff0000', // 重度（赤）
                    5, '#990000', // 危険（濃赤）
                    '#ff4444' // デフォルト（赤）
                ],
                'fill-opacity': 0.7,
                'fill-outline-color': '#ffffff'
            }
        });

        console.log('3Dメッシュレイヤーが正常に追加されました');
        
        // 地図の中心をデータの中心に移動
        if (meshData.length > 0) {
            const centerLng = meshData.reduce((sum, p) => sum + p.x, 0) / meshData.length;
            const centerLat = meshData.reduce((sum, p) => sum + p.y, 0) / meshData.length;
            map.flyTo({
                center: [centerLng, centerLat],
                zoom: 16,
                duration: 2000
            });
        }
    } catch (error) {
        console.error('3Dメッシュレイヤーの追加に失敗:', error);
        throw error;
    }
};

// ドローン飛行経路の描画
export const addDroneWaypoints = (map: maplibregl.Map, waypoints: DroneWaypoint[], sourceId: string = 'drone-waypoints') => {
    console.log('ドローン飛行経路の描画開始:', waypoints.length, '個のウェイポイント');
    
    const features = waypoints.map(waypoint => ({
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [waypoint.x, waypoint.y]
        },
        properties: {
            elevation: waypoint.elevation,
            z: waypoint.z,
            waypoint_id: waypoint.waypoint_id,
            timestamp: waypoint.timestamp,
            speed: waypoint.speed,
            action: waypoint.action,
            description: waypoint.description,
            ...waypoint.properties
        }
    }));

    // 飛行経路の線を描画
    const lineFeatures = waypoints.length > 1 ? [{
        type: 'Feature' as const,
        geometry: {
            type: 'LineString' as const,
            coordinates: waypoints.map(wp => [wp.x, wp.y])
        },
        properties: {
            type: 'flight-path',
            waypoint_count: waypoints.length
        }
    }] : [];

    console.log('作成されたウェイポイントフィーチャー:', features.slice(0, 3));

    // 既存のソースがあれば削除
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }

    // 既存のレイヤーがあれば削除
    const waypointLayerId = `${sourceId}-waypoints-layer`;
    const pathLayerId = `${sourceId}-path-layer`;
    if (map.getLayer(waypointLayerId)) {
        map.removeLayer(waypointLayerId);
    }
    if (map.getLayer(pathLayerId)) {
        map.removeLayer(pathLayerId);
    }

    try {
        // ウェイポイントのソースとレイヤー
        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features
            }
        });

        map.addLayer({
            id: waypointLayerId,
            type: 'circle',
            source: sourceId,
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 6,
                    15, 12,
                    20, 20
                ],
                'circle-color': [
                    'match',
                    ['get', 'action'],
                    'takeoff', '#00ff00',
                    'land', '#ff0000',
                    'hover', '#ffff00',
                    '#007cba'
                ],
                'circle-opacity': 0.9,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        // 飛行経路の線を描画
        if (lineFeatures.length > 0) {
            map.addSource(`${sourceId}-path`, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: lineFeatures
                }
            });

            map.addLayer({
                id: pathLayerId,
                type: 'line',
                source: `${sourceId}-path`,
                paint: {
                    'line-color': '#ff6b35',
                    'line-width': 3,
                    'line-opacity': 0.8
                }
            });
        }

        console.log('ドローン飛行経路レイヤーが正常に追加されました');
        
        // 地図の中心をデータの中心に移動
        if (waypoints.length > 0) {
            const centerLng = waypoints.reduce((sum, p) => sum + p.x, 0) / waypoints.length;
            const centerLat = waypoints.reduce((sum, p) => sum + p.y, 0) / waypoints.length;
            map.flyTo({
                center: [centerLng, centerLat],
                zoom: 15,
                duration: 2000
            });
        }
    } catch (error) {
        console.error('ドローン飛行経路レイヤーの追加に失敗:', error);
        throw error;
    }
};

// ドローン飛行ログの描画
export const addDroneFlightLog = (map: maplibregl.Map, logs: DroneFlightLog[], sourceId: string = 'drone-flight-log') => {
    console.log('ドローン飛行ログの描画開始:', logs.length, '個のログエントリ');
    
    const features = logs.map(log => ({
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [log.x, log.y]
        },
        properties: {
            elevation: log.elevation,
            z: log.z,
            timestamp: log.timestamp,
            speed: log.speed,
            battery_level: log.battery_level,
            signal_strength: log.signal_strength,
            gps_accuracy: log.gps_accuracy,
            action: log.action,
            description: log.description,
            ...log.properties
        }
    }));

    // 飛行軌跡の線を描画
    const lineFeatures = logs.length > 1 ? [{
        type: 'Feature' as const,
        geometry: {
            type: 'LineString' as const,
            coordinates: logs.map(log => [log.x, log.y])
        },
        properties: {
            type: 'flight-trajectory',
            log_count: logs.length
        }
    }] : [];

    console.log('作成された飛行ログフィーチャー:', features.slice(0, 3));

    // 既存のソースがあれば削除
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }

    // 既存のレイヤーがあれば削除
    const logLayerId = `${sourceId}-points-layer`;
    const trajectoryLayerId = `${sourceId}-trajectory-layer`;
    if (map.getLayer(logLayerId)) {
        map.removeLayer(logLayerId);
    }
    if (map.getLayer(trajectoryLayerId)) {
        map.removeLayer(trajectoryLayerId);
    }

    try {
        // ログポイントのソースとレイヤー
        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features
            }
        });

        map.addLayer({
            id: logLayerId,
            type: 'circle',
            source: sourceId,
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 3,
                    15, 6,
                    20, 10
                ],
                'circle-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'speed'],
                    0, '#00ff00',
                    10, '#ffff00',
                    20, '#ff0000'
                ],
                'circle-opacity': 0.7,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
            }
        });

        // 飛行軌跡の線を描画
        if (lineFeatures.length > 0) {
            map.addSource(`${sourceId}-trajectory`, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: lineFeatures
                }
            });

            map.addLayer({
                id: trajectoryLayerId,
                type: 'line',
                source: `${sourceId}-trajectory`,
                paint: {
                    'line-color': '#00ff00',
                    'line-width': 2,
                    'line-opacity': 0.6
                }
            });
        }

        console.log('ドローン飛行ログレイヤーが正常に追加されました');
        
        // 地図の中心をデータの中心に移動
        if (logs.length > 0) {
            const centerLng = logs.reduce((sum, p) => sum + p.x, 0) / logs.length;
            const centerLat = logs.reduce((sum, p) => sum + p.y, 0) / logs.length;
            map.flyTo({
                center: [centerLng, centerLat],
                zoom: 15,
                duration: 2000
            });
        }
    } catch (error) {
        console.error('ドローン飛行ログレイヤーの追加に失敗:', error);
        throw error;
    }
};

// ファイルからデータをインポート
export const importDataFromFile = async (
    file: File, 
    map: maplibregl.Map,
    type: 'points' | 'mesh' | 'waypoints' | 'flight-log' | 'building-inspection' | 'building-inspection-mesh' = 'points'
): Promise<void> => {
    console.log('ファイルインポート開始:', file.name, 'タイプ:', type);
    
    const content = await file.text();
    console.log('ファイル内容の最初の100文字:', content.substring(0, 100));
    
    switch (type) {
        case 'points':
            const pointData = parseCSVData(content);
            console.log('パースされたポイントデータ:', pointData.length, '個');
            console.log('最初の3つのポイント:', pointData.slice(0, 3));
            add3DPoints(map, pointData);
            break;
            
        case 'mesh':
            const meshData = parseMeshData(content);
            console.log('パースされたメッシュデータ:', meshData.length, '個');
            console.log('最初の3つの頂点:', meshData.slice(0, 3));
            add3DMesh(map, meshData);
            break;
            
        case 'waypoints':
            const waypointData = parseDroneWaypointData(content);
            console.log('パースされたウェイポイントデータ:', waypointData.length, '個');
            console.log('最初の3つのウェイポイント:', waypointData.slice(0, 3));
            addDroneWaypoints(map, waypointData);
            break;
            
        case 'flight-log':
            const flightLogData = parseDroneFlightLogData(content);
            console.log('パースされた飛行ログデータ:', flightLogData.length, '個');
            console.log('最初の3つのログエントリ:', flightLogData.slice(0, 3));
            addDroneFlightLog(map, flightLogData);
            break;
            
        case 'building-inspection':
            const buildingPointData = parseBuildingInspectionData(content);
            console.log('パースされた建物点検データ:', buildingPointData.length, '個');
            console.log('最初の3つの建物点検ポイント:', buildingPointData.slice(0, 3));
            add3DPoints(map, buildingPointData);
            break;
            
        case 'building-inspection-mesh':
            const buildingMeshData = parseBuildingInspectionMeshData(content);
            console.log('パースされた建物点検メッシュデータ:', buildingMeshData.length, '個');
            console.log('最初の3つの建物点検頂点:', buildingMeshData.slice(0, 3));
            add3DMesh(map, buildingMeshData);
            break;
            
        default:
            throw new Error(`未対応のデータタイプ: ${type}`);
    }
};

// 現在表示されているデータを取得
export const getCurrentDisplayData = (map: maplibregl.Map): { points: Point3D[], meshes: MeshVertex[] } => {
    const points: Point3D[] = [];
    const meshes: MeshVertex[] = [];
    
    // 3Dポイントデータを取得
    const pointsSource = map.getSource('3d-points') as maplibregl.GeoJSONSource;
    if (pointsSource) {
        const pointsData = pointsSource.serialize();
        const geoJsonData = typeof pointsData.data === 'string' ? JSON.parse(pointsData.data) : pointsData.data;
        if (geoJsonData && geoJsonData.features) {
            geoJsonData.features.forEach((feature: any) => {
                if (feature.geometry.type === 'Point') {
                    points.push({
                        x: feature.geometry.coordinates[0],
                        y: feature.geometry.coordinates[1],
                        z: feature.properties.z || feature.properties.elevation,
                        elevation: feature.properties.elevation,
                        type: feature.properties.type,
                        description: feature.properties.description,
                        properties: feature.properties
                    });
                }
            });
        }
    }
    
    // 3Dメッシュデータを取得
    const meshSource = map.getSource('3d-mesh') as maplibregl.GeoJSONSource;
    if (meshSource) {
        const meshData = meshSource.serialize();
        const geoJsonData = typeof meshData.data === 'string' ? JSON.parse(meshData.data) : meshData.data;
        if (geoJsonData && geoJsonData.features) {
            // メッシュデータは三角形の頂点として保存されているため、
            // 元のメッシュ頂点データを再構築
            const vertexMap = new Map<string, MeshVertex>();
            
            geoJsonData.features.forEach((feature: any, index: number) => {
                if (feature.geometry.type === 'Polygon') {
                    feature.geometry.coordinates[0].forEach((coord: number[], vertexIndex: number) => {
                        const key = `${coord[0]}-${coord[1]}`;
                        if (!vertexMap.has(key)) {
                            vertexMap.set(key, {
                                x: coord[0],
                                y: coord[1],
                                z: feature.properties.elevation,
                                mesh_id: Math.floor(index / 2), // 2つの三角形で1つのメッシュ
                                vertex_id: vertexIndex,
                                elevation: feature.properties.elevation
                            });
                        }
                    });
                }
            });
            
            meshes.push(...vertexMap.values());
        }
    }
    
    return { points, meshes };
};

// データのエクスポート
export const exportDataToCSV = (map: maplibregl.Map, type: 'points' | 'mesh' | 'all' = 'all'): string => {
    const { points, meshes } = getCurrentDisplayData(map);
    
    if (type === 'points' || type === 'all') {
        if (points.length > 0) {
            const headers = Object.keys(points[0]);
            const csvLines = [headers.join(',')];
            
            points.forEach(item => {
                const values = headers.map(header => {
                    const value = (item as any)[header];
                    return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
                });
                csvLines.push(values.join(','));
            });
            
            return csvLines.join('\n');
        }
    }
    
    if (type === 'mesh' || type === 'all') {
        if (meshes.length > 0) {
            const headers = Object.keys(meshes[0]);
            const csvLines = [headers.join(',')];
            
            meshes.forEach(item => {
                const values = headers.map(header => {
                    const value = (item as any)[header];
                    return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
                });
                csvLines.push(values.join(','));
            });
            
            return csvLines.join('\n');
        }
    }
    
    return '';
};

// データのクリア
export const clearData = (map: maplibregl.Map, sourceIds: string[] = ['3d-points', '3d-mesh']) => {
    sourceIds.forEach(sourceId => {
        const layerId = `${sourceId}-layer`;
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
        }
    });
};

// ドローンデータのCSV解析
export const parseDroneCSV = (csvContent: string, filename: string): DroneObject[] => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data: DroneObject[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const obj: any = {};
        
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        
        if (obj.longitude && obj.latitude) {
            const droneObject: DroneObject = {
                id: obj.id || `${filename}_${i}_${Date.now()}`,
                name: obj.name || `オブジェクト${i}`,
                longitude: parseFloat(obj.longitude),
                latitude: parseFloat(obj.latitude),
                altitude: parseFloat(obj.altitude || obj.height || obj.elevation) || 50,
                type: (obj.type as DroneObject['type']) || 'unknown',
                source: filename,
                properties: {}
            };
            
            // 追加プロパティを設定
            Object.keys(obj).forEach(key => {
                if (!['id', 'name', 'longitude', 'latitude', 'altitude', 'height', 'elevation', 'type'].includes(key)) {
                    droneObject.properties![key] = obj[key];
                }
            });
            
            data.push(droneObject);
        }
    }
    
    return data;
};

// GeoJSONデータの解析
export const parseGeoJSON = (jsonContent: string, filename: string): DroneObject[] => {
    const data = JSON.parse(jsonContent);
    const objects: DroneObject[] = [];
    
    if (data.type === 'FeatureCollection' && data.features) {
        data.features.forEach((feature: any, index: number) => {
            if (feature.geometry && feature.geometry.type === 'Point') {
                const coords = feature.geometry.coordinates;
                const props = feature.properties || {};
                
                const droneObject: DroneObject = {
                    id: props.id || `${filename}_${index}_${Date.now()}`,
                    name: props.name || `オブジェクト${index + 1}`,
                    longitude: coords[0],
                    latitude: coords[1],
                    altitude: coords[2] || props.altitude || props.height || props.elevation || 50,
                    type: props.type || 'unknown',
                    source: filename,
                    properties: { ...props }
                };
                
                // 不要なプロパティを削除
                delete droneObject.properties!.id;
                delete droneObject.properties!.name;
                delete droneObject.properties!.altitude;
                delete droneObject.properties!.height;
                delete droneObject.properties!.elevation;
                delete droneObject.properties!.type;
                
                objects.push(droneObject);
            }
        });
    } else if (Array.isArray(data)) {
        // JSONの配列形式
        data.forEach((item: any, index: number) => {
            if (item.longitude && item.latitude) {
                const droneObject: DroneObject = {
                    id: item.id || `${filename}_${index}_${Date.now()}`,
                    name: item.name || `オブジェクト${index + 1}`,
                    longitude: parseFloat(item.longitude || item.lng),
                    latitude: parseFloat(item.latitude || item.lat),
                    altitude: parseFloat(item.altitude || item.height || item.elevation) || 50,
                    type: item.type || 'unknown',
                    source: filename,
                    properties: {}
                };
                
                // 追加プロパティを設定
                Object.keys(item).forEach(key => {
                    if (!['id', 'name', 'longitude', 'latitude', 'lng', 'lat', 'altitude', 'height', 'elevation', 'type'].includes(key)) {
                        droneObject.properties![key] = item[key];
                    }
                });
                
                objects.push(droneObject);
            }
        });
    }
    
    return objects;
};

// ドローンオブジェクト描画
export const addDroneObjects = (map: maplibregl.Map, objects: DroneObject[], sourceId: string = 'drone-objects') => {
    console.log('ドローンオブジェクト描画開始:', objects.length, '個のオブジェクト');
    
    const features = objects.map(obj => ({
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [obj.longitude, obj.latitude]
        },
        properties: {
            id: obj.id,
            name: obj.name,
            altitude: obj.altitude,
            type: obj.type,
            source: obj.source,
            ...obj.properties
        }
    }));

    // 既存のソースとレイヤーを削除
    ['3d-layer', 'points-layer'].forEach(layerId => {
        if (map.getLayer(`${sourceId}-${layerId}`)) {
            map.removeLayer(`${sourceId}-${layerId}`);
        }
    });
    
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }

    try {
        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features
            }
        });

        // 3D押し出しレイヤー
        map.addLayer({
            id: `${sourceId}-3d-layer`,
            type: 'fill-extrusion',
            source: sourceId,
            paint: {
                'fill-extrusion-color': [
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
                'fill-extrusion-height': ['get', 'altitude'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.8
            }
        });

        // ポイントマーカーレイヤー
        map.addLayer({
            id: `${sourceId}-points-layer`,
            type: 'circle',
            source: sourceId,
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 6,
                    16, 12
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

        console.log('ドローンオブジェクトレイヤーが正常に追加されました');
        
        // 地図の中心をデータの中心に移動
        if (objects.length > 0) {
            const centerLng = objects.reduce((sum, obj) => sum + obj.longitude, 0) / objects.length;
            const centerLat = objects.reduce((sum, obj) => sum + obj.latitude, 0) / objects.length;
            map.flyTo({
                center: [centerLng, centerLat],
                zoom: 14,
                duration: 2000
            });
        }
    } catch (error) {
        console.error('ドローンオブジェクトレイヤーの追加に失敗:', error);
        throw error;
    }
};

// ドローン軌跡の追加
export const addDroneTrails = (map: maplibregl.Map, trails: { [droneId: string]: number[][] }) => {
    const features = Object.entries(trails).map(([droneId, coords]) => ({
        type: 'Feature' as const,
        geometry: {
            type: 'LineString' as const,
            coordinates: coords
        },
        properties: { drone_id: droneId }
    }));

    const sourceId = 'drone-trails';
    
    if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features
        });
    } else {
        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features
            }
        });

        map.addLayer({
            id: 'drone-trails-layer',
            type: 'line',
            source: sourceId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#ff6b6b',
                'line-width': 2,
                'line-opacity': 0.6
            }
        });
    }
};

// データのCSV書き出し
export const exportDroneDataToCSV = (objects: DroneObject[]): string => {
    if (objects.length === 0) return '';
    
    const headers = ['longitude', 'latitude', 'altitude', 'name', 'type', 'source'];
    const csvLines = [headers.join(',')];
    
    objects.forEach(obj => {
        const values = [
            obj.longitude,
            obj.latitude,
            obj.altitude,
            `"${obj.name}"`,
            obj.type,
            `"${obj.source}"`
        ];
        csvLines.push(values.join(','));
    });
    
    return csvLines.join('\n');
};

// データのGeoJSON書き出し
export const exportDroneDataToGeoJSON = (objects: DroneObject[]): string => {
    const geojson = {
        type: 'FeatureCollection',
        metadata: {
            export_time: new Date().toISOString(),
            total_objects: objects.length,
            generator: 'MapLibre GSI Terrain System'
        },
        features: objects.map(obj => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [obj.longitude, obj.latitude, obj.altitude]
            },
            properties: {
                name: obj.name,
                type: obj.type,
                altitude: obj.altitude,
                source: obj.source,
                id: obj.id,
                ...obj.properties
            }
        }))
    };
    
    return JSON.stringify(geojson, null, 2);
};

// ========================================
// 新しい統一フライトデータ Export/Import
// ========================================

// UnifiedFlightDataのCSVエクスポート
export const exportUnifiedFlightDataToCSV = (data: UnifiedFlightData[]): string => {
    if (data.length === 0) return '';
    
    const headers = [
        'id', 'name', 'type', 'source',
        'longitude', 'latitude', 'altitude', 'relativeAltitude',
        'timestamp', 'duration',
        'speed', 'heading', 'action', 'waypointId', 'sequenceNumber',
        'batteryLevel', 'signalStrength', 'gpsAccuracy', 'temperature', 'humidity', 'windSpeed', 'windDirection',
        'missionId', 'operatorId', 'aircraftModel', 'aircraftSerial', 'description'
    ];
    
    const rows = data.map(item => [
        item.id,
        item.name,
        item.type,
        item.source,
        item.position.longitude,
        item.position.latitude,
        item.position.altitude,
        item.position.relativeAltitude || '',
        item.timestamp || '',
        item.duration || '',
        item.flight?.speed || '',
        item.flight?.heading || '',
        item.flight?.action || '',
        item.flight?.waypointId || '',
        item.flight?.sequenceNumber || '',
        item.telemetry?.batteryLevel || '',
        item.telemetry?.signalStrength || '',
        item.telemetry?.gpsAccuracy || '',
        item.telemetry?.temperature || '',
        item.telemetry?.humidity || '',
        item.telemetry?.windSpeed || '',
        item.telemetry?.windDirection || '',
        item.metadata?.missionId || '',
        item.metadata?.operatorId || '',
        item.metadata?.aircraftModel || '',
        item.metadata?.aircraftSerial || '',
        item.metadata?.description || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return csvContent;
};

// UnifiedFlightDataのGeoJSONエクスポート
export const exportUnifiedFlightDataToGeoJSON = (data: UnifiedFlightData[]): string => {
    const features = data.map(item => {
        // 幾何情報がある場合はそれを使用、なければPointを作成
        const geometry = item.geometry || {
            type: 'Point' as const,
            coordinates: [item.position.longitude, item.position.latitude, item.position.altitude]
        };
        
        return {
            type: 'Feature' as const,
            geometry,
            properties: {
                id: item.id,
                name: item.name,
                type: item.type,
                source: item.source,
                altitude: item.position.altitude,
                relativeAltitude: item.position.relativeAltitude,
                timestamp: item.timestamp,
                duration: item.duration,
                flight: item.flight,
                telemetry: item.telemetry,
                metadata: item.metadata,
                ...item.properties
            }
        };
    });
    
    const geojson = {
        type: 'FeatureCollection' as const,
        metadata: {
            generator: 'MapLibre GSI Terrain - Unified Flight Data',
            timestamp: new Date().toISOString(),
            count: data.length
        },
        features
    };
    
    return JSON.stringify(geojson, null, 2);
};

// フライトミッションのJSONエクスポート
export const exportFlightMissionToJSON = (mission: FlightMission): string => {
    return JSON.stringify(mission, null, 2);
};

// フライト実行結果のJSONエクスポート
export const exportFlightExecutionResultToJSON = (result: FlightExecutionResult): string => {
    return JSON.stringify(result, null, 2);
};

// フライトミッションのKMLエクスポート（Googleマップ対応）
export const exportFlightMissionToKML = (mission: FlightMission): string => {
    const waypoints = mission.waypoints;
    if (waypoints.length === 0) return '';
    
    const waypointPlacemarks = waypoints.map(wp => `
        <Placemark>
            <name>${wp.name}</name>
            <description>
                <![CDATA[
                    <b>Action:</b> ${wp.flight?.action || 'waypoint'}<br/>
                    <b>Altitude:</b> ${wp.position.altitude}m<br/>
                    <b>Speed:</b> ${wp.flight?.speed || 'N/A'} m/s<br/>
                    <b>Duration:</b> ${wp.duration || 0}s
                ]]>
            </description>
            <Point>
                <coordinates>${wp.position.longitude},${wp.position.latitude},${wp.position.altitude}</coordinates>
            </Point>
        </Placemark>`).join('');
    
    const pathCoordinates = waypoints.map(wp => 
        `${wp.position.longitude},${wp.position.latitude},${wp.position.altitude}`
    ).join(' ');
    
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>${mission.name}</name>
        <description>${mission.description || ''}</description>
        
        <Style id="waypointStyle">
            <IconStyle>
                <Icon>
                    <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
                </Icon>
            </IconStyle>
        </Style>
        
        <Style id="pathStyle">
            <LineStyle>
                <color>ff0000ff</color>
                <width>3</width>
            </LineStyle>
        </Style>
        
        ${waypointPlacemarks}
        
        <Placemark>
            <name>Flight Path</name>
            <styleUrl>#pathStyle</styleUrl>
            <LineString>
                <altitudeMode>absolute</altitudeMode>
                <coordinates>${pathCoordinates}</coordinates>
            </LineString>
        </Placemark>
        
        <Placemark>
            <name>Home Position</name>
            <Point>
                <coordinates>${mission.settings.homePosition.longitude},${mission.settings.homePosition.latitude},${mission.settings.homePosition.altitude}</coordinates>
            </Point>
        </Placemark>
    </Document>
</kml>`;
    
    return kml;
};

// ========================================
// 新しい統一フライトデータ インポート関数
// ========================================

// UnifiedFlightDataのCSVインポート
export const parseUnifiedFlightDataCSV = (csvContent: string): UnifiedFlightData[] => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data: UnifiedFlightData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 6) { // 最低限必要なフィールド数
            const item: UnifiedFlightData = {
                id: values[0] || `unified_${Date.now()}_${i}`,
                name: values[1] || `Flight Data ${i}`,
                type: (values[2] as any) || 'waypoint',
                source: values[3] || 'csv_import',
                position: {
                    longitude: parseFloat(values[4]) || 0,
                    latitude: parseFloat(values[5]) || 0,
                    altitude: parseFloat(values[6]) || 0,
                    relativeAltitude: values[7] ? parseFloat(values[7]) : undefined
                }
            };
            
            // 時間情報
            if (values[8]) item.timestamp = values[8];
            if (values[9]) item.duration = parseFloat(values[9]);
            
            // フライト情報
            if (values[10] || values[11] || values[12] || values[13] || values[14]) {
                item.flight = {
                    speed: values[10] ? parseFloat(values[10]) : undefined,
                    heading: values[11] ? parseFloat(values[11]) : undefined,
                    action: values[12] as any,
                    waypointId: values[13] ? parseInt(values[13]) : undefined,
                    sequenceNumber: values[14] ? parseInt(values[14]) : undefined
                };
            }
            
            // テレメトリ情報
            if (values[15] || values[16] || values[17] || values[18] || values[19] || values[20] || values[21]) {
                item.telemetry = {
                    batteryLevel: values[15] ? parseFloat(values[15]) : undefined,
                    signalStrength: values[16] ? parseFloat(values[16]) : undefined,
                    gpsAccuracy: values[17] ? parseFloat(values[17]) : undefined,
                    temperature: values[18] ? parseFloat(values[18]) : undefined,
                    humidity: values[19] ? parseFloat(values[19]) : undefined,
                    windSpeed: values[20] ? parseFloat(values[20]) : undefined,
                    windDirection: values[21] ? parseFloat(values[21]) : undefined
                };
            }
            
            // メタデータ
            if (values[22] || values[23] || values[24] || values[25] || values[26]) {
                item.metadata = {
                    missionId: values[22] || undefined,
                    operatorId: values[23] || undefined,
                    aircraftModel: values[24] || undefined,
                    aircraftSerial: values[25] || undefined,
                    description: values[26] || undefined
                };
            }
            
            data.push(item);
        }
    }
    
    return data;
};

// UnifiedFlightDataのGeoJSONインポート
export const parseUnifiedFlightDataGeoJSON = (jsonContent: string): UnifiedFlightData[] => {
    try {
        const geojson = JSON.parse(jsonContent);
        if (geojson.type !== 'FeatureCollection' || !geojson.features) {
            throw new Error('Invalid GeoJSON format');
        }
        
        const data: UnifiedFlightData[] = geojson.features.map((feature: any, index: number) => {
            const props = feature.properties || {};
            const geometry = feature.geometry;
            
            // 座標の取得（Point、LineString、Polygonに対応）
            let position = { longitude: 0, latitude: 0, altitude: 0 };
            if (geometry) {
                if (geometry.type === 'Point') {
                    position = {
                        longitude: geometry.coordinates[0],
                        latitude: geometry.coordinates[1],
                        altitude: geometry.coordinates[2] || props.altitude || 0
                    };
                } else if (geometry.type === 'LineString' && geometry.coordinates.length > 0) {
                    // LineStringの最初の点を使用
                    position = {
                        longitude: geometry.coordinates[0][0],
                        latitude: geometry.coordinates[0][1],
                        altitude: geometry.coordinates[0][2] || props.altitude || 0
                    };
                } else if (geometry.type === 'Polygon' && geometry.coordinates[0].length > 0) {
                    // Polygonの最初の点を使用
                    position = {
                        longitude: geometry.coordinates[0][0][0],
                        latitude: geometry.coordinates[0][0][1],
                        altitude: geometry.coordinates[0][0][2] || props.altitude || 0
                    };
                }
            }
            
            const item: UnifiedFlightData = {
                id: props.id || `geojson_${Date.now()}_${index}`,
                name: props.name || `Flight Data ${index + 1}`,
                type: props.type || 'waypoint',
                source: props.source || 'geojson_import',
                position: {
                    ...position,
                    relativeAltitude: props.relativeAltitude
                },
                timestamp: props.timestamp,
                duration: props.duration,
                flight: props.flight,
                telemetry: props.telemetry,
                metadata: props.metadata,
                geometry: geometry,
                properties: props
            };
            
            return item;
        });
        
        return data;
    } catch (error) {
        console.error('GeoJSON parse error:', error);
        return [];
    }
};

// フライトミッションのJSONインポート
export const parseFlightMissionJSON = (jsonContent: string): FlightMission | null => {
    try {
        const mission = JSON.parse(jsonContent);
        
        // 基本的な検証
        if (!mission.id || !mission.name || !mission.settings || !mission.waypoints) {
            throw new Error('Invalid flight mission format');
        }
        
        return mission as FlightMission;
    } catch (error) {
        console.error('Flight mission parse error:', error);
        return null;
    }
};

// フライト実行結果のJSONインポート
export const parseFlightExecutionResultJSON = (jsonContent: string): FlightExecutionResult | null => {
    try {
        const result = JSON.parse(jsonContent);
        
        // 基本的な検証
        if (!result.missionId || !result.executionId || !result.actualTrajectory) {
            throw new Error('Invalid flight execution result format');
        }
        
        return result as FlightExecutionResult;
    } catch (error) {
        console.error('Flight execution result parse error:', error);
        return null;
    }
};

// ファイルダウンロード
export const downloadFile = (content: string, filename: string, mimeType: string) => {
    try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`ファイルダウンロード完了: ${filename}`);
    } catch (error) {
        console.error('ファイルダウンロードエラー:', error);
        throw error;
    }
};

// サンプルデータ生成
export const generateSampleDroneData = (center: [number, number] = [139.7454, 35.6586]): DroneObject[] => {
    const sampleData: DroneObject[] = [];
    
    // 東京タワー周辺の点検ドローンデータ生成（半径500m以内）
    for (let i = 1; i <= 5; i++) {
        const angle = (i - 1) * (2 * Math.PI / 5) + Math.random() * 0.5; // 5つのドローンを円形に配置
        const distance = 200 + Math.random() * 300; // 200-500m範囲
        const pos = [
            center[0] + (distance * Math.cos(angle)) / 111320, // 経度変換
            center[1] + (distance * Math.sin(angle)) / 110540  // 緯度変換
        ];
        
        sampleData.push({
            id: `tokyo_tower_drone_${i}_${Date.now()}`,
            name: `点検用ドローン${String(i).padStart(2, '0')}`,
            longitude: pos[0],
            latitude: pos[1],
            altitude: 250 + Math.random() * 100, // 東京タワー高度を考慮した250-350m
            type: 'drone',
            source: 'tokyo_tower_inspection',
            properties: {
                mission: 'tower_inspection',
                status: 'active'
            }
        });
    }
    
    // 東京タワー周辺の点検関連オブジェクト
    const inspectionPoints = [
        { type: 'base', name: '管制基地', lat_offset: -0.001, lng_offset: 0.001, altitude: 50 },
        { type: 'sensor', name: '風向センサー', lat_offset: 0.0005, lng_offset: -0.0008, altitude: 100 },
        { type: 'weather', name: '気象観測点', lat_offset: -0.0008, lng_offset: -0.001, altitude: 80 },
        { type: 'manual', name: '点検ポイントA', lat_offset: 0.0003, lng_offset: 0.0005, altitude: 200 }
    ] as const;
    
    inspectionPoints.forEach((point, index) => {
        sampleData.push({
            id: `tokyo_tower_${point.type}_${index}_${Date.now()}`,
            name: point.name,
            longitude: center[0] + point.lng_offset,
            latitude: center[1] + point.lat_offset,
            altitude: point.altitude + (Math.random() - 0.5) * 20,
            type: point.type,
            source: 'tokyo_tower_inspection',
            properties: {
                facility_type: 'inspection_equipment',
                tower_related: true
            }
        });
    });
    
    return sampleData;
};

// データクリア（ドローン対応版）
export const clearDroneData = (map: maplibregl.Map, sourceIds: string[] = ['drone-objects', 'drone-trails']) => {
    sourceIds.forEach(sourceId => {
        // レイヤーの削除
        ['3d-layer', 'points-layer', 'trails-layer'].forEach(layerSuffix => {
            const layerId = `${sourceId}-${layerSuffix}`;
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
        });
        
        // 単一レイヤーの削除
        if (map.getLayer(`${sourceId}-layer`)) {
            map.removeLayer(`${sourceId}-layer`);
        }
        
        // ソースの削除
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
        }
    });
};

// パフォーマンス最適化のためのデータ分割処理
export const processLargeDataset = async (
    data: Point3D[] | MeshVertex[], 
    chunkSize: number = 1000
): Promise<(Point3D[] | MeshVertex[])[]> => {
    const chunks: (Point3D[] | MeshVertex[])[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push(data.slice(i, i + chunkSize));
    }
    
    return chunks;
}; 
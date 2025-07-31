import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
    addDroneObjects, 
    addDroneTrails, 
    parseDroneCSV, 
    parseGeoJSON, 
    exportDroneDataToCSV, 
    exportDroneDataToGeoJSON, 
    downloadFile, 
    generateSampleDroneData, 
    clearDroneData,
    type DroneObject
} from '../src/data-import-export';

interface DroneDataSystemProps {
    className?: string;
}

const DroneDataSystem: React.FC<DroneDataSystemProps> = ({ className = '' }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [loadedObjects, setLoadedObjects] = useState<DroneObject[]>([]);
    const [is3D, setIs3D] = useState(true);
    const [drawMode, setDrawMode] = useState(false);
    const [droneSimulationInterval, setDroneSimulationInterval] = useState<NodeJS.Timeout | null>(null);
    const [sampleDataLoaded, setSampleDataLoaded] = useState(false);
    const [status, setStatus] = useState('システム準備中...');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 地理院DEM変換関数
    const gsidem2terrainrgb = useCallback((r: number, g: number, b: number): [number, number, number] => {
        let height = r * 655.36 + g * 2.56 + b * 0.01;
        if (r === 128 && g === 0 && b === 0) {
            height = 0;
        } else if (r >= 128) {
            height -= 167772.16;
        }
        height += 100000;
        height *= 10;
        const tB = (height / 256 - Math.floor(height / 256)) * 256;
        const tG = (Math.floor(height / 256) / 256 - Math.floor(Math.floor(height / 256) / 256)) * 256;
        const tR = (Math.floor(Math.floor(height / 256) / 256) / 256 - Math.floor(Math.floor(Math.floor(height / 256) / 256) / 256)) * 256;
        return [tR, tG, tB];
    }, []);

    // マップ初期化
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        // 地理院DEMプロトコル登録
        maplibregl.addProtocol('gsidem', (params, callback) => {
            const image = new Image();
            image.crossOrigin = '';
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const context = canvas.getContext('2d')!;
                context.drawImage(image, 0, 0);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < imageData.data.length / 4; i++) {
                    const tRGB = gsidem2terrainrgb(
                        imageData.data[i * 4],
                        imageData.data[i * 4 + 1],
                        imageData.data[i * 4 + 2],
                    );
                    imageData.data[i * 4] = tRGB[0];
                    imageData.data[i * 4 + 1] = tRGB[1];
                    imageData.data[i * 4 + 2] = tRGB[2];
                }
                context.putImageData(imageData, 0, 0);
                canvas.toBlob((blob) =>
                    blob!.arrayBuffer().then((arr) => callback(null, arr, null, null)),
                );
            };
            image.onerror = () => callback(new Error('DEM読み込みエラー'));
            image.src = params.url.replace('gsidem://', '');
            return { cancel: () => {} };
        });

        // マップ初期化
        setStatus('マップ初期化中...');
        
        map.current = new maplibregl.Map({
            container: mapContainer.current,
            maxPitch: 85,
            center: [138.69, 35.3],
            zoom: 12,
            pitch: 70,
            style: {
                version: 8,
                sources: {
                    gsi: {
                        type: 'raster',
                        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
                        attribution: '地理院タイル',
                    },
                    gsidem: {
                        type: 'raster-dem',
                        tiles: ['gsidem://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        maxzoom: 14,
                    },
                    'objects-3d': {
                        type: 'geojson',
                        data: { type: 'FeatureCollection', features: [] }
                    },
                    'drone-trails': {
                        type: 'geojson',
                        data: { type: 'FeatureCollection', features: [] }
                    }
                },
                layers: [
                    {
                        id: 'gsi',
                        type: 'raster',
                        source: 'gsi',
                    }
                ],
                terrain: {
                    source: 'gsidem',
                    exaggeration: 1.2,
                },
            },
        });

        map.current.on('load', () => {
            setupMapLayers();
            setupMapEvents();
            setStatus('システム準備完了');
        });

        map.current.on('error', (e) => {
            console.error('MapLibreエラー:', e);
            setStatus('マップエラー発生');
        });

        return () => {
            if (map.current) {
                map.current.remove();
            }
        };
    }, [gsidem2terrainrgb]);

    // マップレイヤー設定
    const setupMapLayers = useCallback(() => {
        if (!map.current) return;

        try {
            // ドローン軌跡レイヤー
            map.current.addLayer({
                id: 'drone-trails-layer',
                type: 'line',
                source: 'drone-trails',
                paint: {
                    'line-color': '#ff6b6b',
                    'line-width': 2,
                    'line-opacity': 0.6
                }
            });

            // 3D押し出しレイヤー
            map.current.addLayer({
                id: 'objects-3d-layer',
                type: 'fill-extrusion',
                source: 'objects-3d',
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
            map.current.addLayer({
                id: 'objects-points-layer',
                type: 'circle',
                source: 'objects-3d',
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

            // 初期状態で2Dレイヤーを非表示に
            map.current.setLayoutProperty('objects-points-layer', 'visibility', 'none');

            console.log('マップレイヤー設定完了');
        } catch (error) {
            console.error('マップレイヤー設定エラー:', error);
            setStatus('レイヤー設定エラー');
        }
    }, []);

    // マップイベント設定
    const setupMapEvents = useCallback(() => {
        if (!map.current) return;

        // オブジェクトクリック
        map.current.on('click', 'objects-3d-layer', showObjectInfo);
        map.current.on('click', 'objects-points-layer', showObjectInfo);

        // マップクリック（描画モード時）
        map.current.on('click', (e) => {
            if (drawMode) {
                addObjectAtLocation(e.lngLat);
            }
        });

        // ホバーイベント
        map.current.on('mouseenter', 'objects-3d-layer', () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'objects-3d-layer', () => {
            if (map.current) map.current.getCanvas().style.cursor = drawMode ? 'crosshair' : '';
        });
        
        map.current.on('mouseenter', 'objects-points-layer', () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'objects-points-layer', () => {
            if (map.current) map.current.getCanvas().style.cursor = drawMode ? 'crosshair' : '';
        });
    }, [drawMode]);

    // オブジェクト表示更新
    const updateDisplay = useCallback(() => {
        if (!map.current) return;

        console.log('表示更新開始:', loadedObjects.length, '個のオブジェクト');
        
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

        try {
            const source = map.current.getSource('objects-3d') as maplibregl.GeoJSONSource;
            if (source) {
                source.setData({
                    type: 'FeatureCollection',
                    features: features
                });
                console.log('マップデータ更新完了');
            }
        } catch (error) {
            console.error('マップデータ更新エラー:', error);
        }
    }, [loadedObjects]);

    // loadedObjectsが変更されたら表示を更新
    useEffect(() => {
        updateDisplay();
    }, [loadedObjects, updateDisplay]);

    // オブジェクト情報表示
    const showObjectInfo = useCallback((e: maplibregl.MapMouseEvent) => {
        if (!map.current) return;
        
        const feature = e.features?.[0];
        if (!feature) return;
        
        const props = feature.properties;
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <div style="padding: 10px;">
                    <h3 style="margin: 0 0 10px 0;">${props?.name}</h3>
                    <p><strong>タイプ:</strong> ${props?.type}</p>
                    <p><strong>高度:</strong> ${props?.altitude}m</p>
                    <p><strong>座標:</strong> ${e.lngLat.lng.toFixed(6)}, ${e.lngLat.lat.toFixed(6)}</p>
                </div>
            `)
            .addTo(map.current);
    }, []);

    // クリック位置にオブジェクト追加
    const addObjectAtLocation = useCallback((lngLat: maplibregl.LngLat) => {
        const newObject: DroneObject = {
            id: `manual_${Date.now()}`,
            name: `手動追加_${loadedObjects.length + 1}`,
            longitude: lngLat.lng,
            latitude: lngLat.lat,
            altitude: 50 + Math.random() * 100,
            type: 'manual',
            source: 'manual'
        };
        
        setLoadedObjects(prev => [...prev, newObject]);
        setStatus(`オブジェクトを追加: ${newObject.name}`);
    }, [loadedObjects.length]);

    // ファイル処理
    const handleFiles = useCallback(async (files: FileList) => {
        setStatus('ファイル処理中...');
        const newObjects: DroneObject[] = [];
        
        for (const file of Array.from(files)) {
            try {
                const content = await file.text();
                let objects: DroneObject[] = [];
                
                if (file.name.endsWith('.csv')) {
                    objects = parseDroneCSV(content, file.name);
                } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
                    objects = parseGeoJSON(content, file.name);
                }
                
                // 重複チェック
                objects.forEach(newObject => {
                    const exists = [...loadedObjects, ...newObjects].some(existing => 
                        Math.abs(existing.longitude - newObject.longitude) < 0.00001 &&
                        Math.abs(existing.latitude - newObject.latitude) < 0.00001
                    );
                    
                    if (!exists) {
                        newObjects.push(newObject);
                    }
                });
            } catch (error) {
                console.error('ファイル処理エラー:', error);
                setStatus(`ファイル処理エラー: ${(error as Error).message}`);
                return;
            }
        }
        
        setLoadedObjects(prev => [...prev, ...newObjects]);
        setStatus(`${files.length}ファイルの処理完了`);
    }, [loadedObjects]);

    // ドラッグ&ドロップ処理
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    // サンプルデータ読み込み
    const loadSampleData = useCallback(() => {
        if (sampleDataLoaded) {
            setStatus('サンプルデータは既に読み込み済みです');
            return;
        }
        
        const sampleData = generateSampleDroneData([138.69, 35.3]);
        setLoadedObjects(prev => [...prev, ...sampleData]);
        setSampleDataLoaded(true);
        setStatus(`サンプルデータ読み込み完了: ${sampleData.length}オブジェクト`);
    }, [sampleDataLoaded]);

    // ドローンシミュレーション
    const startDroneSimulation = useCallback(() => {
        if (droneSimulationInterval) {
            clearInterval(droneSimulationInterval);
            setDroneSimulationInterval(null);
            setStatus('ドローンシミュレーション停止');
            return;
        }
        
        const drones = loadedObjects.filter(obj => obj.type === 'drone');
        if (drones.length === 0) {
            setStatus('ドローンデータがありません。先にサンプルデータを読み込んでください。');
            return;
        }
        
        setStatus('ドローンシミュレーション開始');
        const trails: { [droneId: string]: number[][] } = {};
        
        const interval = setInterval(() => {
            setLoadedObjects(prevObjects => {
                const updatedObjects = prevObjects.map(obj => {
                    if (obj.type === 'drone') {
                        // 軌跡保存
                        if (!trails[obj.id]) {
                            trails[obj.id] = [];
                        }
                        trails[obj.id].push([obj.longitude, obj.latitude]);
                        
                        // ランダム移動
                        return {
                            ...obj,
                            longitude: obj.longitude + (Math.random() - 0.5) * 0.002,
                            latitude: obj.latitude + (Math.random() - 0.5) * 0.002,
                            altitude: Math.max(50, Math.min(300, obj.altitude + (Math.random() - 0.5) * 20))
                        };
                    }
                    return obj;
                });
                
                // 軌跡更新
                if (map.current) {
                    addDroneTrails(map.current, trails);
                }
                
                return updatedObjects;
            });
        }, 1000);
        
        setDroneSimulationInterval(interval);
    }, [droneSimulationInterval, loadedObjects]);

    // データ書き出し
    const exportCSV = useCallback(() => {
        if (loadedObjects.length === 0) {
            setStatus('書き出すデータがありません');
            return;
        }
        
        try {
            const csv = exportDroneDataToCSV(loadedObjects);
            downloadFile(csv, 'maplibre_drone_data.csv', 'text/csv');
            setStatus('CSV書き出し完了');
        } catch (error) {
            console.error('CSV書き出しエラー:', error);
            setStatus('CSV書き出しエラー');
        }
    }, [loadedObjects]);

    const exportGeoJSON = useCallback(() => {
        if (loadedObjects.length === 0) {
            setStatus('書き出すデータがありません');
            return;
        }
        
        try {
            const geojson = exportDroneDataToGeoJSON(loadedObjects);
            downloadFile(geojson, 'maplibre_drone_data.geojson', 'application/geo+json');
            setStatus('GeoJSON書き出し完了');
        } catch (error) {
            console.error('GeoJSON書き出しエラー:', error);
            setStatus('GeoJSON書き出しエラー');
        }
    }, [loadedObjects]);

    // データクリア
    const clearAllData = useCallback(() => {
        if (loadedObjects.length === 0) {
            setStatus('クリアするデータがありません');
            return;
        }
        
        if (window.confirm(`${loadedObjects.length}個のオブジェクトを全て削除しますか？`)) {
            setLoadedObjects([]);
            setSampleDataLoaded(false);
            
            if (droneSimulationInterval) {
                clearInterval(droneSimulationInterval);
                setDroneSimulationInterval(null);
            }
            
            if (map.current) {
                clearDroneData(map.current);
            }
            
            setStatus('全データクリア完了');
        }
    }, [loadedObjects.length, droneSimulationInterval]);

    // 2D/3D切り替え
    const toggle3D = useCallback(() => {
        if (!map.current) return;
        
        const newIs3D = !is3D;
        setIs3D(newIs3D);
        
        if (newIs3D) {
            map.current.easeTo({ pitch: 70, duration: 1000 });
            if (map.current.getLayer('objects-3d-layer')) {
                map.current.setLayoutProperty('objects-3d-layer', 'visibility', 'visible');
            }
            if (map.current.getLayer('objects-points-layer')) {
                map.current.setLayoutProperty('objects-points-layer', 'visibility', 'none');
            }
            setStatus('3D表示に切り替え');
        } else {
            map.current.easeTo({ pitch: 0, duration: 1000 });
            if (map.current.getLayer('objects-3d-layer')) {
                map.current.setLayoutProperty('objects-3d-layer', 'visibility', 'none');
            }
            if (map.current.getLayer('objects-points-layer')) {
                map.current.setLayoutProperty('objects-points-layer', 'visibility', 'visible');
            }
            setStatus('2D表示に切り替え');
        }
    }, [is3D]);

    // 描画モード切り替え
    const enableDrawMode = useCallback(() => {
        const newDrawMode = !drawMode;
        setDrawMode(newDrawMode);
        
        if (map.current) {
            map.current.getCanvas().style.cursor = newDrawMode ? 'crosshair' : '';
        }
        
        setStatus(newDrawMode ? '描画モード有効 - マップをクリックしてオブジェクトを追加' : '描画モード無効');
    }, [drawMode]);

    // オブジェクト削除
    const removeObject = useCallback((objectId: string) => {
        setLoadedObjects(prev => prev.filter(obj => obj.id !== objectId));
        setStatus(`オブジェクトを削除: ${objectId}`);
    }, []);

    // オブジェクトにフォーカス
    const focusOnObject = useCallback((objectId: string) => {
        if (!map.current) return;
        
        const obj = loadedObjects.find(o => o.id === objectId);
        if (obj) {
            map.current.flyTo({
                center: [obj.longitude, obj.latitude],
                zoom: 16,
                duration: 1500
            });
            
            new maplibregl.Popup({ closeOnClick: true })
                .setLngLat([obj.longitude, obj.latitude])
                .setHTML(`
                    <div style="padding: 8px;">
                        <h4 style="margin: 0 0 5px 0;">${obj.name}</h4>
                        <p style="margin: 0; font-size: 12px;">タイプ: ${obj.type} | 高度: ${obj.altitude.toFixed(0)}m</p>
                    </div>
                `)
                .addTo(map.current);
            
            setStatus(`${obj.name}にフォーカス`);
        }
    }, [loadedObjects]);

    // 統計計算
    const stats = React.useMemo(() => {
        if (loadedObjects.length === 0) {
            return { loadedCount: 0, visibleCount: 0, altitudeRange: '-' };
        }
        
        const altitudes = loadedObjects.map(obj => obj.altitude);
        const minAlt = Math.min(...altitudes);
        const maxAlt = Math.max(...altitudes);
        
        return {
            loadedCount: loadedObjects.length,
            visibleCount: loadedObjects.length,
            altitudeRange: `${minAlt.toFixed(0)}m - ${maxAlt.toFixed(0)}m`
        };
    }, [loadedObjects]);

    // オブジェクトリスト（ソート済み）
    const sortedObjects = React.useMemo(() => {
        return [...loadedObjects].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            return a.name.localeCompare(b.name);
        });
    }, [loadedObjects]);

    return (
        <div className={`drone-data-system ${className}`} style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div ref={mapContainer} style={{ flex: 1, minHeight: 0 }} />
            
            <div style={{ 
                height: '300px', 
                overflowY: 'auto', 
                padding: '20px', 
                background: '#f5f5f5', 
                borderTop: '1px solid #ddd' 
            }}>
                <h3>📁 3Dデータ取り込み・書き出し</h3>
                
                {/* ステータス表示 */}
                <div style={{ 
                    margin: '10px 0', 
                    padding: '10px', 
                    background: '#e8f4f8', 
                    borderRadius: '5px', 
                    fontSize: '14px' 
                }}>
                    {status}
                </div>
                
                {/* ファイル取り込みエリア */}
                <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: `2px dashed ${dragOver ? '#007cba' : '#ccc'}`,
                        background: dragOver ? '#e3f2fd' : 'transparent',
                        padding: '20px',
                        textAlign: 'center',
                        margin: '10px 0',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        borderRadius: '5px'
                    }}
                >
                    📂 3Dデータファイルをドロップ または クリックして選択<br />
                    <small>対応形式: CSV, GeoJSON, JSON</small>
                </div>
                <input 
                    ref={fileInputRef}
                    type="file" 
                    multiple 
                    accept=".csv,.json,.geojson" 
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                
                {/* サンプルデータ */}
                <div style={{ fontSize: '12px', color: '#666', margin: '10px 0' }}>
                    <strong>CSVサンプル形式:</strong> longitude,latitude,altitude,name,type<br />
                    <code>139.6917,35.6895,100,飛行001,flight</code>
                </div>
                
                {/* データ情報 */}
                <div style={{ display: 'flex', gap: '20px', margin: '10px 0' }}>
                    <div style={{ padding: '10px', background: 'white', borderRadius: '5px', flex: 1 }}>
                        <strong>読み込み済み:</strong> {stats.loadedCount} オブジェクト
                    </div>
                    <div style={{ padding: '10px', background: 'white', borderRadius: '5px', flex: 1 }}>
                        <strong>表示中:</strong> {stats.visibleCount} オブジェクト
                    </div>
                    <div style={{ padding: '10px', background: 'white', borderRadius: '5px', flex: 1 }}>
                        <strong>高度範囲:</strong> {stats.altitudeRange}
                    </div>
                </div>
                
                {/* コントロールボタン */}
                <div style={{ marginBottom: '15px' }}>
                    <button onClick={loadSampleData} style={buttonStyle}>🎯 サンプルデータ読み込み</button>
                    <button onClick={startDroneSimulation} style={buttonStyle}>🚁 飛行シミュレーション</button>
                    <button onClick={exportCSV} disabled={loadedObjects.length === 0} style={buttonStyle}>📊 CSV書き出し</button>
                    <button onClick={exportGeoJSON} disabled={loadedObjects.length === 0} style={buttonStyle}>🗺️ GeoJSON書き出し</button>
                    <button onClick={clearAllData} style={buttonStyle}>🗑️ データクリア</button>
                    <button onClick={toggle3D} style={buttonStyle}>🔄 2D/3D切り替え</button>
                    <button onClick={enableDrawMode} style={buttonStyle}>✏️ 描画モード</button>
                </div>
                
                {/* オブジェクト一覧 */}
                <div>
                    <h4>📍 オブジェクト一覧</h4>
                    <div style={{ 
                        maxHeight: '120px', 
                        overflowY: 'auto', 
                        border: '1px solid #ddd', 
                        borderRadius: '5px'
                    }}>
                        {sortedObjects.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                オブジェクトがありません
                            </div>
                        ) : (
                            sortedObjects.map((obj) => (
                                <div key={obj.id} style={{
                                    padding: '8px',
                                    background: 'white',
                                    borderBottom: '1px solid #eee',
                                    fontSize: '12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '2px' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 6px',
                                                borderRadius: '10px',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                marginRight: '5px',
                                                ...getTypeBadgeStyle(obj.type)
                                            }}>
                                                {obj.type}
                                            </span>
                                            {obj.name}
                                        </div>
                                        <div style={{ color: '#666', fontSize: '11px' }}>
                                            座標: {obj.longitude.toFixed(6)}, {obj.latitude.toFixed(6)}<br />
                                            高度: {obj.altitude.toFixed(0)}m | ソース: {obj.source}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button 
                                            onClick={() => focusOnObject(obj.id)}
                                            style={{
                                                background: '#28a745',
                                                color: 'white',
                                                border: 'none',
                                                padding: '3px 8px',
                                                borderRadius: '2px',
                                                cursor: 'pointer',
                                                fontSize: '10px'
                                            }}
                                            title="地図でフォーカス"
                                        >
                                            📍
                                        </button>
                                        <button 
                                            onClick={() => removeObject(obj.id)}
                                            style={{
                                                background: '#ff4444',
                                                color: 'white',
                                                border: 'none',
                                                padding: '3px 8px',
                                                borderRadius: '2px',
                                                cursor: 'pointer',
                                                fontSize: '10px'
                                            }}
                                            title="削除"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    margin: '5px',
    cursor: 'pointer',
    background: '#007cba',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    transition: 'all 0.3s'
};

const getTypeBadgeStyle = (type: string) => {
    const styles = {
        drone: { background: '#ffebee', color: '#c62828' },
        base: { background: '#fff3e0', color: '#ef6c00' },
        sensor: { background: '#e3f2fd', color: '#1565c0' },
        building: { background: '#e8f5e8', color: '#2e7d32' },
        weather: { background: '#f3e5f5', color: '#7b1fa2' },
        manual: { background: '#f5f5f5', color: '#424242' },
        flight: { background: '#ffebee', color: '#d32f2f' }
    };
    
    return styles[type as keyof typeof styles] || { background: '#f5f5f5', color: '#424242' };
};

export default DroneDataSystem;
# MapLibre GL JS データ Import/Export 技術解説

## 概要

MapLibre GL JS での 3D データ取り込みと描画に関する技術的な解説と、1m メッシュ範囲拡大への対応方法について説明します。

## アーキテクチャ概要

### 現在の実装

-   **地理院 DEM データの直接利用**: 補間処理なしで地理院標高タイルをそのまま使用
-   **WebGL2 による GPU 処理**: 高速なデータ変換と描画
-   **Web Worker による非同期処理**: UI ブロッキングの回避

### データフロー

```
外部データ（CSV/GeoJSON） → データ変換 → MapLibre GL JS → 3D描画
```

## 技術的な主題

### 1. データ Import 方式

#### CSV データの取り込み

```typescript
interface Point3D {
    x: number
    y: number
    z: number
    properties?: Record<string, any>
}

const parseCSVData = (csvContent: string): Point3D[] => {
    const lines = csvContent.split('\n')
    const headers = lines[0].split(',')
    const data: Point3D[] = []

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        if (values.length >= 3) {
            data.push({
                x: parseFloat(values[0]),
                y: parseFloat(values[1]),
                z: parseFloat(values[2]),
                properties:
                    headers.length > 3
                        ? Object.fromEntries(
                              headers
                                  .slice(3)
                                  .map((h, idx) => [h, values[idx + 3]])
                          )
                        : {},
            })
        }
    }

    return data
}
```

#### GeoJSON データの取り込み

```typescript
interface GeoJSON3D {
    type: 'FeatureCollection'
    features: Array<{
        type: 'Feature'
        geometry: {
            type: 'Point' | 'LineString' | 'Polygon'
            coordinates: number[][]
        }
        properties?: Record<string, any>
    }>
}

const parseGeoJSONData = (geojsonContent: string): GeoJSON3D => {
    return JSON.parse(geojsonContent)
}
```

### 2. 3D データの描画方式

#### ポイントデータの描画

```typescript
const add3DPoints = (map: maplibregl.Map, points: Point3D[]) => {
    const features = points.map((point) => ({
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [point.x, point.y, point.z],
        },
        properties: point.properties,
    }))

    map.addSource('3d-points', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features,
        },
    })

    map.addLayer({
        id: '3d-points-layer',
        type: 'circle',
        source: '3d-points',
        paint: {
            'circle-radius': 5,
            'circle-color': '#ff0000',
            'circle-opacity': 0.8,
        },
    })
}
```

#### メッシュデータの描画

```typescript
const add3DMesh = (map: maplibregl.Map, meshData: number[][][]) => {
    // メッシュデータを三角形に変換
    const triangles = convertMeshToTriangles(meshData)

    map.addSource('3d-mesh', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: triangles.map((triangle) => ({
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [triangle],
                },
            })),
        },
    })

    map.addLayer({
        id: '3d-mesh-layer',
        type: 'fill',
        source: '3d-mesh',
        paint: {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'elevation'],
                0,
                '#0000ff',
                1000,
                '#ffff00',
                2000,
                '#ff0000',
            ],
            'fill-opacity': 0.7,
        },
    })
}
```

### 3. パフォーマンス最適化

#### データの分割処理

```typescript
const processLargeDataset = async (
    data: Point3D[],
    chunkSize: number = 1000
) => {
    const chunks: Point3D[][] = []

    for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push(data.slice(i, i + chunkSize))
    }

    return chunks
}
```

#### Web Worker による非同期処理

```typescript
const workerCode = `
self.onmessage = function(e) {
    const { data, type } = e.data;
    
    switch(type) {
        case 'parse-csv':
            const parsed = parseCSVData(data);
            self.postMessage({ type: 'parsed', data: parsed });
            break;
        case 'convert-mesh':
            const converted = convertMeshToTriangles(data);
            self.postMessage({ type: 'converted', data: converted });
            break;
    }
};
`
```

## 1m メッシュ対応の技術的考慮事項

### データサイズの最適化

-   **タイル分割**: 大きなメッシュデータを適切なサイズに分割
-   **LOD（Level of Detail）**: ズームレベルに応じた詳細度の調整
-   **データ圧縮**: 効率的なデータ圧縮アルゴリズムの採用

### メモリ管理

```typescript
const memoryEfficientRenderer = {
    maxPointsInMemory: 100000,
    cleanupThreshold: 0.8,

    addData: function (map: maplibregl.Map, data: Point3D[]) {
        if (
            this.currentDataSize >
            this.maxPointsInMemory * this.cleanupThreshold
        ) {
            this.cleanupOldData(map)
        }

        this.addNewData(map, data)
    },

    cleanupOldData: function (map: maplibregl.Map) {
        // 古いデータの削除処理
        const sources = map.getStyle().sources
        Object.keys(sources).forEach((sourceId) => {
            if (sourceId.startsWith('temp-')) {
                map.removeSource(sourceId)
            }
        })
    },
}
```

## 実装例

### CSV データの取り込みと描画

```typescript
const importAndRenderCSV = async (file: File, map: maplibregl.Map) => {
    const content = await file.text()
    const data = parseCSVData(content)

    // データの前処理
    const processedData = preprocessData(data)

    // 3D描画の実行
    add3DPoints(map, processedData)
}
```

### メッシュデータの取り込みと描画

```typescript
const importAndRenderMesh = async (file: File, map: maplibregl.Map) => {
    const content = await file.text()
    const meshData = parseMeshData(content)

    // メッシュデータの最適化
    const optimizedMesh = optimizeMesh(meshData)

    // 3Dメッシュ描画の実行
    add3DMesh(map, optimizedMesh)
}
```

## 今後の拡張方向

1. **リアルタイムデータ更新**: WebSocket によるリアルタイムデータ更新
2. **高度な 3D 描画**: カスタムシェーダーによる高度な 3D 効果
3. **データエクスポート**: 描画結果のエクスポート機能
4. **プラグイン化**: 再利用可能なプラグインとしての実装

## 参考資料

-   [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js-docs/)
-   [WebGL2 Programming Guide](https://www.khronos.org/webgl/)
-   [地理院標高タイル仕様](https://maps.gsi.go.jp/development/ichiran.html)

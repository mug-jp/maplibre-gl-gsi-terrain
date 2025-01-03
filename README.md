# maplibre-gl-gsi-terrain

![](./screenshot.png)

## インストール

### CDN経由

```html
<script type="module">
    import { useGsiTerrainSource } from 'https://www.unpkg.com/maplibre-gl-gsi-terrain@2.1.0/dist/terrain.js';
</script>
```

### npm module として利用する

```sh
npm install maplibre-gl-gsi-terrain
```

## 使い方

```typescript
import maplibregl from 'maplibre-gl';
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain';

const gsiTerrainSource = useGsiTerrainSource(maplibregl.addProtocol);
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        center: [139.6917, 35.6895],
        zoom: 10,
        pitch: 30,
        maxPitch: 100,
        sources: {
            terrain: gsiTerrainSource,
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
```

`useGsiTerrainSource()`は第2引数でオプションを受け取ります。

| オプション名 | 型 | デフォルト |
| --- | --- | --- |
| `tileUrl` | `string` | 地理院標高タイルに準ずるエンコーディングのタイルURL,{z}/{x}/{y}形式。<br />デフォルトは`https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png` |
| `maxzoom` | `number` | 最大ズームレベル、デフォルトは`14` |
| `minzoom` | `number` | 最小ズームレベル、デフォルトは`1` |
| `attribution` | `string` | デフォルトは`地理院タイル` |

### `ProtocolAction`を直接利用する

`getGsiDemProtocolAction()`を利用することで、`ProtocolAction`を取得できます。通常のケースでは`useGsiTerrainSource()`の利用を推奨します。

```typescript
import maplibregl, { RasterDEMSourceSpecification } from 'maplibre-gl';
import { getGsiDemProtocolAction } from '../src/terrain.ts';

const protocolAction = getGsiDemProtocolAction('gsidem');
maplibregl.addProtocol('gsidem', protocolAction);
const gsiTerrainSource: RasterDEMSourceSpecification = {
    type: 'raster-dem',
    tiles: ['gsidem://https://tiles.gsj.jp/tiles/elev/mixed/{z}/{y}/{x}.png'],
    tileSize: 256,
    minzoom: 1,
    maxzoom: 17,
    attribution:
    '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
};
```

### 産総研シームレス標高タイルを利用する例

```typescript
import maplibreGl from 'maplibre-gl';
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain';

const gsiTerrainSource = useGsiTerrainSource(maplibreGl.addProtocol, {
    tileUrl: 'https://tiles.gsj.jp/tiles/elev/mixed/{z}/{y}/{x}.png',
    maxzoom: 17,
    attribution: '<a href="https://gbank.gsj.jp/seamless/elev/">産総研シームレス標高タイル</a>'
});
```

## MapLibre GL JS v3以前を利用する場合

このライブラリは`maplibregl.addProtocol`に依存しています。`addProtocol`はv4で破壊的変更があり、このライブラリでは`v1.0.0`以降、v4に準拠した仕様になっています。v3以前を利用する場合は`v0.0.2`を利用してください。

```sh
npm install maplibre-gl-gsi-terrain@0.0.2
```

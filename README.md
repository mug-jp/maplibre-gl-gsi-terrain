# maplibre-gl-gsi-terrain

![](./screenshot.png)

## 使い方

```sh
npm install maplibre-gl-gsi-terrain
```

```typescript
import maplibreGl, { Map } from 'maplibre-gl';
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain';

const gsiTerrainSource = useGsiTerrainSource(maplibreGl.addProtocol);

new Map({
    container: 'app',
    style: {
        version: 8,
        sources: {
            terrain: gsiTerrainSource,
        },
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

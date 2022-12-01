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
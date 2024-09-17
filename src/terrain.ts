import type { RasterDEMSourceSpecification } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';

type Options = {
    attribution?: string;
    maxzoom?: number;
    minzoom?: number;
    tileUrl?: string;
};

/**
 * 地理院標高タイルを利用したtype=raster-demのsourceを返す
 * @param addProtocol
 * @param options
 * @returns {RasterDEMSourceSpecification} - source
 * @example
 * const gsiTerrainSource = useGsiTerrainSource(maplibreGl.addProtocol);
 * const map = new Map({
 *  container: 'app',
 *  style: {
 *    version: 8,
 *    sources: {
 *      terrain: gsiTerrainSource,
 *    },
 *    terrain: {
 *      source: 'terrain',
 *      exaggeration: 1.2,
 *    },
 *  },
 * });
 *
 * const seamlessTerrainSource = useGsiTerrainSource(maplibreGl.addProtocol, {
 *   tileUrl: 'https://tiles.gsj.jp/tiles/elev/mixed/{z}/{y}/{x}.png',
 *   minzoom: 1,
 *   maxzoom: 17,
 *   attribution: '<a href="https://gbank.gsj.jp/seamless/elev/">産総研シームレス標高タイル</a>',
 * });
 */

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
});
const pendingRequests = new Map();
worker.addEventListener('message', (e) => {
    const { id, buffer } = e.data;
    const request = pendingRequests.get(id);
    if (request) {
        if (buffer.byteLength === 0) {
            request.reject(new Error('Empty buffer received'));
        } else {
            request.resolve({ data: new Uint8Array(buffer) });
        }
        pendingRequests.delete(id);
    }
});

worker.addEventListener('error', (e) => {
    console.error('Worker error:', e);

    pendingRequests.forEach((request) => {
        request.reject(new Error('Worker error occurred'));
    });
    pendingRequests.clear();
});
export const useGsiTerrainSource = (addProtocol: typeof maplibregl.addProtocol, options: Options = {}): RasterDEMSourceSpecification => {
    addProtocol('gsidem', async (params, abortController) => {
        const imageUrl = params.url.replace('gsidem://', '');
        return new Promise((resolve, reject) => {
            const request = { resolve, reject };
            pendingRequests.set(imageUrl, request);

            worker.postMessage({ url: imageUrl });

            abortController.signal.addEventListener('abort', () => {
                pendingRequests.delete(imageUrl);
                reject(new Error('Request aborted'));
            });
        });
    });
    const tileUrl = options.tileUrl ?? `https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`;

    return {
        type: 'raster-dem',
        tiles: [`gsidem://${tileUrl}`],
        tileSize: 256,
        minzoom: options.minzoom ?? 1,
        maxzoom: options.maxzoom ?? 14,
        attribution: options.attribution ?? '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
    };
};

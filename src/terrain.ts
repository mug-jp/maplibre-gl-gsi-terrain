import type { RasterDEMSourceSpecification } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import Worker from './worker?worker';

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

const worker = new Worker();
export const useGsiTerrainSource = (addProtocol: typeof maplibregl.addProtocol, options: Options = {}): RasterDEMSourceSpecification => {
    addProtocol('gsidem', async (params, abortController) => {
        const imageUrl = params.url.replace('gsidem://', '');
        return new Promise((resolve, reject) => {
            const handleMessage = (e: MessageEvent) => {
                if (e.data.id === imageUrl) {
                    if (e.data.buffer.byteLength === 0) {
                        reject({
                            data: new Uint8Array(0),
                        });
                    } else {
                        const arrayBuffer = e.data.buffer;
                        resolve({
                            data: new Uint8Array(arrayBuffer),
                        });
                    }
                    cleanup();
                }
            };

            const handleError = (e: ErrorEvent) => {
                console.error(e);
                abortController.abort();
                reject({
                    data: new Uint8Array(0),
                });
                cleanup();
            };

            const cleanup = () => {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);
            worker.postMessage({ url: imageUrl });
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

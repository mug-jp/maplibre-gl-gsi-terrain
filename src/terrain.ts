import type { RasterDEMSourceSpecification } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';

const loadImage = async (src: string, signal: AbortSignal): Promise<ImageBitmap> => {
    const response = await fetch(src, { signal: signal });
    if (!response.ok) {
        throw new Error('Failed to fetch image');
    }
    return await createImageBitmap(await response.blob());
};

class WorkerProtocol {
    private worker: Worker;
    private pendingRequests: Map<
        string,
        {
            resolve: (value: { data: Uint8Array } | PromiseLike<{ data: Uint8Array }>) => void;
            reject: (reason?: Error) => void;
            controller: AbortController;
        }
    >;

    constructor(worker: Worker) {
        this.worker = worker;
        this.pendingRequests = new Map();
        this.worker.addEventListener('message', this.handleMessage);
        this.worker.addEventListener('error', this.handleError);
    }

    async request(url: URL, controller: AbortController): Promise<{ data: Uint8Array }> {
        try {
            // タイル座標からIDを生成し、リクエストを管理する
            const x = url.searchParams.get('x');
            const y = url.searchParams.get('y');
            const z = url.searchParams.get('z');
            const tileId = `${z}/${x}/${y}`;

            const imageUrl = url.origin + url.pathname;
            const image = await loadImage(imageUrl, controller.signal);

            return new Promise((resolve, reject) => {
                this.pendingRequests.set(tileId, { resolve, reject, controller });
                this.worker.postMessage({ image, id: tileId });

                controller.signal.addEventListener('abort', () => {
                    this.pendingRequests.delete(tileId);
                    reject(new Error('Request aborted'));
                });
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private handleMessage = (e: MessageEvent) => {
        const { id, buffer, error } = e.data;
        if (error) {
            console.error(`Error processing tile ${id}:`, error);
        } else {
            const request = this.pendingRequests.get(id);
            if (request) {
                request.resolve({ data: new Uint8Array(buffer) });
                this.pendingRequests.delete(id);
            }
        }
    };

    private handleError = (e: ErrorEvent) => {
        console.error('Worker error:', e);
        this.pendingRequests.forEach((request) => {
            request.reject(new Error('Worker error occurred'));
        });
        this.pendingRequests.clear();
    };
}

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const workerProtocol = new WorkerProtocol(worker);

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
export const useGsiTerrainSource = (addProtocol: typeof maplibregl.addProtocol, options: Options = {}): RasterDEMSourceSpecification => {
    addProtocol('gsidem', (params, abortController) => {
        const urlWithoutProtocol = params.url.replace('gsidem://', '');
        const url = new URL(urlWithoutProtocol);
        return workerProtocol.request(url, abortController);
    });
    const tileUrl = options.tileUrl ?? `https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`;

    return {
        type: 'raster-dem',
        tiles: [`gsidem://${tileUrl}?x={x}&y={y}&z={z}`],
        tileSize: 256,
        minzoom: options.minzoom ?? 1,
        maxzoom: options.maxzoom ?? 14,
        attribution: options.attribution ?? '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
    };
};

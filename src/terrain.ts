import type { RasterDEMSourceSpecification } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { workerCode } from './worker';


const loadImage = async (
	src: string,
	signal: AbortSignal,
): Promise<ImageBitmap | null> => {
	let response: Response;
	try {
		response = await fetch(src, { signal });
	} catch (e) {
		if (!signal.aborted) {
			console.error(`Failed to fetch image: ${e}`);
		}
		return null;
	}
	if (!response.ok) {
		return null;
	}
	return await createImageBitmap(await response.blob());
};
class WorkerProtocol {
	private worker: Worker;
	private pendingRequests: Map<
		string,
		{
			resolve: (
				value: { data: Uint8Array } | PromiseLike<{ data: Uint8Array }>,
			) => void;
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

	async request(
		url: string,
		controller: AbortController,
	): Promise<{ data: Uint8Array }> {
		const image = await loadImage(url, controller.signal);

		if (!image) {
			return Promise.reject(new Error('Failed to load image'));
		}

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(url, { resolve, reject, controller });
			this.worker.postMessage({ image, url });

			controller.signal.onabort = () => {
				this.pendingRequests.delete(url);
				reject(new Error('Request aborted'));
			};
		});
	}

	private handleMessage = (e: MessageEvent) => {
		const { url, buffer, error } = e.data;
		if (error) {
			console.error(`Error processing tile ${url}:`, error);
		} else {
			const request = this.pendingRequests.get(url);
			if (request) {
				request.resolve({ data: new Uint8Array(buffer) });
				this.pendingRequests.delete(url);
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

const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
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
export const useGsiTerrainSource = (
	addProtocol: typeof maplibregl.addProtocol,
	options: Options = {},
): RasterDEMSourceSpecification => {
	addProtocol('gsidem', (params, abortController) => {
		const urlWithoutProtocol = params.url.replace('gsidem://', '');
		return workerProtocol.request(urlWithoutProtocol, abortController);
	});
	const tileUrl =
		options.tileUrl ??
		`https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`;

	return {
		type: 'raster-dem',
		tiles: [`gsidem://${tileUrl}`],
		tileSize: 256,
		minzoom: options.minzoom ?? 1,
		maxzoom: options.maxzoom ?? 14,
		attribution:
			options.attribution ??
			'<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
	};
};

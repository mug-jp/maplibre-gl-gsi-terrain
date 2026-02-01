import type {
	AddProtocolAction,
	RasterDEMSourceSpecification,
} from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import TerrainWorker from './terrain.worker.ts?worker';

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<
	number,
	{ resolve: (data: Uint8Array) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker {
	if (!worker) {
		worker = new TerrainWorker();
		worker.onmessage = (e) => {
			const { png, id } = e.data;
			const pending = pendingRequests.get(id);
			if (pending) {
				pending.resolve(png);
				pendingRequests.delete(id);
			}
		};
		worker.onerror = (e) => {
			pendingRequests.forEach((pending) =>
				pending.reject(new Error(e.message)),
			);
			pendingRequests.clear();
		};
	}
	return worker;
}

async function loadPng(url: string): Promise<Uint8Array> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch: ${response.status}`);
	}
	const arrayBuffer = await response.arrayBuffer();
	const pngData = new Uint8Array(arrayBuffer);

	return new Promise((resolve, reject) => {
		const id = requestId++;
		pendingRequests.set(id, { resolve, reject });
		getWorker().postMessage({ pngData, id }, [pngData.buffer]);
	});
}

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
	const protocolName = 'gsidem';
	const protocolAction = getGsiDemProtocolAction(protocolName);
	addProtocol(protocolName, protocolAction);

	const tileUrl =
		options.tileUrl ??
		`https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`;

	return {
		type: 'raster-dem',
		encoding: 'terrarium',
		tiles: [`gsidem://${tileUrl}`],
		tileSize: 256,
		minzoom: options.minzoom ?? 1,
		maxzoom: options.maxzoom ?? 14,
		attribution: options.attribution ?? '',
	};
};

/**
 * 地理院標高タイルを利用してtype=raster-demのsourceを生成するためのProtocolActionを返す
 * @param customProtocol - 任意のプロトコル名（例: 'gsidem'）
 * @returns {AddProtocolAction} - ProtocolAction
 * @example
 * const protocolAction = getGsiDemProtocolAction('gsidem');
 * addProtocol('gsidem', protocolAction);
 * const rasterDemSource = {
 *   type: 'raster-dem',
 *   encoding: 'terrarium',
 *   tiles: ['gsidem://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png'],
 *   tileSize: 256,
 *   minzoom: 1,
 *   maxzoom: 14,
 *   attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
 * };
 * const map = new Map({container: 'app', style: {sources: {terrain: gsiTerrainSource}}});
 */
export const getGsiDemProtocolAction = (
	customProtocol: string,
): AddProtocolAction => {
	return async (params, abortController) => {
		const imageUrl = params.url.replace(`${customProtocol}://`, '');
		const png = await loadPng(imageUrl).catch((e) => {
			abortController.abort();
			throw e.message;
		});
		return { data: png };
	};
};

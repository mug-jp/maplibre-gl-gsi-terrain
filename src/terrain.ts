import type {
	AddProtocolAction,
	RasterDEMSourceSpecification,
} from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { encode } from 'fast-png';

function loadPng(url: string): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = '';
		image.onload = () => {
			const canvas = new OffscreenCanvas(image.width, image.height);
			canvas.width = image.width;
			canvas.height = image.height;

			const context = canvas.getContext('2d', {
				willReadFrequently: true,
			})!;

			// 地理院標高タイルを採用している一部のタイルは無効値が透過されていることがある
			// 透過されている場合に無効値にフォールバックさせる=rgb(128,0,0)で塗りつぶす
			context.fillStyle = 'rgb(128,0,0)';
			context.fillRect(0, 0, canvas.width, canvas.height);

			context.drawImage(image, 0, 0);
			const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
			for (let i = 0; i < imageData.data.length / 4; i++) {
				const tRGB = gsidem2terrarium(
					imageData.data[i * 4],
					imageData.data[i * 4 + 1],
					imageData.data[i * 4 + 2],
				);
				imageData.data[i * 4] = tRGB[0];
				imageData.data[i * 4 + 1] = tRGB[1];
				imageData.data[i * 4 + 2] = tRGB[2];
			}
			const png = encode(imageData);
			resolve(png);
		};
		image.onerror = (e) => {
			reject(e);
		};
		image.src = url;
	});
}

export function gsidem2terrarium(
	r: number,
	g: number,
	b: number,
): [number, number, number] {
	// GSI DEMからメートル単位の標高値を取得
	let rgb = (r << 16) + (g << 8) + b;
	let h = 0;

	if (rgb < 0x800000) h = rgb * 0.01;
	else if (rgb > 0x800000) h = (rgb - Math.pow(2, 24)) * 0.01;

	// Terrarium形式にエンコード
	// 標高 = (R * 256 + G + B / 256) - 32768
	const value = h + 32768;
	const tR = Math.floor(value / 256);
	const tG = Math.floor(value) % 256;
	const tB = Math.floor((value - Math.floor(value)) * 256);
	return [tR, tG, tB];
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

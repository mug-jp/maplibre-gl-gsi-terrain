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
export declare const useGsiTerrainSource: (addProtocol: typeof maplibregl.addProtocol, options?: Options) => RasterDEMSourceSpecification;
export {};
//# sourceMappingURL=terrain.d.ts.map
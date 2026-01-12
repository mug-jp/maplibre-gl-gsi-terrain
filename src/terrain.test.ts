import { describe, expect, it, test } from 'vitest';
import {
	getGsiDemProtocolAction,
	gsidem2terrarium,
	useGsiTerrainSource,
} from './terrain';
import maplibregl, {
	Map,
	type RasterDEMSourceSpecification,
} from 'maplibre-gl';

test('getGsiDemProtocolAction', async () => {
	const protocolAction = getGsiDemProtocolAction('myprotocol');
	maplibregl.addProtocol('myprotocol', protocolAction);
	const myProtocolSource: RasterDEMSourceSpecification = {
		type: 'raster-dem',
		tiles: ['myprotocol://https://example.com/{z}/{x}/{y}.png'],
		tileSize: 256,
		minzoom: 1,
		maxzoom: 17,
		attribution: '<a href="https://example.com">example</a>',
	};

	const map = new Map({
		container: document.createElement('div'),
		style: {
			version: 8,
			sources: { myProtocolSource },
			layers: [],
			terrain: { source: 'myProtocolSource', exaggeration: 1.2 },
		},
	});

	await new Promise((resolve) => map.on('load', resolve));

	expect(map.getSource('myProtocolSource')).toBeDefined();
	expect(map.getTerrain()).toEqual({
		source: 'myProtocolSource',
		exaggeration: 1.2,
	});
});

test('useGsiTerrainSource', async () => {
	const gsiTerrainSource = useGsiTerrainSource(maplibregl.addProtocol);
	const map = new Map({
		container: document.createElement('div'),
		style: {
			version: 8,
			sources: { terrain: gsiTerrainSource },
			layers: [],
			terrain: { source: 'terrain', exaggeration: 1.234 },
		},
	});

	await new Promise((resolve) => map.on('load', resolve));

	expect(map.getSource('terrain')).toBeDefined();
	expect(map.getTerrain()).toEqual({
		source: 'terrain',
		exaggeration: 1.234,
	});
});

describe('gsidem2terrarium', () => {
	// Terrarium形式のデコード関数（検証用）
	const decodeTerrarium = (r: number, g: number, b: number): number => {
		return r * 256 + g + b / 256 - 32768;
	};

	// GSI DEMのエンコード関数（テストデータ生成用）
	const encodeGsiDem = (elevation: number): [number, number, number] => {
		const value = Math.round(elevation * 100);
		let rgb: number;
		if (value >= 0) {
			rgb = value;
		} else {
			rgb = value + Math.pow(2, 24);
		}
		const r = (rgb >> 16) & 0xff;
		const g = (rgb >> 8) & 0xff;
		const b = rgb & 0xff;
		return [r, g, b];
	};

	it('標高0mを正しく変換する', () => {
		const [r, g, b] = encodeGsiDem(0);
		const result = gsidem2terrarium(r, g, b);
		const decoded = decodeTerrarium(result[0], result[1], result[2]);
		expect(decoded).toBeCloseTo(0, 1);
	});

	it('正の標高（富士山3776m）を正しく変換する', () => {
		const [r, g, b] = encodeGsiDem(3776);
		const result = gsidem2terrarium(r, g, b);
		const decoded = decodeTerrarium(result[0], result[1], result[2]);
		expect(decoded).toBeCloseTo(3776, 0);
	});

	it('負の標高（-100m）を正しく変換する', () => {
		const [r, g, b] = encodeGsiDem(-100);
		const result = gsidem2terrarium(r, g, b);
		const decoded = decodeTerrarium(result[0], result[1], result[2]);
		expect(decoded).toBeCloseTo(-100, 0);
	});

	it('無効値（0x800000 = rgb(128,0,0)）は標高0として扱われる', () => {
		// GSI DEMの無効値は0x800000 = rgb(128,0,0)
		const result = gsidem2terrarium(128, 0, 0);
		const decoded = decodeTerrarium(result[0], result[1], result[2]);
		expect(decoded).toBeCloseTo(0, 1);
	});

	it('小さい正の標高（100m）を正しく変換する', () => {
		const [r, g, b] = encodeGsiDem(100);
		const result = gsidem2terrarium(r, g, b);
		const decoded = decodeTerrarium(result[0], result[1], result[2]);
		expect(decoded).toBeCloseTo(100, 0);
	});

	it('大きな負の標高（マリアナ海溝-10000m）を正しく変換する', () => {
		const [r, g, b] = encodeGsiDem(-10000);
		const result = gsidem2terrarium(r, g, b);
		const decoded = decodeTerrarium(result[0], result[1], result[2]);
		expect(decoded).toBeCloseTo(-10000, 0);
	});

	it('出力値が0-255の範囲内である', () => {
		const testElevations = [0, 100, 3776, -100, -1000, 8848];
		for (const elev of testElevations) {
			const [r, g, b] = encodeGsiDem(elev);
			const result = gsidem2terrarium(r, g, b);
			expect(result[0]).toBeGreaterThanOrEqual(0);
			expect(result[0]).toBeLessThanOrEqual(255);
			expect(result[1]).toBeGreaterThanOrEqual(0);
			expect(result[1]).toBeLessThanOrEqual(255);
			expect(result[2]).toBeGreaterThanOrEqual(0);
			expect(result[2]).toBeLessThanOrEqual(255);
		}
	});
});

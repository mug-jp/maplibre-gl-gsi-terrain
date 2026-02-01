import { decode, encode } from 'fast-png';

function gsidem2terrarium(
	r: number,
	g: number,
	b: number,
): [number, number, number] {
	let rgb = (r << 16) + (g << 8) + b;
	let h = 0;
	if (rgb < 0x800000) h = rgb * 0.01;
	else if (rgb > 0x800000) h = (rgb - Math.pow(2, 24)) * 0.01;
	const value = h + 32768;
	const tR = Math.floor(value / 256);
	const tG = Math.floor(value) % 256;
	const tB = Math.floor((value - Math.floor(value)) * 256);
	return [tR, tG, tB];
}

self.onmessage = async (e: MessageEvent) => {
	const { pngData, id } = e.data;

	// PNGをデコード（地理院タイル等は常にRGB形式を想定）
	const decoded = decode(pngData);
	const width = decoded.width;
	const height = decoded.height;
	const imageData = decoded.data;

	// ピクセルごとに変換（RGB形式で直接処理）
	for (let i = 0; i < width * height; i++) {
		const tRGB = gsidem2terrarium(
			imageData[i * 3],
			imageData[i * 3 + 1],
			imageData[i * 3 + 2],
		);
		imageData[i * 3] = tRGB[0];
		imageData[i * 3 + 1] = tRGB[1];
		imageData[i * 3 + 2] = tRGB[2];
	}

	// PNGにエンコード（RGB形式）
	const png = encode({
		width,
		height,
		data: imageData,
		depth: 8,
		channels: 3,
	});

	(self as unknown as Worker).postMessage({ png, id }, [png.buffer]);
};

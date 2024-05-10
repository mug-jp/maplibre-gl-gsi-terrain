// @ts-ignore
importScripts('workerpool.js');
// @ts-ignore
const pool = workerpool.worker({
    loadPng,
});

function gsidem2terrainrgb(
    r: number,
    g: number,
    b: number,
): [number, number, number] {
    // https://qiita.com/frogcat/items/d12bed4e930b83eb3544
    let rgb = (r << 16) + (g << 8) + b;
    let h = 0;

    if (rgb < 0x800000) h = rgb * 0.01;
    else if (rgb > 0x800000) h = (rgb - Math.pow(2, 24)) * 0.01;

    rgb = Math.floor((h + 10000) / 0.1);
    const tR = (rgb & 0xff0000) >> 16;
    const tG = (rgb & 0x00ff00) >> 8;
    const tB = rgb & 0x0000ff;
    return [tR, tG, tB];
}

async function loadPng(url: string): Promise<Uint8Array | null> {
    let res: Response;
    try {
        res = await fetch(url);
    } catch (e) {
        return null;
    }

    if (!res.ok) {
        return null;
    }

    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', {
        willReadFrequently: true,
    })!;

    // 地理院標高タイルを採用している一部のタイルは無効値が透過されていることがある
    // 透過されている場合に無効値にフォールバックさせる=rgb(128,0,0)で塗りつぶす
    context.fillStyle = 'rgb(128,0,0)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length / 4; i++) {
        const tRGB = gsidem2terrainrgb(
            imageData.data[i * 4],
            imageData.data[i * 4 + 1],
            imageData.data[i * 4 + 2],
        );
        imageData.data[i * 4] = tRGB[0];
        imageData.data[i * 4 + 1] = tRGB[1];
        imageData.data[i * 4 + 2] = tRGB[2];
    }

    const canvas2 = new OffscreenCanvas(imageData.width, imageData.height);
    const context2 = canvas2.getContext('2d', {
        willReadFrequently: true,
    })!;
    context2.putImageData(imageData, 0, 0);

    // blob to typedarray
    const b2 = await canvas2.convertToBlob();
    const ab = await b2!.arrayBuffer();
    return new Uint8Array(ab);
}

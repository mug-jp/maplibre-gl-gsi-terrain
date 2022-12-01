import type {
    RasterDEMSourceSpecification,
    RequestParameters,
    ResponseCallback,
    Cancelable,
} from 'maplibre-gl';
import { encode } from 'fast-png';

const gsidem2terrainrgb = (r: number, g: number, b: number) => {
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
};

type Options = {
    attribution?: string;
    maxzoom?: number;
    minzoom?: number;
};

export const useGsiTerrain = (
    addProtocol: (
        customProtocol: string,
        loadFn: (
            requestParameters: RequestParameters,
            callback: ResponseCallback<any>,
        ) => Cancelable,
    ) => void,
    options: Options = {},
): RasterDEMSourceSpecification => {
    addProtocol('gsidem', (params: any, callback: any) => {
        const image = new Image();
        image.crossOrigin = '';
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;

            const context = canvas.getContext('2d', {
                willReadFrequently: true,
            })!;
            context.drawImage(image, 0, 0);
            const imageData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            );
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
            const png = encode(imageData);
            callback(null, png, null, null);
        };
        image.src = params.url.replace('gsidem://', '');
        return {
            cancel: () => {
                image.src = '';
            },
        };
    });

    return {
        type: 'raster-dem',
        tiles: [
            'gsidem://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        minzoom: options.minzoom ?? 1,
        maxzoom: options.maxzoom ?? 14,
        attribution:
            options.attribution ??
            '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
    };
};

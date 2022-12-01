import type {
    RasterDEMSourceSpecification,
    RequestParameters,
    ResponseCallback,
    Cancelable,
} from 'maplibre-gl';
import { encode } from 'fast-png';

const gsidem2terrainrgb = (r: number, g: number, b: number) => {
    let height = r * 655.36 + g * 2.56 + b * 0.01;
    if (r === 128 && g === 0 && b === 0) {
        height = 0;
    } else if (r >= 128) {
        height -= 167772.16;
    }
    height += 100000;
    height *= 10;
    const tB = (height / 256 - Math.floor(height / 256)) * 256;
    const tG =
        (Math.floor(height / 256) / 256 -
            Math.floor(Math.floor(height / 256) / 256)) *
        256;
    const tR =
        (Math.floor(Math.floor(height / 256) / 256) / 256 -
            Math.floor(Math.floor(Math.floor(height / 256) / 256) / 256)) *
        256;
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

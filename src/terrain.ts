import type { RasterDEMSourceSpecification } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';

type Options = {
    attribution?: string;
    maxzoom?: number;
    minzoom?: number;
    tileUrl?: string;
};

const canvas = document.createElement('canvas');

const canvasToArrayBuffer = async (canvas: HTMLCanvasElement): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Failed to create blob from canvas'));
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                if (reader.result instanceof ArrayBuffer) {
                    resolve(new Uint8Array(reader.result));
                } else {
                    reject(new Error('Failed to convert blob to ArrayBuffer'));
                }
            };
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsArrayBuffer(blob);
        }, 'image/png');
    });
};

const imageToWebGLArrayBuffer = async (image: HTMLImageElement): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        canvas.width = image.width;
        canvas.height = image.height;
        const gl = canvas.getContext('webgl');

        if (!gl) {
            alert('Unable to initialize WebGL. Your browser may not support it.');
            return;
        }

        const vsSource = /* glsl */ `
            attribute vec4 aPosition;
            varying vec2 vTexCoord;

            void main() {
                gl_Position = aPosition;
                vTexCoord = vec2(aPosition.x * 0.5 + 0.5, aPosition.y * -0.5 + 0.5); // Y軸を反転
            }
        `;

        const fsSource = /* glsl */ `
            precision mediump float;
            uniform sampler2D heightMap;
            uniform vec2 resolution;
            varying vec2 vTexCoord;

            void main() {
                vec2 uv = vTexCoord;
                vec4 color = texture2D(heightMap, uv);

                float r = color.r * 255.0;
                float g = color.g * 255.0;
                float b = color.b * 255.0;

                if (r == 128.0) {
                    gl_FragColor = vec4(1.0 / 255.0, 134.0 / 255.0, 160.0 / 255.0, 1.0);
                } else {
                    float rgb = r * 65536.0 + g * 256.0 + b;
                    float height = (rgb < 8388608.0) ? rgb * 0.01 : (rgb - 16777216.0) * 0.01;

                    height = (height + 10000.0) * 10.0;

                    float tB = mod(height, 256.0);
                    float tG = mod(floor(height / 256.0), 256.0);
                    float tR = floor(height / 65536.0);

                    gl_FragColor = vec4(tR / 255.0, tG / 255.0, tB / 255.0, 1.0);
                }
            }
        `;

        const loadShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

        if (!vertexShader || !fragmentShader) {
            reject(new Error('Failed to compile shaders'));
            return;
        }

        const program = gl.createProgram();
        if (!program) {
            reject(new Error('Failed to create shader program'));
            return;
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
            reject(new Error('Failed to link shader program'));
            return;
        }

        gl.useProgram(program);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const heightMapLocation = gl.getUniformLocation(program, 'heightMap');
        const resolutionLocation = gl.getUniformLocation(program, 'resolution');

        const heightMap = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, heightMap);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.useProgram(program);
        gl.uniform1i(heightMapLocation, 0);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        canvasToArrayBuffer(canvas).then(resolve).catch(reject);
    });
};

function loadPng(url: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = '';
        image.onload = () => {
            const png = imageToWebGLArrayBuffer(image);
            resolve(png);
        };
        image.onerror = (e) => {
            reject(e);
        };
        image.src = url;
    });
}

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
    addProtocol('gsidem', async (params, abortController) => {
        const imageUrl = params.url.replace('gsidem://', '');
        const png = await loadPng(imageUrl).catch((e) => {
            abortController.abort();
            throw e.message;
        });
        return { data: png };
    });
    const tileUrl = options.tileUrl ?? `https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`;

    return {
        type: 'raster-dem',
        tiles: [`gsidem://${tileUrl}`],
        tileSize: 256,
        minzoom: options.minzoom ?? 1,
        maxzoom: options.maxzoom ?? 14,
        attribution: options.attribution ?? '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
    };
};

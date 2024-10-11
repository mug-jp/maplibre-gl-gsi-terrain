const vsSource = `#version 300 es
    in vec4 aPosition;
    out vec2 vTexCoord;

    void main() {
        gl_Position = aPosition;
        vTexCoord = vec2(aPosition.x * 0.5 + 0.5, aPosition.y * -0.5 + 0.5);
    }
`;

const fsSource = `#version 300 es
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform sampler2D heightMap;
    in vec2 vTexCoord;
    out vec4 fragColor;

    #define HEIGHT_OFFSET 10000.0
    #define HEIGHT_SCALE 10.0

    void main() {
        vec4 color = texture(heightMap, vTexCoord);
        vec3 rgb = color.rgb * 255.0;

        float rgbValue = dot(rgb, vec3(65536.0, 256.0, 1.0));
        float height = mix(rgbValue, rgbValue - 16777216.0, step(8388608.0, rgbValue)) * 0.01;

        height = (height + HEIGHT_OFFSET) * HEIGHT_SCALE;

        fragColor = vec4(
            floor(height / 65536.0) / 255.0,
            floor(mod(height / 256.0, 256.0)) / 255.0,
            mod(height, 256.0) / 255.0,
            1.0
        );
    }
`;

let gl: WebGL2RenderingContext | null = null;
let program: WebGLProgram | null = null;
let positionBuffer: WebGLBuffer | null = null;
let heightMapLocation: WebGLUniformLocation | null = null;

const initWebGL = (canvas: OffscreenCanvas) => {
    gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL not supported');
    }

    const loadShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
        const shader = gl.createShader(type);
        if (!shader) {
            console.error('Unable to create shader');
            return null;
        }
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
        throw new Error('Failed to load shaders');
    }

    program = gl.createProgram();
    if (!program) {
        throw new Error('Failed to create program');
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        throw new Error('Failed to link program');
    }

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    heightMapLocation = gl.getUniformLocation(program, 'heightMap');
};

const canvas = new OffscreenCanvas(256, 256);

self.onmessage = async (e) => {
    const { url, image } = e.data;

    try {
        if (!gl) {
            initWebGL(canvas);
        }

        if (!gl || !program || !positionBuffer || !heightMapLocation) {
            throw new Error('WebGL initialization failed');
        }

        const heightMap = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, heightMap);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.useProgram(program);
        gl.uniform1i(heightMapLocation, 0);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        const blob = await canvas.convertToBlob();
        if (!blob) {
            throw new Error('Failed to convert canvas to blob');
        }
        const buffer = await blob.arrayBuffer();
        self.postMessage({ id: url, buffer });
    } catch (error) {
        if (error instanceof Error) {
            self.postMessage({ id: url, error: error.message });
        }
    }
};

// インラインWebワーカーのコードを文字列で定義
const vsSource = `#version 300 es
    in vec4 a_position;
    out vec2 v_tex_coord;

    void main() {
        gl_Position = a_position;
        v_tex_coord = vec2(a_position.x * 0.5 + 0.5, a_position.y * -0.5 + 0.5);
    }
`;

const fsSource = `#version 300 es
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform sampler2D u_height_map;
    in vec2 v_tex_coord;
    out vec4 fragColor;

    void main() {
        vec4 color = texture(u_height_map, v_tex_coord);
        vec3 rgb = color.rgb * 255.0;

        // terrariumにおける高度0の色
        vec4 zero_elevation_color = vec4(128.0, 0.0, 0.0, 255.0) / 255.0;

        // 地理院標高タイルの無効値または完全に透明なピクセルの判定
        bool is_valid = (rgb.r != 128.0 || rgb.g != 0.0 || rgb.b != 0.0) && color.a != 0.0;

        float rgb_value = dot(rgb, vec3(65536.0, 256.0, 1.0));
        float height = mix(rgb_value, rgb_value - 16777216.0, step(8388608.0, rgb_value)) * 0.01;

        // terrariumの標高値エンコード
        height += 32768.0;
        float r = floor(height / 256.0);
        float g = floor(mod(height, 256.0));
        float b = floor((height - floor(height)) * 256.0);

        // terrariumの標高値を色に変換
        fragColor = mix(
            zero_elevation_color,
            vec4(
                r / 255.0,
                g / 255.0,
                b / 255.0,
                1.0
            ),
            float(is_valid)
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

	const loadShader = (
		gl: WebGL2RenderingContext,
		type: number,
		source: string,
	) => {
		const shader = gl.createShader(type);
		if (!shader) {
			console.error('Unable to create shader');
			return null;
		}
		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error(
				'An error occurred compiling the shaders: ' +
					gl.getShaderInfoLog(shader),
			);
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
		console.error(
			'Unable to initialize the shader program: ' +
				gl.getProgramInfoLog(program),
		);
		throw new Error('Failed to link program');
	}

	positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	const positionLocation = gl.getAttribLocation(program, 'a_position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

	heightMapLocation = gl.getUniformLocation(program, 'u_height_map');
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
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		gl.useProgram(program);
		gl.uniform1i(heightMapLocation, 0);

		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		const blob = await canvas.convertToBlob();
		if (!blob) {
			throw new Error('Failed to convert canvas to blob');
		}
		const buffer = await blob.arrayBuffer();
		self.postMessage({ url, buffer });
	} catch (error) {
		if (error instanceof Error) {
			self.postMessage({ url, error: error.message });
		}
	}
};

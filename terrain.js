var u = Object.defineProperty;
var h = (o, e, r) => e in o ? u(o, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : o[e] = r;
var l = (o, e, r) => (h(o, typeof e != "symbol" ? e + "" : e, r), r);
const d = `
const vsSource = \`#version 300 es
    in vec4 a_position;
    out vec2 v_tex_coord;

    void main() {
        gl_Position = a_position;
        v_tex_coord = vec2(a_position.x * 0.5 + 0.5, a_position.y * -0.5 + 0.5);
    }
\`;

const fsSource = \`#version 300 es
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

        // terrainRGB\u306B\u304A\u3051\u308B\u9AD8\u5EA60\u306E\u8272
        vec4 zero_elevation_color = vec4(1.0, 134.0, 160.0, 255.0) / 255.0;

        float rgb_value = dot(rgb, vec3(65536.0, 256.0, 1.0));
        float height = mix(rgb_value, rgb_value - 16777216.0, step(8388608.0, rgb_value)) * 0.01;
        height = (height + 10000.0) * 10.0;

        // \u5730\u7406\u9662\u6A19\u9AD8\u30BF\u30A4\u30EB\u306E\u7121\u52B9\u5024\u307E\u305F\u306F\u5B8C\u5168\u306B\u900F\u660E\u306A\u30D4\u30AF\u30BB\u30EB\u306E\u5224\u5B9A
        bool is_valid = (rgb.r != 128.0 || rgb.g != 0.0 || rgb.b != 0.0) && color.a != 0.0;

        fragColor = mix(
            zero_elevation_color,
            vec4(
                floor(height / 65536.0) / 255.0,
                floor(mod(height / 256.0, 256.0)) / 255.0,
                mod(height, 256.0) / 255.0,
                1.0
            ),
            float(is_valid)
        );
    }
\`;

let gl = null;
let program = null;
let positionBuffer = null;
let heightMapLocation = null;

const initWebGL = (canvas) => {
	gl = canvas.getContext('webgl2');
	if (!gl) {
		throw new Error('WebGL not supported');
	}

	const loadShader = (
		gl,
		type,
		source,
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
`, p = async (o, e) => {
  let r;
  try {
    r = await fetch(o, { signal: e });
  } catch (t) {
    return e.aborted || console.error(`Failed to fetch image: ${t}`), null;
  }
  return r.ok ? await createImageBitmap(await r.blob()) : null;
};
class m {
  constructor(e) {
    l(this, "worker");
    l(this, "pendingRequests");
    l(this, "handleMessage", (e) => {
      const { url: r, buffer: t, error: i } = e.data;
      if (i)
        console.error(`Error processing tile ${r}:`, i);
      else {
        const a = this.pendingRequests.get(r);
        a && (a.resolve({ data: new Uint8Array(t) }), this.pendingRequests.delete(r));
      }
    });
    l(this, "handleError", (e) => {
      console.error("Worker error:", e), this.pendingRequests.forEach((r) => {
        r.reject(new Error("Worker error occurred"));
      }), this.pendingRequests.clear();
    });
    this.worker = e, this.pendingRequests = /* @__PURE__ */ new Map(), this.worker.addEventListener("message", this.handleMessage), this.worker.addEventListener("error", this.handleError);
  }
  async request(e, r) {
    const t = await p(e, r.signal);
    return t ? new Promise((i, a) => {
      this.pendingRequests.set(e, { resolve: i, reject: a, controller: r }), this.worker.postMessage({ image: t, url: e }), r.signal.onabort = () => {
        this.pendingRequests.delete(e), a(new Error("Request aborted"));
      };
    }) : Promise.reject(new Error("Failed to load image"));
  }
}
const f = new Blob([d], { type: "application/javascript" }), E = new Worker(URL.createObjectURL(f)), _ = new m(E), v = (o, e = {}) => {
  var t, i, a, n;
  return o("gsidem", (s, g) => {
    const c = s.url.replace("gsidem://", "");
    return _.request(c, g);
  }), {
    type: "raster-dem",
    tiles: [`gsidem://${(t = e.tileUrl) != null ? t : "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png"}`],
    tileSize: 256,
    minzoom: (i = e.minzoom) != null ? i : 1,
    maxzoom: (a = e.maxzoom) != null ? a : 14,
    attribution: (n = e.attribution) != null ? n : '<a href="https://maps.gsi.go.jp/development/ichiran.html">\u5730\u7406\u9662\u30BF\u30A4\u30EB</a>'
  };
};
export {
  v as useGsiTerrainSource
};

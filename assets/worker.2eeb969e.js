(function(){"use strict";const h=`#version 300 es
    in vec4 a_position;
    out vec2 v_tex_coord;

    void main() {
        gl_Position = a_position;
        v_tex_coord = vec2(a_position.x * 0.5 + 0.5, a_position.y * -0.5 + 0.5);
    }
`,f=`#version 300 es
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
`;let e=null,r=null,c=null,l=null;const g=_=>{if(e=_.getContext("webgl2"),!e)throw new Error("WebGL not supported");const i=(t,T,d)=>{const a=t.createShader(T);return a?(t.shaderSource(a,d),t.compileShader(a),t.getShaderParameter(a,t.COMPILE_STATUS)?a:(console.error("An error occurred compiling the shaders: "+t.getShaderInfoLog(a)),t.deleteShader(a),null)):(console.error("Unable to create shader"),null)},n=i(e,e.VERTEX_SHADER,h),o=i(e,e.FRAGMENT_SHADER,f);if(!n||!o)throw new Error("Failed to load shaders");if(r=e.createProgram(),!r)throw new Error("Failed to create program");if(e.attachShader(r,n),e.attachShader(r,o),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw console.error("Unable to initialize the shader program: "+e.getProgramInfoLog(r)),new Error("Failed to link program");c=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,c);const u=new Float32Array([-1,-1,1,-1,-1,1,1,1]);e.bufferData(e.ARRAY_BUFFER,u,e.STATIC_DRAW);const s=e.getAttribLocation(r,"a_position");e.enableVertexAttribArray(s),e.vertexAttribPointer(s,2,e.FLOAT,!1,0,0),l=e.getUniformLocation(r,"u_height_map")},E=new OffscreenCanvas(256,256);self.onmessage=async _=>{const{url:i,image:n}=_.data;try{if(e||g(E),!e||!r||!c||!l)throw new Error("WebGL initialization failed");const o=e.createTexture();e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,o),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.useProgram(r),e.uniform1i(l,0),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4);const u=await E.convertToBlob();if(!u)throw new Error("Failed to convert canvas to blob");const s=await u.arrayBuffer();self.postMessage({url:i,buffer:s})}catch(o){o instanceof Error&&self.postMessage({url:i,error:o.message})}}})();

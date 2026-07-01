// HktGaussianSplat Web — WebGL2 인스턴스드 쿼드 렌더러
// 스플랫 데이터를 RGBA32F 텍스처(4 texel/splat)에 담고, 정렬된 인덱스로
// 인스턴스 드로우. VS 에서 EWA 2D 공분산 투영, PS 에서 가우시안 falloff.

(function (global) {
	'use strict';

	const VERT = `#version 300 es
	precision highp float;
	precision highp int;

	uniform sampler2D uData;
	uniform int  uTexWidth;
	uniform mat4 uView;
	uniform mat4 uProj;
	uniform vec2 uFocal;      // 픽셀 초점거리
	uniform vec2 uViewport;   // 픽셀
	uniform float uOpacityScale;
	uniform float uPointScale;

	in uint aIndex;

	out vec2 vQuad;   // 가우시안 좌표 (±2)
	out vec4 vColor;

	vec4 texel(int i) { return texelFetch(uData, ivec2(i % uTexWidth, i / uTexWidth), 0); }

	void main() {
		int b = int(aIndex) * 4;
		vec4 t0 = texel(b);     // pos.xyz, opacity
		vec4 t1 = texel(b + 1); // color.rgb
		vec4 t2 = texel(b + 2); // covXX,covXY,covXZ,covYY
		vec4 t3 = texel(b + 3); // covYZ,covZZ

		vec3 center = t0.xyz;
		vec4 cam  = uView * vec4(center, 1.0);
		vec4 clip = uProj * cam;
		if (clip.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

		// 월드 3D 공분산
		mat3 Vrk = mat3(
			t2.x, t2.y, t2.z,
			t2.y, t2.w, t3.x,
			t2.z, t3.x, t3.y);

		// 원근 야코비안 (OpenGL view: 카메라 -Z, y-flip)
		mat3 J = mat3(
			uFocal.x / cam.z, 0.0, -(uFocal.x * cam.x) / (cam.z * cam.z),
			0.0, -uFocal.y / cam.z, (uFocal.y * cam.y) / (cam.z * cam.z),
			0.0, 0.0, 0.0);

		mat3 W = transpose(mat3(uView));
		mat3 T = W * J;
		mat3 cov = transpose(T) * Vrk * T;

		vec2 diag = vec2(cov[0][0], cov[1][1]) + 0.3;   // 저역통과(AA)
		float off = cov[0][1];
		float mid = 0.5 * (diag.x + diag.y);
		float rad = length(vec2((diag.x - diag.y) * 0.5, off));
		float l1 = mid + rad;
		float l2 = max(mid - rad, 0.1);

		vec2 dv = normalize(vec2(off, l1 - diag.x));
		vec2 major = min(sqrt(2.0 * l1), 1024.0) * dv * uPointScale;
		vec2 minor = min(sqrt(2.0 * l2), 1024.0) * vec2(dv.y, -dv.x) * uPointScale;

		// triangle strip 코너: (-2,-2),(2,-2),(-2,2),(2,2)
		vec2 corner = vec2(
			(gl_VertexID & 1) == 0 ? -2.0 : 2.0,
			(gl_VertexID & 2) == 0 ? -2.0 : 2.0);

		vec2 ndcCenter = clip.xy / clip.w;
		vec2 offset = (corner.x * major + corner.y * minor) / uViewport;
		gl_Position = vec4(ndcCenter + offset, 0.0, 1.0);

		vQuad = corner;
		vColor = vec4(t1.rgb, t0.w * uOpacityScale);
	}`;

	const FRAG = `#version 300 es
	precision highp float;
	in vec2 vQuad;
	in vec4 vColor;
	out vec4 outColor;
	void main() {
		float A = -dot(vQuad, vQuad);
		if (A < -4.0) discard;
		float B = exp(A) * vColor.a;
		if (B < 0.004) discard;
		outColor = vec4(vColor.rgb * B, B);  // premultiplied
	}`;

	function compile(gl, type, src) {
		const s = gl.createShader(type);
		gl.shaderSource(s, src.replace(/\n\t\t/g, '\n'));
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
			throw new Error('셰이더 컴파일 실패:\n' + gl.getShaderInfoLog(s));
		}
		return s;
	}

	function HktSplatRenderer(canvas) {
		const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
		if (!gl) throw new Error('WebGL2 미지원 브라우저입니다');
		this.gl = gl;
		this.canvas = canvas;
		this.count = 0;
		this.texWidth = 2048;

		const prog = gl.createProgram();
		gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			throw new Error('프로그램 링크 실패:\n' + gl.getProgramInfoLog(prog));
		}
		this.prog = prog;
		this.u = {
			data: gl.getUniformLocation(prog, 'uData'),
			texWidth: gl.getUniformLocation(prog, 'uTexWidth'),
			view: gl.getUniformLocation(prog, 'uView'),
			proj: gl.getUniformLocation(prog, 'uProj'),
			focal: gl.getUniformLocation(prog, 'uFocal'),
			viewport: gl.getUniformLocation(prog, 'uViewport'),
			opacityScale: gl.getUniformLocation(prog, 'uOpacityScale'),
			pointScale: gl.getUniformLocation(prog, 'uPointScale'),
		};
		this.aIndex = gl.getAttribLocation(prog, 'aIndex');

		this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		this.indexBuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.indexBuf);
		gl.enableVertexAttribArray(this.aIndex);
		gl.vertexAttribIPointer(this.aIndex, 1, gl.UNSIGNED_INT, 0, 0);
		gl.vertexAttribDivisor(this.aIndex, 1);
		gl.bindVertexArray(null);

		this.dataTex = gl.createTexture();

		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.blendEquation(gl.FUNC_ADD);
		gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	}

	// texData: Float32Array(count*16) — 4 RGBA32F texel/splat
	HktSplatRenderer.prototype.setCloud = function (count, texData) {
		const gl = this.gl;
		this.count = count;
		const texW = this.texWidth;
		const texH = Math.ceil((count * 4) / texW);
		const padded = new Float32Array(texW * texH * 4);
		padded.set(texData.subarray(0, Math.min(texData.length, padded.length)));

		gl.bindTexture(gl.TEXTURE_2D, this.dataTex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, texW, texH, 0, gl.RGBA, gl.FLOAT, padded);

		// 초기 인덱스(정렬 전 항등)
		const order = new Uint32Array(count);
		for (let i = 0; i < count; i++) order[i] = i;
		this.setIndices(order);
	};

	HktSplatRenderer.prototype.setIndices = function (order) {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.indexBuf);
		gl.bufferData(gl.ARRAY_BUFFER, order, gl.DYNAMIC_DRAW);
		this.drawCount = order.length;
	};

	HktSplatRenderer.prototype.render = function (view, proj, opt) {
		const gl = this.gl;
		const W = this.canvas.width, H = this.canvas.height;
		gl.viewport(0, 0, W, H);
		const bg = opt.bg != null ? opt.bg : 0.04;
		gl.clearColor(bg, bg, bg * 1.1, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if (!this.count || !this.drawCount) return;

		gl.useProgram(this.prog);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.dataTex);
		gl.uniform1i(this.u.data, 0);
		gl.uniform1i(this.u.texWidth, this.texWidth);
		gl.uniformMatrix4fv(this.u.view, false, view);
		gl.uniformMatrix4fv(this.u.proj, false, proj);
		// 초점거리(px) = 0.5 · 뷰포트 · proj 대각
		gl.uniform2f(this.u.focal, 0.5 * W * proj[0], 0.5 * H * proj[5]);
		gl.uniform2f(this.u.viewport, W, H);
		gl.uniform1f(this.u.opacityScale, opt.opacityScale != null ? opt.opacityScale : 1);
		gl.uniform1f(this.u.pointScale, opt.pointScale != null ? opt.pointScale : 1);

		gl.bindVertexArray(this.vao);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.drawCount);
		gl.bindVertexArray(null);
	};

	global.HktSplatRenderer = HktSplatRenderer;
})(window);

// HktGaussianSplat Web — 행렬 유틸 + 오빗 카메라 (의존성 없음, classic script)
// 모든 mat4 는 column-major Float32Array(16) — WebGL 규약.

(function (global) {
	'use strict';

	const HktMat = {
		create() {
			const m = new Float32Array(16);
			m[0] = m[5] = m[10] = m[15] = 1;
			return m;
		},

		perspective(fovyRad, aspect, near, far) {
			const f = 1 / Math.tan(fovyRad / 2);
			const nf = 1 / (near - far);
			const m = new Float32Array(16);
			m[0] = f / aspect;
			m[5] = f;
			m[10] = (far + near) * nf;
			m[11] = -1;
			m[14] = 2 * far * near * nf;
			return m;
		},

		// 오른손 lookAt → world→view (OpenGL 규약: 카메라는 -Z 를 본다)
		lookAt(eye, center, up) {
			const [ex, ey, ez] = eye;
			let zx = ex - center[0], zy = ey - center[1], zz = ez - center[2];
			let rl = 1 / Math.hypot(zx, zy, zz); zx *= rl; zy *= rl; zz *= rl;
			let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
			rl = 1 / (Math.hypot(xx, xy, xz) || 1); xx *= rl; xy *= rl; xz *= rl;
			const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
			const m = new Float32Array(16);
			m[0] = xx; m[4] = xy; m[8] = xz; m[12] = -(xx * ex + xy * ey + xz * ez);
			m[1] = yx; m[5] = yy; m[9] = yz; m[13] = -(yx * ex + yy * ey + yz * ez);
			m[2] = zx; m[6] = zy; m[10] = zz; m[14] = -(zx * ex + zy * ey + zz * ez);
			m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1;
			return m;
		},
	};

	// 타겟 주위를 도는 오빗 카메라. yaw/pitch/radius + pan 오프셋.
	function HktOrbitCamera(canvas) {
		this.target = [0, 0, 0];
		this.yaw = 0.6;
		this.pitch = 0.3;
		this.radius = 5;
		this.fov = 60 * Math.PI / 180;
		this.up = [0, 1, 0];
		this._dirty = true;
		this._bind(canvas);
	}

	HktOrbitCamera.prototype._bind = function (canvas) {
		let dragging = 0, lx = 0, ly = 0;
		const self = this;

		canvas.addEventListener('contextmenu', (e) => e.preventDefault());
		canvas.addEventListener('pointerdown', (e) => {
			dragging = (e.button === 2 || e.shiftKey) ? 2 : 1;
			lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId);
		});
		canvas.addEventListener('pointerup', (e) => {
			dragging = 0; try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
		});
		canvas.addEventListener('pointermove', (e) => {
			if (!dragging) return;
			const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
			if (dragging === 1) {
				self.yaw -= dx * 0.005;
				self.pitch -= dy * 0.005;
				const lim = Math.PI / 2 - 0.01;
				self.pitch = Math.max(-lim, Math.min(lim, self.pitch));
			} else {
				// 화면 평면 이동 (pan)
				const s = self.radius * 0.0015;
				const right = self._right(), upv = self._camUp();
				for (let i = 0; i < 3; i++) self.target[i] += -right[i] * dx * s + upv[i] * dy * s;
			}
			self._dirty = true;
		});
		canvas.addEventListener('wheel', (e) => {
			e.preventDefault();
			self.radius *= Math.exp(e.deltaY * 0.001);
			self.radius = Math.max(0.05, Math.min(1e5, self.radius));
			self._dirty = true;
		}, { passive: false });
	};

	HktOrbitCamera.prototype._eye = function () {
		const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
		const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
		return [
			this.target[0] + this.radius * cp * sy,
			this.target[1] + this.radius * sp,
			this.target[2] + this.radius * cp * cy,
		];
	};
	HktOrbitCamera.prototype._right = function () {
		const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
		return [cy, 0, -sy];
	};
	HktOrbitCamera.prototype._camUp = function () { return [0, 1, 0]; };

	HktOrbitCamera.prototype.view = function () {
		return HktMat.lookAt(this._eye(), this.target, this.up);
	};
	HktOrbitCamera.prototype.proj = function (aspect) {
		return HktMat.perspective(this.fov, aspect, 0.01, 1e6);
	};
	// 대상 바운드에 맞춰 초기 프레이밍
	HktOrbitCamera.prototype.frame = function (center, radius) {
		this.target = [center[0], center[1], center[2]];
		this.radius = Math.max(0.2, radius * 2.2);
		this._dirty = true;
	};

	global.HktMat = HktMat;
	global.HktOrbitCamera = HktOrbitCamera;
})(window);

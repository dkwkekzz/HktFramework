// HktSplatGenesis — 행렬 유틸 + 오빗 카메라 (의존성 없음, classic script)
// HktGaussianSplatWeb/js/camera.js 를 WebGPU 클립 규약(z ∈ [0,1])에 맞게 개작.
// 모든 mat4 는 column-major Float32Array(16).

(function (global) {
	'use strict';

	const HktMat = {
		// WebGPU 규약 원근 투영: NDC z ∈ [0,1]
		perspective(fovyRad, aspect, near, far) {
			const f = 1 / Math.tan(fovyRad / 2);
			const nf = 1 / (near - far);
			const m = new Float32Array(16);
			m[0] = f / aspect;
			m[5] = f;
			m[10] = far * nf;
			m[11] = -1;
			m[14] = far * near * nf;
			return m;
		},

		// 오른손 lookAt → world→view (카메라는 -Z 를 본다)
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
	// opts.unityControls: 유니티 씬 뷰식 버튼 매핑(우클릭=회전·중클릭=이동·좌클릭=앱 몫).
	//   기본(false)은 index.html 데모용 레거시(좌클릭=회전·우/Shift=이동).
	function HktOrbitCamera(canvas, opts) {
		this.target = [0, 0.8, 0];
		this.yaw = 0.5;
		this.pitch = 0.15;
		this.radius = 5;
		this.fov = 55 * Math.PI / 180;
		this.up = [0, 1, 0];
		this.unityControls = !!(opts && opts.unityControls);
		this._bind(canvas);
	}

	HktOrbitCamera.prototype._bind = function (canvas) {
		let dragging = 0, lx = 0, ly = 0;
		const self = this;

		canvas.addEventListener('contextmenu', (e) => e.preventDefault());
		canvas.addEventListener('pointerdown', (e) => {
			if (e.altKey) return; // Alt+드래그는 인력 상호작용(app.js) 몫
			if (self.unityControls) {
				// 유니티 씬 뷰 관례: 우클릭=회전(orbit), 중클릭=이동(pan), 휠=줌.
				// 좌클릭은 에디터(선택/배치/기즈모 드래그) 몫이라 카메라는 건드리지 않는다.
				// Shift+좌클릭은 3버튼 마우스가 없는 환경을 위한 pan 대체.
				if (e.button === 2) dragging = 1;                     // 우클릭 = 회전
				else if (e.button === 1) dragging = 2;                // 중클릭 = 이동(pan)
				else if (e.button === 0 && e.shiftKey) dragging = 2;  // Shift+좌클릭 = 이동 대체
				else return;                                          // 좌클릭 = 에디터 몫
			} else {
				// 레거시(index.html 데모): 좌클릭=회전, 우클릭·Shift=이동
				dragging = (e.button === 2 || e.shiftKey) ? 2 : 1;
			}
			e.preventDefault(); // 중클릭 자동 스크롤/좌클릭 텍스트 선택 억제
			lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId);
		});
		// 중클릭 auxclick(브라우저 자동 스크롤 트리거) 차단
		canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
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
				const cy = Math.cos(self.yaw), sy = Math.sin(self.yaw);
				const right = [cy, 0, -sy];
				for (let i = 0; i < 3; i++) self.target[i] += -right[i] * dx * s;
				self.target[1] += dy * s;
			}
		});
		canvas.addEventListener('wheel', (e) => {
			e.preventDefault();
			self.radius *= Math.exp(e.deltaY * 0.001);
			self.radius = Math.max(0.2, Math.min(500, self.radius));
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

	HktOrbitCamera.prototype.view = function () {
		return HktMat.lookAt(this._eye(), this.target, this.up);
	};
	HktOrbitCamera.prototype.proj = function (aspect) {
		return HktMat.perspective(this.fov, aspect, 0.05, 1000);
	};

	global.HktMat = HktMat;
	global.HktOrbitCamera = HktOrbitCamera;
})(window);

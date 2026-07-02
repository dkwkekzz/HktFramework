// HktSplatGenesis — 뼈대(Skeleton IR) + 살 문법(flesh grammar)  · L6
//
// hikito-flesh 이식: "뼈대를 먼저 정의하고, 살을 뼈대의 순수 함수(SDF)로 자라게 한다."
//  1) Skeleton IR   : joints[{name, parent, offset}] + 절차 클립 회전 → world FK
//                     (CPU, 관절 ~23개 — three.js 없이 자체 3x3 행렬)
//  2) Flesh grammar : radiusForName(name) — 이름으로 반지름. 이게 "일관된 스타일"의 정의.
//                     Mixamo 접두어는 떼고 매칭, 미지의 뼈는 기본값 → 임의 리그도 안 깨진다.
//  3) 살(flesh)     : 여기가 hikito-flesh 와 갈라지는 곳 — 레이마칭으로 "그리지" 않는다.
//                     뼈대는 매 프레임 taper 캡슐 세그먼트로 GPU 에 올라가는 순수 입력이고,
//                     스플랫 세포가 SDF 등고면으로 끌려가 *자란다* (wgsl.js SIM 의 fleshK 규칙).
//                     스플랫-뼈 손 바인딩(스키닝)은 없다 — 뼈대가 움직이면 살이 지연 추종한다.

(function (global) {
	'use strict';

	// ── (2) 살 문법: 이름 → 반지름 ─────────────────────────────────────────
	function simpleName(n) { return n.replace(/^mixamorig:?/i, ''); }
	function radiusForName(name) {
		const n = simpleName(name), has = (s) => n.indexOf(s) >= 0;
		if (n === 'Hips') return 0.135;
		if (has('Spine2')) return 0.15;
		if (has('Spine1')) return 0.14;
		if (has('Spine'))  return 0.13;
		if (has('Neck'))   return 0.055;
		if (has('HeadTop') || has('_End')) return 0.065;
		if (has('Head'))   return 0.12;
		if (has('Shoulder')) return 0.055;
		if (has('ForeArm')) return 0.05;
		if (has('Arm'))    return 0.062;
		if (has('Hand'))   return 0.05;
		if (has('UpLeg'))  return 0.10;
		if (has('Leg'))    return 0.078;
		if (has('ToeBase') || has('Toe')) return 0.035;
		if (has('Foot'))   return 0.052;
		return 0.05; // 미지의 뼈 → 기본값
	}

	// ── (1) Skeleton IR: 휴머노이드 계층 (T-pose, 단위 ~m, 발끝 y≈0) ────────
	// Mixamo 표준 계층에서 손가락만 뺐다 — 스플랫 셀 해상도(격자 0.15) 이하의 디테일.
	function buildHumanoidRig() {
		const J = []; const idx = {};
		const add = (name, parent, ox, oy, oz) => {
			idx[name] = J.length;
			J.push({ name, parent: parent == null ? -1 : idx[parent], offset: [ox, oy, oz] });
		};
		add('Hips', null, 0, 0.98, 0);
		add('Spine', 'Hips', 0, 0.11, 0);
		add('Spine1', 'Spine', 0, 0.12, 0);
		add('Spine2', 'Spine1', 0, 0.12, 0);
		add('Neck', 'Spine2', 0, 0.12, 0.01);
		add('Head', 'Neck', 0, 0.07, 0.01);
		add('HeadTop_End', 'Head', 0, 0.15, 0.02);
		for (const [S, x] of [['Left', 1], ['Right', -1]]) {
			add(`${S}Shoulder`, 'Spine2', x * 0.05, 0.09, 0);
			add(`${S}Arm`, `${S}Shoulder`, x * 0.13, 0, 0);
			add(`${S}ForeArm`, `${S}Arm`, x * 0.28, 0, 0);
			add(`${S}Hand`, `${S}ForeArm`, x * 0.25, 0, 0);
			add(`${S}UpLeg`, 'Hips', x * 0.09, -0.06, 0);
			add(`${S}Leg`, `${S}UpLeg`, 0, -0.42, 0);
			add(`${S}Foot`, `${S}Leg`, 0, -0.42, 0);
			add(`${S}ToeBase`, `${S}Foot`, 0, -0.07, 0.14);
		}
		return J;
	}

	// ── 3x3 회전 유틸 (row-major 9칸 배열) — three.js Euler 'XYZ' 와 동일 정식 ──
	function rotXYZ(rx, ry, rz) {
		const cx = Math.cos(rx), sx = Math.sin(rx);
		const cy = Math.cos(ry), sy = Math.sin(ry);
		const cz = Math.cos(rz), sz = Math.sin(rz);
		return [
			cy * cz, -cy * sz, sy,
			cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
			sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
		];
	}
	function mulMat(a, b) {
		const m = new Array(9);
		for (let r = 0; r < 3; r++)
			for (let c = 0; c < 3; c++)
				m[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
		return m;
	}
	function mulVec(m, v) {
		return [
			m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
			m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
			m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
		];
	}

	function Skeleton(defs) {
		this.defs = defs || buildHumanoidRig();
		this.rootIdx = this.defs.findIndex((d) => d.parent < 0);
		this.bindHipY = this.rootIdx >= 0 ? this.defs[this.rootIdx].offset[1] : 0;
		this._wpos = this.defs.map(() => [0, 0, 0]);
		this._wrot = this.defs.map(() => null);
	}

	// ── (3-a) 절차 클립: 이름 기반 회전 — hikito-flesh applyPose 이식 ────────
	Skeleton.prototype._euler = function (n, clip, t, ph) {
		let rx = 0, ry = 0, rz = 0;
		const R = n.startsWith('Right');
		const armDown = 1.30;
		if (clip !== 'wave' || !R) {
			if (n === 'LeftArm') rz = -armDown;
			if (n === 'RightArm') rz = armDown;
		}
		if (clip === 'walk') {
			if (n === 'LeftUpLeg')  rx =  Math.sin(ph) * 0.5;
			if (n === 'RightUpLeg') rx = -Math.sin(ph) * 0.5;
			if (n === 'LeftLeg')  rx = Math.max(0, -Math.sin(ph)) * 0.9;
			if (n === 'RightLeg') rx = Math.max(0,  Math.sin(ph)) * 0.9;
			if (n === 'LeftArm')  rx =  Math.sin(ph) * 0.4;
			if (n === 'RightArm') rx = -Math.sin(ph) * 0.4;
			if (n === 'Spine1') ry = Math.sin(ph) * 0.06;
		} else if (clip === 'idle') {
			if (n === 'Spine1') ry = Math.sin(t * 1.1) * 0.03;
			if (n === 'Head')   ry = Math.sin(t * 0.8) * 0.04;
			if (n === 'LeftArm')  rx = Math.sin(t * 1.1) * 0.05;
			if (n === 'RightArm') rx = Math.sin(t * 1.1 + 0.5) * 0.05;
		} else if (clip === 'wave') {
			if (n === 'RightArm')     { rz = -1.55; rx = 0.2; }
			if (n === 'RightForeArm') { rz = Math.sin(t * 7.0) * 0.5 - 0.2; }
			if (n === 'Spine1') ry = 0.08;
		}
		return [rx, ry, rz];
	};

	// FK 한 바퀴: 클립 포즈 → world 관절 위치 → taper 캡슐 세그먼트 목록
	// (defs 는 부모가 항상 자식보다 먼저 — buildHumanoidRig 가 보장)
	// 반환: [{a:[x,y,z], b:[x,y,z], ra, rb}] — engine.frame 의 bones 입력
	Skeleton.prototype.pose = function (clip, t, speed, fat) {
		const ph = t * speed * 4.0;
		const f = fat || 1.0;
		for (let i = 0; i < this.defs.length; i++) {
			const d = this.defs[i];
			const e = this._euler(simpleName(d.name), clip, t, ph);
			const local = rotXYZ(e[0], e[1], e[2]);
			if (d.parent < 0) {
				const bob = clip === 'walk' ? Math.sin(ph * 2.0) * 0.03
					: clip === 'idle' ? Math.sin(t * 1.1) * 0.008 : 0;
				this._wpos[i] = [d.offset[0], this.bindHipY + bob, d.offset[2]];
				this._wrot[i] = local;
			} else {
				const off = mulVec(this._wrot[d.parent], d.offset);
				const pp = this._wpos[d.parent];
				this._wpos[i] = [pp[0] + off[0], pp[1] + off[1], pp[2] + off[2]];
				this._wrot[i] = mulMat(this._wrot[d.parent], local);
			}
		}
		const segs = [];
		for (let i = 0; i < this.defs.length; i++) {
			const p = this.defs[i].parent;
			if (p < 0) continue;
			const a = this._wpos[p], b = this._wpos[i];
			const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
			if (dx * dx + dy * dy + dz * dz < 1e-8) continue;
			segs.push({
				a, b,
				ra: radiusForName(this.defs[p].name) * f,
				rb: radiusForName(this.defs[i].name) * f,
			});
		}
		return segs;
	};

	global.HktGenesisSkeleton = { Skeleton, buildHumanoidRig, radiusForName };
})(window);

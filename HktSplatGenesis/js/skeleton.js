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
	// 기본 문법(base grammar): 이름 → 반지름. C1 부터 이 위에 게놈 배율이 곱해진다
	// (radiusG 참조) — 이 함수 자체는 스타일의 정의라 데이터화하지 않고 코드로 남긴다.
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
		if (has('Thumb') || has('Index') || has('Middle') || has('Ring') || has('Pinky') || has('Finger')) return 0.014;
		return 0.05; // 미지의 뼈 → 기본값
	}
	function isFinger(name) { return /Thumb|Index|Middle|Ring|Pinky|Finger/.test(simpleName(name)); }

	// 살 문법 × 게놈 배율 (C1: 형태 게놈 ①). 게놈 없음/항등 → 기본 문법 그대로(회귀 0).
	// HktGenesisGenome 미로드 시에도 안전하게 기본 문법으로 폴백한다 (rig-agnostic).
	function radiusG(name, genome, fat) {
		const G = global.HktGenesisGenome;
		const mul = (G && genome) ? G.radiusScale(genome, name) : 1;
		return radiusForName(name) * (fat || 1.0) * mul;
	}
	// 뼈 길이 배율 (C2: 형태 게놈 ①). FK offset 에 곱한다 — 클립(로컬 회전)과 직교라
	// 회전 데이터는 어떤 비율에도 무수정 적용된다 (애니메이션 보존).
	function lengthG(name, genome) {
		const G = global.HktGenesisGenome;
		return (G && genome) ? G.lengthScale(genome, name) : 1;
	}
	// 뼈 → 부위 그룹 id (C3: 채색 ②). 세그먼트에 실어 GPU boneGroup 테이블로 올라간다.
	// HktGenesisGenome 미로드 시 'other'(마지막 인덱스)로 폴백.
	function groupIdOf(name) {
		const G = global.HktGenesisGenome;
		return G ? G.groupId(name) : 9;
	}
	// 힙 보정 (C2): 다리 길이 배율로 발이 뚫리거나 뜨지 않게 루트 y 를 보정한다.
	// 대표 발(왼쪽 Toe/Foot)에서 루트까지 offset.y × (1 − 길이배율) 을 누적 —
	// 다리가 짧으면(배율<1) 양수 → 힙 하강, 길면 음수 → 힙 상승. rest 포즈 근사(PLAN 정식).
	function hipYCorrection(defs, genome) {
		const G = global.HktGenesisGenome;
		if (!G || !genome) return 0;
		let leaf = -1;
		for (let i = 0; i < defs.length; i++) {
			const n = simpleName(defs[i].name);
			if (/^Left/.test(n) && (n.indexOf('Toe') >= 0 || n.indexOf('Foot') >= 0)) leaf = i;
		}
		if (leaf < 0) return 0;
		let corr = 0, i = leaf;
		while (i >= 0 && defs[i].parent >= 0) {
			corr += defs[i].offset[1] * (1 - G.lengthScale(genome, defs[i].name));
			i = defs[i].parent;
		}
		return corr;
	}

	// ── (1) Skeleton IR: 휴머노이드 계층 (T-pose, 단위 ~m, 발끝 y≈0) ────────
	// hikito-flesh buildMixamoRig 와 동일 계층 (손가락 포함, 접두어만 생략).
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
			const fingers = [['Thumb', 0.55, 0.03], ['Index', 0.14, 0.04], ['Middle', -0.02, 0.045], ['Ring', -0.16, 0.04], ['Pinky', -0.30, 0.032]];
			for (const [fn, ang, len] of fingers) {
				const zoff = Math.sin(ang) * 0.03;
				add(`${S}Hand${fn}1`, `${S}Hand`, x * (len * 0.5), 0, zoff * 3.0);
				add(`${S}Hand${fn}2`, `${S}Hand${fn}1`, x * len, 0, 0);
				add(`${S}Hand${fn}3`, `${S}Hand${fn}2`, x * len * 0.8, 0, 0);
			}
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
	// 반환: [{a:[x,y,z], b:[x,y,z], ra, rb}] — engine.frame 의 bones 입력이자
	// setScene 의 bindBones 입력. 순서가 뼈 친화(rest.w) 인덱스의 기준이므로
	// 포즈와 무관하게 항상 전체 세그먼트를 같은 순서로 반환한다 (필터 금지).
	Skeleton.prototype.pose = function (clip, t, speed, fat, genome) {
		const ph = t * speed * 4.0;
		const f = fat || 1.0;
		const hipCorr = hipYCorrection(this.defs, genome); // C2: 다리 길이 배율 → 힙 y 보정
		for (let i = 0; i < this.defs.length; i++) {
			const d = this.defs[i];
			const e = this._euler(simpleName(d.name), clip, t, ph);
			const local = rotXYZ(e[0], e[1], e[2]);
			if (d.parent < 0) {
				const bob = clip === 'walk' ? Math.sin(ph * 2.0) * 0.03
					: clip === 'idle' ? Math.sin(t * 1.1) * 0.008 : 0;
				this._wpos[i] = [d.offset[0], this.bindHipY + bob + hipCorr, d.offset[2]];
				this._wrot[i] = local;
			} else {
				// C2: offset × 길이 배율 (회전 뒤). 클립 회전과 직교라 클립 무수정.
				const s = lengthG(d.name, genome);
				const off = mulVec(this._wrot[d.parent], [d.offset[0] * s, d.offset[1] * s, d.offset[2] * s]);
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
				ra: radiusG(this.defs[p].name, genome, f),
				rb: radiusG(this.defs[i].name, genome, f),
				g: groupIdOf(this.defs[i].name), // C3: 자식 뼈 기준 부위 그룹
			});
		}
		return segs;
	};

	// ── (3-b) 외부 리그: Mixamo FBX 드롭 — vendor/three.min.js 는 FBX 파싱/FK 전용.
	// 렌더·시뮬은 여전히 자체 WebGPU 파이프라인 — three 는 뼈대라는 *입력* 만 만든다.
	// 이름 기반 문법 덕에 어떤 리그든 같은 스타일로 살이 붙는다 (rig-agnostic).
	function ExternalSkeleton(object3d) {
		this.root = object3d;
		let bones = [];
		object3d.traverse((o) => { if (o.isBone) bones.push(o); });
		if (!bones.length) object3d.traverse((o) => { if (o.isSkinnedMesh) bones = o.skeleton.bones; });
		this.bones = bones;
		// 스케일 정규화(Mixamo 100배) + 중심 재배치 + 발 높이 — hikito-flesh 와 동일 정식
		const box = new THREE.Box3().setFromObject(object3d);
		const size = new THREE.Vector3();
		box.getSize(size);
		this.scale = 1.7 / Math.max(size.y, 1e-3);
		this.center = new THREE.Vector3();
		box.getCenter(this.center);
		this.mixer = null;
		this.clipName = '';
		if (object3d.animations && object3d.animations.length) {
			this.mixer = new THREE.AnimationMixer(object3d);
			this.mixer.clipAction(object3d.animations[0]).play();
			this.clipName = object3d.animations[0].name || '';
		}
		this._wp = new THREE.Vector3();
		this._wpp = new THREE.Vector3();
	}
	ExternalSkeleton.prototype.valid = function () { return this.bones.length > 0; };
	// 클립을 dt·speed 만큼 진행하고 세그먼트 추출.
	// 순서는 bones 배열 고정 — 뼈 친화(rest.w) 인덱스의 기준이므로 포즈별 필터 금지.
	ExternalSkeleton.prototype.pose = function (dt, speed, fat, genome) {
		if (this.mixer && dt > 0) this.mixer.update(dt * (speed || 1));
		this.root.updateMatrixWorld(true);
		const f = fat || 1.0;
		const segs = [];
		for (const bone of this.bones) {
			if (!bone.parent || !bone.parent.isBone) continue; // 루트 제외 (리그 구조상 고정)
			bone.getWorldPosition(this._wp);
			bone.parent.getWorldPosition(this._wpp);
			segs.push({
				a: [
					(this._wpp.x - this.center.x) * this.scale,
					(this._wpp.y - this.center.y) * this.scale + 0.98,
					(this._wpp.z - this.center.z) * this.scale,
				],
				b: [
					(this._wp.x - this.center.x) * this.scale,
					(this._wp.y - this.center.y) * this.scale + 0.98,
					(this._wp.z - this.center.z) * this.scale,
				],
				ra: radiusG(bone.parent.name, genome, f),
				rb: radiusG(bone.name, genome, f),
				g: groupIdOf(bone.name), // C3: 자식 뼈 기준 부위 그룹
			});
		}
		return segs;
	};

	// FBX 바이너리 → ExternalSkeleton (vendor 스크립트 미로드/스켈레톤 부재 시 throw)
	function parseFBX(buffer) {
		if (typeof THREE === 'undefined' || !THREE.FBXLoader) throw new Error('vendor/three.min.js 가 로드되지 않았습니다');
		const obj = new THREE.FBXLoader().parse(buffer, '');
		const ext = new ExternalSkeleton(obj);
		if (!ext.valid()) throw new Error('FBX 에서 스켈레톤을 찾지 못했습니다');
		return ext;
	}

	global.HktGenesisSkeleton = { Skeleton, ExternalSkeleton, parseFBX, buildHumanoidRig, radiusForName, radiusG, isFinger };
})(window);

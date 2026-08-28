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
	// HktGenesisGenome 미로드 시 -1 — engine 이 그룹 미상(-1/null)을 'other'(GROUP_COUNT-1)로 흡수.
	function groupIdOf(name) {
		const G = global.HktGenesisGenome;
		return G ? G.groupId(name) : -1;
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

	// A 트랙: built-in 절차 점프 원샷 — 소요 시간·도약 높이 (애니메이션 상수, armDown 과 같은 급).
	const JUMP_DUR = 0.75, JUMP_H = 0.5;

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

	// ── (3-c) C4 부속 리그: 가상 뼈 스프링 체인 — 리그에 없는 꼬리/뿔/귀/망토 ──
	// 클립은 가상 뼈를 모른다(클립 데이터 무수정) — 부착 관절의 world 변환에 매달린
	// 스프링 체인이 지연 추종으로 움직임을 만든다 (L6 살의 출렁임과 같은 미학).
	// 불변: 가상 뼈 세그먼트는 항상 실뼈 세그먼트 *뒤에* 고정 순서로 append —
	// "세그먼트 순서 = 뼈 친화(rest.w) 인덱스" 규약 유지. 부속 정의가 바뀌면 세그먼트
	// 수가 변하므로 호출측은 재시드(bindBones 재계산)해야 한다.
	function AppendixRig() { this.sig = ''; this.chains = []; this.lastT = null; }
	// 게놈 ④ 와 동기 — 정의가 바뀌면 체인 상태를 버리고 재구축(강체 목표 재시드).
	AppendixRig.prototype.sync = function (genome) {
		const G = global.HktGenesisGenome;
		const defs = (G && genome && G.chains) ? G.chains(genome) : [];
		const sig = JSON.stringify(defs);
		if (sig !== this.sig) {
			this.sig = sig;
			this.chains = defs.map((def) => ({ def, p: null, v: null }));
		}
		return this.chains;
	};
	// 한 스텝: 부착점(aPos)+회전(aRot, row-major 3x3)의 강체 목표를 스프링 추종.
	// p 미초기화(재시드 직후)면 강체 목표에 정지 상태로 놓는다 — 결정론(t=0 bind 포함).
	// 스프링(k) + 감쇠(damp, 기본 임계 2√k) + 중력, 이후 마디 길이 구속(뿌리→끝) —
	// 실루엣(총 길이)은 고정한 채 굽힘(잔상 곡선)만 남긴다.
	AppendixRig.prototype.step = function (chain, dt, aPos, aRot) {
		const def = chain.def, n = def.links, ll = def.len / n;
		const dw = aRot ? mulVec(aRot, def.dir) : def.dir.slice();
		if (!chain.p) {
			chain.p = []; chain.v = [];
			for (let i = 0; i < n; i++) {
				chain.p.push([aPos[0] + dw[0] * ll * (i + 1), aPos[1] + dw[1] * ll * (i + 1), aPos[2] + dw[2] * ll * (i + 1)]);
				chain.v.push([0, 0, 0]);
			}
		}
		if (dt > 0) {
			for (let i = 0; i < n; i++) {
				const tx = aPos[0] + dw[0] * ll * (i + 1), ty = aPos[1] + dw[1] * ll * (i + 1), tz = aPos[2] + dw[2] * ll * (i + 1);
				const p = chain.p[i], v = chain.v[i];
				v[0] += (def.k * (tx - p[0]) - def.damp * v[0]) * dt;
				v[1] += (def.k * (ty - p[1]) - def.damp * v[1] - def.gravity) * dt;
				v[2] += (def.k * (tz - p[2]) - def.damp * v[2]) * dt;
				p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
			}
		}
		// 길이 구속 — 체인은 늘어나지 않는다 (마디 수 × ll = 총 길이 불변)
		let prev = aPos;
		for (let i = 0; i < n; i++) {
			const p = chain.p[i];
			const dx = p[0] - prev[0], dy = p[1] - prev[1], dz = p[2] - prev[2];
			const d = Math.hypot(dx, dy, dz) || 1;
			p[0] = prev[0] + dx / d * ll; p[1] = prev[1] + dy / d * ll; p[2] = prev[2] + dz / d * ll;
			prev = p;
		}
	};
	// 체인 → 세그먼트 append. 반지름은 뿌리→끝 프로파일(r0→r1) × fat × 게놈 배율
	// (체인 이름이 'appendix' 그룹으로 분류되므로 morph.appendix.r 이 그대로 먹는다).
	// def.group 명시 시 채색 그룹을 그 부위로 — 얼굴 패널처럼 'appendix' 색이 아닌 체인용.
	AppendixRig.prototype.appendSegs = function (segs, chain, aPos, genome, f) {
		const def = chain.def, n = def.links;
		const G = global.HktGenesisGenome;
		const mul = (G && genome) ? G.radiusScale(genome, def.name) : 1;
		const gOverride = (def.group && G) ? G.GROUP_IDS.indexOf(def.group) : -1;
		const g = gOverride >= 0 ? gOverride : groupIdOf(def.name);
		const rAt = (u) => (def.r0 + (def.r1 - def.r0) * u) * (f || 1) * mul;
		let prev = aPos;
		for (let i = 0; i < n; i++) {
			segs.push({ a: prev, b: chain.p[i], ra: rAt(i / n), rb: rAt((i + 1) / n), g });
			prev = chain.p[i];
		}
	};

	function Skeleton(defs) {
		this.defs = defs || buildHumanoidRig();
		this.rootIdx = this.defs.findIndex((d) => d.parent < 0);
		this.bindHipY = this.rootIdx >= 0 ? this.defs[this.rootIdx].offset[1] : 0;
		this._wpos = this.defs.map(() => [0, 0, 0]);
		this._wrot = this.defs.map(() => null);
		this._appendix = new AppendixRig();
	}
	// 부착 관절 해석: simpleName 완전 일치 → 포함 → 루트 폴백 (rig-agnostic).
	Skeleton.prototype._jointIdx = function (name) {
		let contains = -1;
		for (let i = 0; i < this.defs.length; i++) {
			const n = simpleName(this.defs[i].name);
			if (n === name) return i;
			if (contains < 0 && n.indexOf(name) >= 0) contains = i;
		}
		return contains >= 0 ? contains : this.rootIdx;
	};

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
		} else if (clip === 'jump') {
			// 원샷: t 는 클립 로컬 시각. bell(0→1→0) 로 도약 중 무릎 당김·팔 들기.
			const bell = Math.sin(Math.min(t / JUMP_DUR, 1) * Math.PI);
			if (n === 'LeftUpLeg' || n === 'RightUpLeg') rx = -0.6 * bell;
			if (n === 'LeftLeg'  || n === 'RightLeg')    rx =  1.0 * bell;
			if (n === 'LeftArm')  rz = -armDown + 0.7 * bell;
			if (n === 'RightArm') rz =  armDown - 0.7 * bell;
			if (n === 'Spine1') rx = -0.12 * bell;
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
					: clip === 'idle' ? Math.sin(t * 1.1) * 0.008
					: clip === 'jump' ? JUMP_H * 4 * Math.min(t / JUMP_DUR, 1) * (1 - Math.min(t / JUMP_DUR, 1)) : 0;
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
		// C4 부속: 실뼈 뒤 고정 순서 append. built-in 클립은 절대 시간이라 dt 를 유도 —
		// 시간 역행(리셋·bindBones 의 t=0 호출)은 체인 재시드로 처리한다 (결정론 유지).
		const chains = this._appendix.sync(genome);
		if (chains.length) {
			let dt = 0;
			if (this._appendix.lastT != null) {
				dt = t - this._appendix.lastT;
				if (dt < 0) { for (const c of chains) c.p = null; dt = 0; }
			}
			this._appendix.lastT = t;
			dt = Math.min(dt, 0.05);
			for (const ch of chains) {
				const ai = this._jointIdx(ch.def.attach);
				this._appendix.step(ch, dt, this._wpos[ai], this._wrot[ai]);
				this._appendix.appendSegs(segs, ch, this._wpos[ai], genome, f);
			}
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
		let box = new THREE.Box3().setFromObject(object3d);
		// 애니메이션-only FBX(스킨 메시 없음)는 위 박스가 비어(뼈 = 지오메트리 없음) size.y=0 →
		// scale 폭주로 캐릭터가 화면 밖으로 날아간다. 뼈 world 위치로 바운드를 다시 잡는다
		// (rig-agnostic: 메시 유무와 무관하게 동작 — Mixamo "without skin" 클립도 정규화 정상).
		if (box.isEmpty()) {
			object3d.updateMatrixWorld(true);
			box = new THREE.Box3();
			const wp = new THREE.Vector3();
			for (const b of bones) { b.getWorldPosition(wp); box.expandByPoint(wp); }
		}
		const size = new THREE.Vector3();
		box.getSize(size);
		this.scale = 1.7 / Math.max(size.y, 1e-3);
		this.center = new THREE.Vector3();
		box.getCenter(this.center);
		this.mixer = null;
		this.clipName = '';
		// A 트랙: 클립을 *전부* 보관한다 (전엔 animations[0] 하나만). 상태 머신이 이름으로
		// 골라 play(name, fade) 로 크로스페이드한다 — FBX 로 상태 그래프를 배선하는 토대.
		this.clips = {};      // 이름 → THREE.AnimationClip
		this._actions = {};   // 이름 → AnimationAction (지연 생성)
		this._active = '';    // 현재 재생 중인 클립 이름
		if (object3d.animations && object3d.animations.length) {
			this.mixer = new THREE.AnimationMixer(object3d);
			for (const c of object3d.animations) this.clips[c.name || `clip${Object.keys(this.clips).length}`] = c;
			this.clipName = object3d.animations[0].name || '';
			this.play(this.clipName, 0); // 기본은 첫 클립(기존 거동과 동일)
		}
		this._wp = new THREE.Vector3();
		this._wpp = new THREE.Vector3();
		this._appendix = new AppendixRig();
		this._aq = new THREE.Quaternion();
	}
	ExternalSkeleton.prototype.valid = function () { return this.bones.length > 0; };
	// 보관 중인 클립 이름 목록 (상태↔클립 자동 배선의 후보).
	ExternalSkeleton.prototype.clipNames = function () { return Object.keys(this.clips); };
	// 이름 클립으로 전환 — fade>0 이면 크로스페이드(같은 리그라 뼈 순서 불변 = 친화 안전).
	// 미지 이름/믹서 없음이면 무동작(현재 클립 유지).
	ExternalSkeleton.prototype.play = function (name, fade) {
		if (!this.mixer || !this.clips[name] || this._active === name) return;
		if (!this._actions[name]) this._actions[name] = this.mixer.clipAction(this.clips[name]);
		const next = this._actions[name];
		const prev = this._active && this._actions[this._active];
		next.enabled = true; next.setEffectiveWeight(1).play();
		if (prev && fade > 0) { next.reset(); prev.crossFadeTo(next, fade, false); }
		else if (prev) prev.stop();
		this._active = name;
		this.clipName = name;
	};
	// 부착 뼈 해석 — simpleName 완전 일치 → 포함 → 루트 뼈 폴백 (rig-agnostic).
	ExternalSkeleton.prototype._attachBone = function (name) {
		let contains = null;
		for (const b of this.bones) {
			const n = simpleName(b.name);
			if (n === name) return b;
			if (!contains && n.indexOf(name) >= 0) contains = b;
		}
		return contains || this.bones[0];
	};
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
		// C4 부속: 실뼈 뒤 고정 순서 append — 부착 뼈의 (정규화 world 위치, world 회전) 기준.
		// 외부 클립은 증분 시간이라 dt 를 그대로 물리 스텝에 쓴다 (bind 호출 dt=0 은 무동작).
		const chains = this._appendix.sync(genome);
		if (chains.length) {
			const step = Math.min(Math.max(dt || 0, 0), 0.05);
			for (const ch of chains) {
				const ab = this._attachBone(ch.def.attach);
				ab.getWorldPosition(this._wp);
				ab.getWorldQuaternion(this._aq);
				const q = this._aq, xx = q.x * q.x, yy = q.y * q.y, zz = q.z * q.z,
					xy = q.x * q.y, xz = q.x * q.z, yz = q.y * q.z, wx = q.w * q.x, wy = q.w * q.y, wz = q.w * q.z;
				const rot = [
					1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
					2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
					2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy),
				];
				const aPos = [
					(this._wp.x - this.center.x) * this.scale,
					(this._wp.y - this.center.y) * this.scale + 0.98,
					(this._wp.z - this.center.z) * this.scale,
				];
				this._appendix.step(ch, step, aPos, rot);
				this._appendix.appendSegs(segs, ch, aPos, genome, f);
			}
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

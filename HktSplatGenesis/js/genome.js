// HktSplatGenesis — 캐릭터 게놈 (Character Genome) · C 트랙
//
// 게놈 = 캐릭터의 정체성(데이터, 수 KB JSON, 결정론). 새 캐릭터 = 새 게놈, 새 코드 0.
// PLAN-CharacterGenesis 의 4층 — ① 형태(morph) ② 채색(palette) ③ 재질(matter) ④ 부속(appendix).
//
// C1 은 ① 형태만 데이터화한다: 뼈 이름 → 반지름 배율.
//   최종 반지름 = radiusForName(살 문법 = 기본 문법) × 게놈 배율(부위 그룹)
// radiusForName 은 "기본 문법"(스타일의 정의), 게놈은 그 위에 곱하는 개체별 "배율".
// rig-agnostic 유지: 키는 부위 그룹(이름 기반), 미지의 뼈·미지정 부위 → 배율 1(항등).
// 항등 게놈(morph 빈 객체) = 기존 살을 그대로 재현 → 회귀 0.
//
// 스타일 프로파일 = 게놈 공간의 울타리 (PLAN 「스타일 프로파일」). 추출·후보정이 어떤 값을
// 넣어도 이 범위·양자화로 스냅해 스타일을 통일한다 — "통일은 후처리가 아니라 입력 제약".

(function (global) {
	'use strict';

	function simpleName(n) { return String(n).replace(/^mixamorig:?/i, ''); }

	// ── 부위 그룹: 뼈 이름 → morph 축 ─────────────────────────────────────
	// 손가락 뼈는 'Hand' 를 이름에 포함하므로 hand 보다 먼저 판정한다 (순서 의존).
	// 부속(가상 뼈, C4)은 우리가 짓는 이름(Tail/Horn/Ear/Cape/Appendix)이라 최우선 판정 —
	// 대소문자 구분 indexOf 라 'Ear' 가 'ForeArm'(eAr) 과 충돌하지 않는다.
	function groupForName(name) {
		const n = simpleName(name), has = (s) => n.indexOf(s) >= 0;
		if (has('Tail') || has('Horn') || has('Ear') || has('Cape') || has('Appendix')) return 'appendix';
		if (has('Head') || has('_End')) return 'head';
		if (has('Neck'))               return 'neck';
		if (n === 'Hips' || has('Spine')) return 'torso';
		if (has('Shoulder'))           return 'shoulder';
		if (has('Thumb') || has('Index') || has('Middle') || has('Ring') || has('Pinky') || has('Finger')) return 'finger';
		if (has('Hand'))               return 'hand';
		if (has('ForeArm') || has('Arm')) return 'arm';
		if (has('UpLeg') || has('Leg')) return 'leg';
		if (has('Toe') || has('Foot'))  return 'foot';
		return 'other';
	}
	// 후보정 UI(에디터)가 노출하는 대표 그룹 — 세부 그룹은 위 분류를 그대로 쓴다.
	const GROUPS = ['head', 'neck', 'torso', 'shoulder', 'arm', 'hand', 'finger', 'leg', 'foot'];
	// 채색(② palette)·GPU 그룹 인덱스의 정렬된 원본 — engine.js GROUP_COUNT·boneGroup 업로드와
	// 순서 일치 필수. groupId(name) 가 이 배열의 인덱스를 돌려준다.
	// C4: 'appendix' 는 기존 인덱스를 흔들지 않게 'other' 직전에 삽입 — 'other' 는 항상 마지막
	// (engine 의 그룹 미상 폴백 = GROUP_COUNT-1 이 'other' 를 가리키는 규약 유지).
	const GROUP_IDS = ['head', 'neck', 'torso', 'shoulder', 'arm', 'hand', 'finger', 'leg', 'foot', 'appendix', 'other'];
	function groupId(name) { return GROUP_IDS.indexOf(groupForName(name)); }

	// ── 스타일 프로파일: 배율의 범위·양자화 (PLAN 초안값 반지름 0.5~2.2·스텝 0.1) ──
	// 극단 비율을 차단해 어떤 게놈에서 뽑혀도 한 게임의 캐릭터로 보이게 한다.
	// 길이 배율(C2)도 같은 울타리 — 팔다리·몸통 비율의 하한/상한.
	const PROFILE = {
		radiusMul: { min: 0.5, max: 2.2, step: 0.1 },
		lengthMul: { min: 0.5, max: 1.8, step: 0.05 },
		// ④ 부속 울타리 (PLAN 초안값: 꼬리 ≤8마디, 체인 ≤4개) — 마디·길이·반지름·강성 범위.
		appendix: {
			maxChains: 4,
			links: { min: 1, max: 8 },
			len: { min: 0.08, max: 1.4 },
			radius: { min: 0.008, max: 0.16 },
			k: { min: 8, max: 160 },
		},
	};
	function snap(v, p) {
		const c = Math.min(p.max, Math.max(p.min, v));
		return Math.round(c / p.step) * p.step;
	}
	function clampP(v, p, dflt) { return (v == null) ? dflt : Math.min(p.max, Math.max(p.min, v)); }

	// morph 엔트리는 숫자(반지름 배율만, C1 호환) 또는 {r, l}(반지름·길이 배율, C2).
	// 미지정 부위·미지 뼈는 항등(1) — 스냅을 타지 않아 항등 게놈 회귀 0.
	function entryOf(genome, name) {
		const m = genome && genome.morph;
		return m ? m[groupForName(name)] : null;
	}
	// 게놈 → 부위 반지름 배율 (형태 게놈 ①). 세그먼트 ra/rb 에 곱한다.
	function radiusScale(genome, name) {
		const e = entryOf(genome, name);
		if (e == null) return 1;
		const v = (typeof e === 'number') ? e : e.r;
		return (v == null) ? 1 : snap(v, PROFILE.radiusMul);
	}
	// 게놈 → 부위 길이 배율 (형태 게놈 ①, C2). FK offset 에 곱한다 — 클립과 직교.
	function lengthScale(genome, name) {
		const e = entryOf(genome, name);
		if (e == null || typeof e === 'number') return 1;
		return (e.l == null) ? 1 : snap(e.l, PROFILE.lengthMul);
	}

	// ── ② 채색(palette): 부위 그룹 → 램프 양 끝(colorA/colorB) ─────────────
	// 스플랫은 이미 제 뼈(rest.w)를 안다 — 그룹별 램프의 *양 끝*만 게놈이 정하고,
	// 보간 factor(heat=속도·변형률)는 렌더가 유도한다 (절대 원칙 1 유지).
	function hexToRgba(hex) {
		if (Array.isArray(hex)) return hex; // 이미 vec4
		const v = parseInt(String(hex).slice(1), 16);
		return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, 1];
	}
	// 게놈 palette + 개체 기본색(defA/defB, vec4) → GPU 램프 버퍼 Float32Array(GROUP_IDS×2×4).
	// palette 미지정 그룹은 개체 기본색으로 채워 항등(회귀 0). 반환 레이아웃: [2g]=A, [2g+1]=B.
	function groupColors(genome, defA, defB) {
		const pal = (genome && genome.palette) || {};
		const out = new Float32Array(GROUP_IDS.length * 8);
		for (let gi = 0; gi < GROUP_IDS.length; gi++) {
			const p = pal[GROUP_IDS[gi]];
			const A = p && p.a != null ? hexToRgba(p.a) : defA;
			const B = p && p.b != null ? hexToRgba(p.b) : defB;
			out.set(A, gi * 8);
			out.set(B, gi * 8 + 4);
		}
		return out;
	}

	// ── ④ 부속(appendix): 가상 뼈 스프링 체인 — 리그에 없는 꼬리/뿔/귀/망토 ──
	// 클립은 이 뼈들을 모른다(클립 무수정) — 움직임은 물리(지연 추종)가 만든다.
	// 체인 정의: { name, attach(부착 관절 이름), dir(부착 로컬 방향), links(마디 수),
	//             len(총 길이), r0/r1(뿌리→끝 반지름), k(스프링 강성), damp(기본 2√k), gravity }
	// 프로파일 울타리로 정규화해 돌려준다 — 체인 수·마디 수 초과는 잘라낸다(스타일 통일).
	function chains(genome) {
		const ap = (genome && genome.appendix) || [];
		const P = PROFILE.appendix;
		const out = [];
		for (let i = 0; i < ap.length && out.length < P.maxChains; i++) {
			const c = ap[i] || {};
			const links = Math.round(clampP(c.links, P.links, 5));
			const k = clampP(c.k, P.k, 40);
			const d = Array.isArray(c.dir) && c.dir.length === 3 ? c.dir : [0, -0.4, -1];
			const dl = Math.hypot(d[0], d[1], d[2]) || 1;
			out.push({
				name: c.name || ('Appendix' + i),
				attach: c.attach || 'Hips',
				dir: [d[0] / dl, d[1] / dl, d[2] / dl],
				links,
				len: clampP(c.len, P.len, 0.5),
				r0: clampP(c.r0, P.radius, 0.06),
				r1: clampP(c.r1, P.radius, 0.02),
				k,
				damp: (c.damp == null) ? 2 * Math.sqrt(k) : Math.max(0, c.damp), // 임계 감쇠 기본 (L6 함정과 동일 근거)
				gravity: (c.gravity == null) ? 0.35 : Math.max(0, Math.min(3, c.gravity)),
			});
		}
		return out;
	}

	// 부속 프리셋 — 에디터 원클릭·하니스 공용 (유전자 공간의 점일 뿐, 새 코드 경로 아님).
	const APPENDIX_PRESETS = {
		'꼬리': [{ name: 'Tail', attach: 'Hips', dir: [0, -0.35, -1], links: 6, len: 0.62, r0: 0.065, r1: 0.016, k: 36 }],
		'도마뱀 꼬리': [{ name: 'Tail', attach: 'Hips', dir: [0, -0.15, -1], links: 8, len: 0.9, r0: 0.1, r1: 0.012, k: 50 }],
		'뿔+꼬리': [
			{ name: 'Tail', attach: 'Hips', dir: [0, -0.35, -1], links: 6, len: 0.62, r0: 0.065, r1: 0.016, k: 36 },
			{ name: 'HornL', attach: 'Head', dir: [0.35, 1, -0.25], links: 2, len: 0.2, r0: 0.035, r1: 0.01, k: 140, gravity: 0 },
			{ name: 'HornR', attach: 'Head', dir: [-0.35, 1, -0.25], links: 2, len: 0.2, r0: 0.035, r1: 0.01, k: 140, gravity: 0 },
		],
	};

	// 항등 게놈 — 기존 히키토 사진을 그대로 재현하는 기준선.
	const IDENTITY = { morph: {} };
	// 배율 게놈: create({ head: 1.6, arm: 0.8 }) → { morph: { head: 1.6, arm: 0.8 } }
	function create(morph) { return { morph: Object.assign({}, morph || {}) }; }

	// ── 수동 게놈 (C2 비율 실증) — 같은 표준 리그·같은 클립, 게놈만으로 체형 대비 ──
	// {r: 반지름 배율, l: 길이 배율}. 힙 보정(skeleton FK)이 다리 길이차를 흡수해
	// 두 체형 모두 발이 지면에 붙은 채 walk/idle/wave 를 무수정 재생한다.
	const GENOMES = {
		'덩치':   { morph: { head: { r: 1.15 }, neck: { r: 1.2 }, torso: { r: 1.45, l: 1.05 }, shoulder: { r: 1.4 }, arm: { r: 1.3, l: 0.85 }, hand: { r: 1.2 }, leg: { r: 1.35, l: 0.72 }, foot: { r: 1.25 } } },
		'호리호리': { morph: { head: { r: 0.9 }, neck: { r: 0.8, l: 1.15 }, torso: { r: 0.78, l: 1.05 }, shoulder: { r: 0.8 }, arm: { r: 0.72, l: 1.3 }, hand: { r: 0.75 }, leg: { r: 0.7, l: 1.32 }, foot: { r: 0.8 } } },
	};

	global.HktGenesisGenome = { groupForName, groupId, radiusScale, lengthScale, entryOf, groupColors, hexToRgba, chains, IDENTITY, create, GENOMES, GROUPS, GROUP_IDS, PROFILE, APPENDIX_PRESETS };
})(typeof window !== 'undefined' ? window : globalThis);

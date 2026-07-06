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
	function groupForName(name) {
		const n = simpleName(name), has = (s) => n.indexOf(s) >= 0;
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

	// ── 스타일 프로파일: 반지름 배율의 범위·양자화 (PLAN 초안값 0.5~2.2, 스텝 0.1) ──
	// 극단 비율을 차단해 어떤 게놈에서 뽑혀도 한 게임의 캐릭터로 보이게 한다.
	const PROFILE = { radiusMul: { min: 0.5, max: 2.2, step: 0.1 } };
	function snap(v, p) {
		const c = Math.min(p.max, Math.max(p.min, v));
		return Math.round(c / p.step) * p.step;
	}

	// 게놈 → 부위 반지름 배율. morph 미지정 부위는 항등(1) — 스냅을 타지 않아 회귀 0.
	function radiusScale(genome, name) {
		const m = genome && genome.morph;
		if (!m) return 1;
		const v = m[groupForName(name)];
		return (v == null) ? 1 : snap(v, PROFILE.radiusMul);
	}

	// 항등 게놈 — 기존 히키토 사진을 그대로 재현하는 기준선.
	const IDENTITY = { morph: {} };
	// 배율 게놈: create({ head: 1.6, arm: 0.8 }) → { morph: { head: 1.6, arm: 0.8 } }
	function create(morph) { return { morph: Object.assign({}, morph || {}) }; }

	global.HktGenesisGenome = { groupForName, radiusScale, IDENTITY, create, GROUPS, PROFILE };
})(typeof window !== 'undefined' ? window : globalThis);

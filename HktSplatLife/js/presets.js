// HktSplatGenesis — 유전자 스키마 + 원소 프리셋 (classic script, 전역 HktGenesisGenes)
//
// app.js(UI)와 test/ 하니스가 공유하는 유일한 원본 — 하니스가 앱과 같은 값으로
// 검증하도록 프리셋을 여기서만 정의한다 (값 드리프트 방지).

(function (global) {
	'use strict';

	// ── 유전자 정의: [라벨, min, max, step] ──────────────────────────────
	const GENE_DEFS = {
		cohesion:   ['응집력',      0,    14,   0.1],
		volatility: ['휘발성(난류)', 0,    8,    0.1],
		updraft:    ['상승력',      -3,   5,    0.1],
		damping:    ['감쇠',        0,    14,   0.05],
		lifeBase:   ['수명(초)',    0.1,  6,    0.05], // 이펙트는 0.24s 짜리도 있다 (하한 0.3 → 0.1)
		emitRadius: ['방사 반경',   0.05, 2,    0.05],
		flowFreq:   ['난류 스케일', 0.3,  8,    0.1],
		flowSpeed:  ['난류 속도',   0,    4,    0.05],
		size:       ['크기',        0.005, 0.15, 0.005],
		stretch:    ['신축(이방성)', 0,    3,    0.05],
		opacity:    ['불투명도',    0.02, 1,    0.02],
		luminosity: ['발광',        0,    8,    0.1], // 이펙트 발광은 4 를 넘는다 (타격 4.5 · 전격 5.2)
		// ── L2: 이웃 규칙 유전자 ──
		gravity:    ['중력',        0,    15,   0.1],
		binding:    ['이웃 응집',   0,    30,   0.5],
		restDist:   ['휴지 간격',   0.3,  0.95, 0.05],
		viscosity:  ['점성',        0,    12,   0.5],
		reach:      ['이웃 반경',   0.06, 0.3,  0.01],
		mortality:  ['필멸(0/1)',   0,    1,    1],
		// ── L3: 골격(클러스터) 유전자 ──
		rigid:      ['강성',        0,    1,    0.05],
		toughness:  ['인성(파단)',  0.2,  3,    0.05],
		bondK:      ['골격 결합',   0,    500,  5],
		// ── L4: 성장/연소 유전자 ──
		growRate:   ['성장 속도',   0,    0.6,  0.01],
		flamm:      ['가연성',      0,    3,    0.1],
		// ── L5: 상호작용 유전자 ──
		heatEmit:   ['발열',        0,    2,    0.1],
		// ── L6: 뼈대 SDF 살 유전자 ──
		fleshK:     ['살 강성(SDF)', 0,   80,   1],
		// ── R1: 재질 유전자 (살 전용 — 조명 합성 계수, 비-살은 무시) ──
		spec:       ['스펙큘러',    0,    1,    0.02],
		specPow:    ['광택 지수',   1,    128,  1],
		rim:        ['림 라이트',   0,    1,    0.02],
		wrap:       ['랩 확산',     0,    1,    0.05],
		// ── F1: 이펙트 유전자 (이벤트 구동 개체 전용 — fxK 0 이면 전부 무시) ──
		// 이펙트의 정체성은 오직 이 8개 값이다. 타격이냐 폭발이냐는 코드가 아니라 여기서 갈린다.
		fxK:        ['이펙트 응답', 0,    4,    0.1],
		burst:      ['방사 속도',   0,    30,   0.5],
		cone:       ['지향성',      0,    0.95, 0.05],
		swirl:      ['와류',        0,    2,    0.05],
		shell:      ['구각 집중',   0,    1,    0.05],
		grow:       ['팽창',        0,    6,    0.1],
		curve:      ['소멸 곡선',   0.2,  6,    0.1],
		ember:      ['잔불 비율',   0,    1,    0.05],
		// ── F2: 굴절 유전자 (빛을 휘게 하는 개체 전용 — refract 0 이면 색 패스 그대로) ──
		// 색을 더하는 이펙트와 빛을 휘게 하는 이펙트를 가르는 축. 충격파·아지랑이·냉기 왜곡이
		// 전부 이 네 값의 좌표 차이다 (게놈 한 줄 = 새 굴절 이펙트).
		refract:    ['굴절 세기',   0,    4,    0.05],
		chroma:     ['색 분산',     0,    1,    0.02],
		caustic:    ['집광 밝기',   0,    2,    0.05],
		rarefy:     ['희박파(반전)', 0,   1,    0.05],
		// ── F3: 파열 유전자 (파면이 균질하지 않다 — shred 0 이면 매끈한 구면) ──
		// 타격감의 근거. 방사 방향을 격자로 나눠 조각마다 속도·밀도를 갈라 파면을 찢는다.
		shred:      ['파열(속도 편차)', 0, 1,   0.05],
		shredFreq:  ['조각 크기',   0.5,  120,  0.5], // 빛살은 방위를 수십~수백 칸으로 나눈다 (검격 90)
		tear:       ['틈 비율',     0,    0.9,  0.05],
		shredPow:   ['빠른 조각 희소성', 0.2, 6, 0.1],
		// ── F4: 광선 유전자 (파면을 빛살로 — disc 0 이면 구면 방사, rayLen 0 이면 상한 없음) ──
		disc:       ['원판 집중',   0,    1,    0.05],
		discThick:  ['원판 두께',   0,    1.5,  0.05],
		rayLen:     ['바늘 길이',   0,    40,   0.5],
		rayThin:    ['바늘 가늘기', 0,    3,    0.1],
		// ── F5: 방위 유전자 (평면 안에서 어디로 몰리는가 — arc 0 이면 온 고리) ──
		arc:        ['방위 집중',   0,    0.98, 0.02],
		arcSharp:   ['부채꼴 뾰족함', 0.2, 4,   0.1],
		// 가시 정렬: 조각(F3) 안의 방향을 조각 중심으로 스냅 — 0 = 기존(다발), 1 = 한 줄기 광선.
		// 엇갈린 평행 바늘 다발은 겹침 포락선이 굽은 결로 읽힌다(타격 눈검증) — 광선 이펙트는 1 근방.
		rayAlign:   ['가시 정렬',   0,    1,    0.02],
		// ── F6: 표현 강도 감도 (이벤트 세기 I → 채널별 응답 pow(I, p)) ──
		// 강도는 게놈이 아니라 *사건*이 준다(스치면 약하고 정통이면 세다). 게놈이 정하는 건
		// "이 이펙트가 그 강도에 어느 채널로 반응하는가" — 속도만 반응하면 멀리 날 뿐이고,
		// 크기·밝기·수명이 함께 반응해야 "묵직하게 맞았다"로 읽힌다. 0 = 그 채널은 강도 무시.
		powVel:     ['강도→속도',   0,    3,    0.05],
		powSize:    ['강도→크기',   0,    3,    0.05],
		powLum:     ['강도→밝기',   0,    3,    0.05],
		powLife:    ['강도→수명',   0,    3,    0.05],
		// ── F7: 시간 결 (수명 안에서 밝기가 어떻게 변주되는가 — 전부 0 이면 기존 매끈한 소멸) ──
		flicker:    ['점멸 깊이',   0,    1,    0.02],
		flickerHz:  ['점멸 주기(Hz)', 0,  60,   1],
		flash:      ['탄생 섬광',   0,    12,   0.2],
		coreGlow:   ['코어 과노출', 0,    6,    0.1],
		// ── F8: 방사 구조 (바깥으로만 흐르지 않아도 된다 — 0 이면 기존 방사) ──
		implode:    ['수축(흡수)',  0,    1,    0.05],
		ripple:     ['다중 파문(겹)', 0,  8,    1],
		twist:      ['나선',        -4,   4,    0.05],
	};

	// ── 원소 프리셋: 유전자 값만 다르고 시스템은 동일 — 속성이 형태를 만든다 ──
	const PRESETS = {
		'불의 정령': {
			cohesion: 2.5, volatility: 3.4, updraft: 2.2, damping: 1.2,
			lifeBase: 1.6, emitRadius: 0.35, flowFreq: 2.2, flowSpeed: 1.6,
			size: 0.035, stretch: 1.1, opacity: 0.5, luminosity: 2.4,
			gravity: 0, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.14, mortality: 1,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 1.2, fleshK: 0,
			colorA: '#a81c06', colorB: '#ffe08a',
		},
		'물': {
			cohesion: 1.2, volatility: 0.3, updraft: 0, damping: 1.0,
			lifeBase: 4.0, emitRadius: 0.9, flowFreq: 1.0, flowSpeed: 0.4,
			size: 0.05, stretch: 0.8, opacity: 0.65, luminosity: 0.8,
			gravity: 7, binding: 10, restDist: 0.55, viscosity: 6, reach: 0.15, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: '#0a2a8a', colorB: '#7fe9ff',
		},
		'숲의 정령': {
			cohesion: 3.5, volatility: 1.9, updraft: 0.6, damping: 1.6,
			lifeBase: 3.2, emitRadius: 0.85, flowFreq: 1.3, flowSpeed: 0.55,
			size: 0.045, stretch: 1.6, opacity: 0.45, luminosity: 1.3,
			gravity: 0, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.14, mortality: 1,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: '#0d3410', colorB: '#a8ff6b',
		},
		'나무': {
			cohesion: 0, volatility: 2.4, updraft: 0, damping: 2.0,
			lifeBase: 3.0, emitRadius: 0.5, flowFreq: 1.8, flowSpeed: 0.9,
			size: 0.05, stretch: 0.8, opacity: 0.75, luminosity: 0.8,
			gravity: 0, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.12, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0.12, flamm: 1.2, heatEmit: 0, fleshK: 0, form: 2,
			colorA: '#5a4a2e', colorB: '#86e05c',
		},
		'돌골렘': {
			cohesion: 0, volatility: 0, updraft: 0, damping: 2.5,
			lifeBase: 4.0, emitRadius: 0.9, flowFreq: 1.0, flowSpeed: 0.3,
			size: 0.055, stretch: 0.3, opacity: 0.9, luminosity: 0.6,
			gravity: 6, binding: 0, restDist: 0.6, viscosity: 0, reach: 0.14, mortality: 0,
			rigid: 0.5, toughness: 0.5, bondK: 300, form: 1, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: '#57534b', colorB: '#ff9b3d',
		},
		'슬라임': {
			cohesion: 3.0, volatility: 0.25, updraft: 0, damping: 2.0,
			lifeBase: 4.0, emitRadius: 0.9, flowFreq: 1.0, flowSpeed: 0.3,
			size: 0.06, stretch: 0.5, opacity: 0.8, luminosity: 0.5,
			gravity: 4, binding: 14, restDist: 0.6, viscosity: 8, reach: 0.16, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 0,
			colorA: '#1c7a2f', colorB: '#b7ff5e',
		},
		// L6: 뼈대 살 — 구름으로 태어난 스플랫이 제 뼈(부피 가중 친화)를 찾아가 살이 된다.
		// 뼈대 자체는 skeleton.js (FK + 살 문법), 여기 유전자는 살의 재질만.
		// 제약: binding 0 필수 — L2 인력(표면장력)이 자리 스프링을 이기면 살이 방울로 뭉친다.
		// damping 은 임계 감쇠 2√fleshK 근방 유지 (fleshK 60 → ~9 이상, 미달 시 진동 블롭).
		'히키토': {
			cohesion: 0, volatility: 0.15, updraft: 0, damping: 9.0,
			lifeBase: 4.0, emitRadius: 1.0, flowFreq: 1.5, flowSpeed: 0.6,
			size: 0.035, stretch: 0.5, opacity: 0.9, luminosity: 0,
			gravity: 1.0, binding: 0, restDist: 0.9, viscosity: 0, reach: 0.13, mortality: 0,
			rigid: 0, toughness: 1, bondK: 0, growRate: 0, flamm: 0, heatEmit: 0, fleshK: 60,
			spec: 0.22, specPow: 26, rim: 0.18, wrap: 0.55, // R1: 피부 재질 (조명 켜지면 발광 대신 셰이딩)
			emitter: [0, 1.0, 0], form: 3,
			colorA: '#7a3b2a', colorB: '#ffd9a8',
		},
	};

	function hexToVec4(hex) {
		const v = parseInt(hex.slice(1), 16);
		return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, 1];
	}

	// 프리셋 → 시뮬 입력 유전자 (숫자 + vec4 색 + form/emitter).
	// form 3 의 bindBones 는 모션 소스를 아는 호출자(app.js / 하니스)가 붙인다.
	// R1 재질 등 신설 유전자 미지정 프리셋은 0 폴백 (specPow 만 pow 가드 1) — NaN 업로드 방지.
	function materialize(p, emitter) {
		const g = {};
		// 미지정 유전자의 폴백은 0 — 단, 곱셈/지수 자리에 0 이 들어가면 개체가 사라지는
		// 유전자만 1 로 가드한다(powVel 1 = F6 이전의 선형 강도 응답 = 회귀 0).
		for (const k of Object.keys(GENE_DEFS)) g[k] = p[k] != null ? p[k]
			: (k === 'specPow' || k === 'curve' || k === 'shredPow' || k === 'arcSharp' || k === 'powVel' ? 1 : 0);
		g.colorA = hexToVec4(p.colorA);
		g.colorB = hexToVec4(p.colorB);
		g.form = p.form || 0;
		g.emitter = emitter || p.emitter || [0, 0.6, 0];
		return g;
	}

	global.HktGenesisGenes = { GENE_DEFS, PRESETS, hexToVec4, materialize };
})(window);

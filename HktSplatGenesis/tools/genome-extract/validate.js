// C5 스타일 프로파일 검증기 — 게놈 공간의 울타리 (PLAN-CharacterGenesis 「스타일 프로파일」).
// 추출(LLM)이 어떤 값을 내놓아도 이 울타리를 벗어나면 *클램프가 아니라 반려* 한다 —
// 반려된 게놈은 재추출/후보정 대상이고, 통과한 게놈만 저장된다 (통일은 입력 제약).
// 형태·부속 범위의 원본은 js/genome.js PROFILE (런타임 스냅과 같은 울타리),
// 채색·재질 범위는 추출기 전용(아래 EXTRACT) — 런타임은 이 값을 강제하지 않는다.

'use strict';
require('../../js/genome.js'); // globalThis.HktGenesisGenome 등록 (브라우저/Node 겸용 IIFE)
const G = globalThis.HktGenesisGenome;

// 추출기 전용 울타리 — 아트 바이블 초안값 (PLAN 표). 바꾸면 스타일 정의가 바뀐다.
const EXTRACT = {
	palette: { sat: [0.1, 0.9], val: [0.08, 0.97] }, // 극단(무채색/네온/순흑백) 차단
	matter: {
		size: [0.02, 0.06], stretch: [0.3, 2.5], opacity: [0.6, 0.95],
		luminosity: [0, 1.5], fleshK: [10, 80],
	},
	// 부속 부착 관절 — 표준 리그(simpleName) 어휘. 미지 관절은 반려 (런타임 폴백에 기대지 않는다)
	attach: ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
		'LeftShoulder', 'RightShoulder', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'],
};

function hexToHsv(hex) {
	const m = /^#([0-9a-fA-F]{6})$/.exec(String(hex));
	if (!m) return null;
	const v = parseInt(m[1], 16);
	const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
	const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
	return { s: mx === 0 ? 0 : (mx - mn) / mx, v: mx };
}
const inR = (x, [lo, hi]) => typeof x === 'number' && isFinite(x) && x >= lo && x <= hi;

// 게놈 JSON → { ok, errors[] }. errors 는 반려 사유(재추출 프롬프트에 되먹일 수 있는 문장).
function validate(genome) {
	const errors = [];
	const err = (s) => errors.push(s);
	if (!genome || typeof genome !== 'object') return { ok: false, errors: ['게놈이 객체가 아님'] };

	const TOP = ['name', 'morph', 'palette', 'matter', 'appendix', 'notes'];
	for (const k of Object.keys(genome)) if (!TOP.includes(k)) err(`미지의 최상위 키: ${k}`);

	// ① 형태 — 부위 그룹 키 + PROFILE 범위 (스냅이 아니라 범위 밖 반려)
	const MG = [...G.GROUPS, 'appendix'];
	for (const [k, e] of Object.entries(genome.morph || {})) {
		if (!MG.includes(k)) { err(`morph: 미지의 부위 그룹 '${k}'`); continue; }
		const r = (typeof e === 'number') ? e : e && e.r;
		const l = (e && typeof e === 'object') ? e.l : undefined;
		if (r != null && !inR(r, [G.PROFILE.radiusMul.min, G.PROFILE.radiusMul.max]))
			err(`morph.${k}.r=${r} — 반지름 배율 범위 ${G.PROFILE.radiusMul.min}~${G.PROFILE.radiusMul.max} 밖`);
		if (l != null && !inR(l, [G.PROFILE.lengthMul.min, G.PROFILE.lengthMul.max]))
			err(`morph.${k}.l=${l} — 길이 배율 범위 ${G.PROFILE.lengthMul.min}~${G.PROFILE.lengthMul.max} 밖`);
	}

	// ② 채색 — 그룹 어휘 + 채도/명도 밴드 (부위당 램프 2색 고정)
	for (const [k, p] of Object.entries(genome.palette || {})) {
		if (!G.GROUP_IDS.includes(k)) { err(`palette: 미지의 부위 그룹 '${k}'`); continue; }
		for (const key of ['a', 'b']) {
			if (p == null || p[key] == null) { err(`palette.${k}.${key} 누락 (램프 양 끝 2색 고정)`); continue; }
			const hsv = hexToHsv(p[key]);
			if (!hsv) { err(`palette.${k}.${key}='${p[key]}' — #rrggbb 형식 아님`); continue; }
			if (!inR(hsv.s, EXTRACT.palette.sat)) err(`palette.${k}.${key} 채도 ${hsv.s.toFixed(2)} — 밴드 ${EXTRACT.palette.sat} 밖`);
			if (!inR(hsv.v, EXTRACT.palette.val)) err(`palette.${k}.${key} 명도 ${hsv.v.toFixed(2)} — 밴드 ${EXTRACT.palette.val} 밖`);
		}
	}

	// ③ 재질 — 허용 유전자 부분집합·범위
	for (const [k, v] of Object.entries(genome.matter || {})) {
		if (!EXTRACT.matter[k]) { err(`matter: 허용되지 않은 유전자 '${k}' (허용: ${Object.keys(EXTRACT.matter).join('/')})`); continue; }
		if (!inR(v, EXTRACT.matter[k])) err(`matter.${k}=${v} — 범위 ${EXTRACT.matter[k]} 밖`);
	}

	// ④ 부속 — 체인 수·마디·치수·부착 어휘 (PROFILE.appendix 와 동일 울타리)
	const ap = genome.appendix || [];
	const P = G.PROFILE.appendix;
	if (!Array.isArray(ap)) err('appendix 가 배열이 아님');
	else {
		if (ap.length > P.maxChains) err(`appendix 체인 ${ap.length}개 — 상한 ${P.maxChains}`);
		ap.forEach((c, i) => {
			const at = `appendix[${i}]`;
			if (!c || typeof c !== 'object') return err(`${at} 가 객체가 아님`);
			if (c.attach != null && !EXTRACT.attach.includes(c.attach)) err(`${at}.attach='${c.attach}' — 표준 리그 관절 아님 (${EXTRACT.attach.join('/')})`);
			if (c.links != null && !(Number.isInteger(c.links) && c.links >= P.links.min && c.links <= P.links.max)) err(`${at}.links=${c.links} — ${P.links.min}~${P.links.max} 정수 아님`);
			if (c.len != null && !inR(c.len, [P.len.min, P.len.max])) err(`${at}.len=${c.len} — 범위 ${P.len.min}~${P.len.max} 밖`);
			for (const rk of ['r0', 'r1']) if (c[rk] != null && !inR(c[rk], [P.radius.min, P.radius.max])) err(`${at}.${rk}=${c[rk]} — 범위 ${P.radius.min}~${P.radius.max} 밖`);
			if (c.k != null && !inR(c.k, [P.k.min, P.k.max])) err(`${at}.k=${c.k} — 범위 ${P.k.min}~${P.k.max} 밖`);
			if (c.dir != null && !(Array.isArray(c.dir) && c.dir.length === 3 && c.dir.every((x) => typeof x === 'number' && isFinite(x)) && Math.hypot(...c.dir) > 1e-6)) err(`${at}.dir — 유한한 vec3 아님`);
		});
	}

	return { ok: errors.length === 0, errors };
}

module.exports = { validate, EXTRACT };

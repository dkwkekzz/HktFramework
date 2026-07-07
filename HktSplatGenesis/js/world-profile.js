// HktSplatGenesis — 월드 스타일 프로파일 + 게놈 검증기 (W2, classic script, 의존성 없음)
//
// "이미지 몇 장으로 스타일 통일"의 답은 **게놈 공간에 울타리를 치는 것**이다 (PLAN-WorldFromImage
// 「월드 스타일 프로파일」). 추출기가 어떤 이미지를 받아도 이 울타리 안의 게놈만 내놓아야 하고,
// 벗어난 값은 **클램프가 아니라 반려**한다 (C 트랙 원칙: 이상치는 재추출).
//
// 통일 = 프로파일(입력 울타리) × 공용 유도(출력 규칙)의 곱. 이 파일은 앞 절반(입력 울타리)이다.
// 뒤 절반(바이옴 소프트맥스 경계 보간·고도 램프·domain warp)은 terrain-gen.js 의 순수 함수.
//
// validate 는 **존재하는 필드만** 검사한다 — 생략된 필드는 world() 가 안전한 기본 프리셋으로
// 채우므로(하위 호환) 위반이 아니다. biomeSet 은 있으면 항목마다 검사.

(function (global) {
	'use strict';

	// ── 프로파일: 아트 바이블의 수학적 형태 (하드코딩 지양 컨벤션 — 튜닝 노브로 노출) ──
	// 초안값. 내장 프리셋(temperate/ashen)과 W4 v0 게놈(breeze-meadow)이 전부 통과하도록 잡았다.
	const PROFILE = {
		// 지형 전역
		amp: [0.3, 2.5], scale: [1.5, 7.0], octaves: [3, 6], base: [-0.5, 1.5],
		warpAmp: [0.0, 1.5], warpScale: [3.0, 30.0], biomeScale: [12.0, 140.0], biomeSharp: [8.0, 44.0],
		// 수역: waterY 는 relief 하한~상한(base±amp*2) 안이어야 의미가 있다 (동적 검사).
		// 바이옴
		biomeCount: [1, 5],
		ampMul: [0.3, 2.3], scaleMul: [0.5, 2.6], ridged: [0.0, 1.0], warpMul: [0.0, 1.3],
		tempHumid: [0.0, 1.0],       // 온·습도 중심은 [0,1] 평면 안
		biomeMinSep: 0.07,           // 두 바이옴 중심의 최소 거리 (퇴화 중복 차단)
		// 채색: 채도 상한만(하한 없음 — 설선·설원 같은 저채도 흰색은 정당). 각 채널 [0,1].
		satMax: 0.9,
		// 대기(mood, W6): 하늘/fog 색은 색 규칙(채널 [0,1]·채도 ≤ satMax) 공유. fog 거리는 양수·순서만.
		fogMin: 0.0,
	};

	function sat(c) { // 색의 채도 = (max-min)/max, max=0 이면 0
		const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
		return mx <= 1e-6 ? 0 : (mx - mn) / mx;
	}
	const isNum = (v) => typeof v === 'number' && isFinite(v);

	// genome → { ok, violations:[{field, value, rule}] }
	function validate(genome) {
		const g = genome || {};
		const v = [];
		const push = (field, value, rule) => v.push({ field, value, rule });

		// 존재하는 필드만 범위 검사 (생략 = 기본값 = 위반 아님)
		function opt(field, lo, hi, isInt) {
			const val = g[field];
			if (val === undefined) return;
			if (!isNum(val)) { push(field, val, '숫자 아님'); return; }
			if (isInt && Math.round(val) !== val) push(field, val, '정수 아님');
			if (val < lo || val > hi) push(field, val, `범위 [${lo}, ${hi}] 벗어남`);
		}
		opt('amp', PROFILE.amp[0], PROFILE.amp[1]);
		opt('scale', PROFILE.scale[0], PROFILE.scale[1]);
		opt('octaves', PROFILE.octaves[0], PROFILE.octaves[1], true);
		opt('base', PROFILE.base[0], PROFILE.base[1]);
		opt('warpAmp', PROFILE.warpAmp[0], PROFILE.warpAmp[1]);
		opt('warpScale', PROFILE.warpScale[0], PROFILE.warpScale[1]);
		opt('biomeScale', PROFILE.biomeScale[0], PROFILE.biomeScale[1]);
		opt('biomeSharp', PROFILE.biomeSharp[0], PROFILE.biomeSharp[1]);

		// 수역: waterY 는 relief 포락(base±amp*2) 안이어야 물이 실제로 생긴다/의미가 있다
		if (g.waterY !== undefined) {
			if (!isNum(g.waterY)) push('waterY', g.waterY, '숫자 아님');
			else {
				const base = isNum(g.base) ? g.base : 0.5, amp = isNum(g.amp) ? g.amp : 0.9;
				const lo = base - amp * 2.2, hi = base + amp * 2.2;
				if (g.waterY < lo || g.waterY > hi) push('waterY', g.waterY, `relief 포락 [${lo.toFixed(2)}, ${hi.toFixed(2)}] 벗어남`);
			}
		}
		function colorOk(field, c) {
			if (!Array.isArray(c) || c.length !== 3 || !c.every(isNum)) { push(field, c, 'rgb 3성분 아님'); return; }
			for (const ch of c) if (ch < 0 || ch > 1) { push(field, c, '채널 [0,1] 벗어남'); break; }
			if (sat(c) > PROFILE.satMax) push(field, c, `채도 ${sat(c).toFixed(2)} > ${PROFILE.satMax} (과채도)`);
		}
		if (g.water !== undefined) {
			if (g.water && g.water.shallow) colorOk('water.shallow', g.water.shallow);
			if (g.water && g.water.deep) colorOk('water.deep', g.water.deep);
		}

		// 대기(mood, W6) — 하늘/fog 색은 색 규칙(채널 [0,1]·채도 상한) 공유, fog 거리는 양수·순서만
		if (g.mood !== undefined) {
			const m = g.mood || {};
			if (m.skyTop !== undefined) colorOk('mood.skyTop', m.skyTop);
			if (m.skyHorizon !== undefined) colorOk('mood.skyHorizon', m.skyHorizon);
			if (m.fogColor !== undefined) colorOk('mood.fogColor', m.fogColor);
			if (m.fogStart !== undefined && (!isNum(m.fogStart) || m.fogStart < PROFILE.fogMin)) push('mood.fogStart', m.fogStart, `숫자·≥${PROFILE.fogMin} 아님`);
			if (m.fogEnd !== undefined && (!isNum(m.fogEnd) || m.fogEnd <= PROFILE.fogMin)) push('mood.fogEnd', m.fogEnd, `숫자·>${PROFILE.fogMin} 아님`);
			if (isNum(m.fogStart) && isNum(m.fogEnd) && m.fogStart >= m.fogEnd) push('mood.fogRange', [m.fogStart, m.fogEnd], 'fogStart ≥ fogEnd (역순)');
		}

		// 바이옴 셋
		if (g.biomeSet !== undefined) {
			const bs = g.biomeSet;
			if (!Array.isArray(bs)) { push('biomeSet', bs, '배열 아님'); }
			else {
				if (bs.length < PROFILE.biomeCount[0] || bs.length > PROFILE.biomeCount[1])
					push('biomeSet.length', bs.length, `범위 [${PROFILE.biomeCount[0]}, ${PROFILE.biomeCount[1]}] 벗어남`);
				for (let i = 0; i < bs.length; i++) {
					const b = bs[i] || {}, tag = `biomeSet[${i}]`;
					const optB = (f, lo, hi) => { if (b[f] === undefined) return; if (!isNum(b[f])) push(`${tag}.${f}`, b[f], '숫자 아님'); else if (b[f] < lo || b[f] > hi) push(`${tag}.${f}`, b[f], `범위 [${lo}, ${hi}] 벗어남`); };
					optB('temp', PROFILE.tempHumid[0], PROFILE.tempHumid[1]);
					optB('humid', PROFILE.tempHumid[0], PROFILE.tempHumid[1]);
					optB('ampMul', PROFILE.ampMul[0], PROFILE.ampMul[1]);
					optB('scaleMul', PROFILE.scaleMul[0], PROFILE.scaleMul[1]);
					optB('ridged', PROFILE.ridged[0], PROFILE.ridged[1]);
					optB('warpMul', PROFILE.warpMul[0], PROFILE.warpMul[1]);
					if (b.lo !== undefined) colorOk(`${tag}.lo`, b.lo);
					if (b.hi !== undefined) colorOk(`${tag}.hi`, b.hi);
				}
				// 바이옴 중심 최소 거리 — 퇴화 중복(같은 자리 두 바이옴) 차단
				for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
					const a = bs[i], c = bs[j];
					if (a && c && isNum(a.temp) && isNum(a.humid) && isNum(c.temp) && isNum(c.humid)) {
						const d = Math.hypot(a.temp - c.temp, a.humid - c.humid);
						if (d < PROFILE.biomeMinSep) push(`biomeSet[${i},${j}]`, +d.toFixed(3), `바이옴 중심 거리 < ${PROFILE.biomeMinSep} (퇴화 중복)`);
					}
				}
			}
		}
		return { ok: v.length === 0, violations: v };
	}

	const api = { PROFILE, validate, sat };
	global.HktGenesisWorldProfile = api;
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

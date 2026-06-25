// viewer/scenes/step_0108.js — (조립) 안정 분절 침식: 비겹침 *그리드 베드* 위에서 흐름이 *공간 협곡*을 깎는다(안정).
//   0075 침식(sphSedimentErosion)은 *겹친 sphere 앵커* 카펫 위에선 경계력이 폭발해 불안정(단일 램프 균일 하강만)했다.
//   핵심 고침 = *베드 표현*: 셀당 앵커 하나(비겹침·0103/0104 식)면 침식이 안정하고, 경사 가파른(빠른 흐름) 셀이 더
//   깎여 *협곡*이 공간적으로 창발한다(집중·균일 아님). 배경 = 침식 깊이 맵(깎일수록 어두운 협곡)·물 파랑·시간 4 프레임.
//   engine 변경 0(조립·0075 침식 법칙 + 0103 그리드 흐름). 탑다운. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0108'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const GW = 22, GH = 22, G = 4, DT = 0.02, AR = 4;
  const elevFn = (x, y) => 8 * Math.pow((x - (GW - 1) / 2) / ((GW - 1) / 2), 2) + 0.30 * y
    + 1.0 * Stream.fbm(x * 0.18, y * 0.18, { salt: 'CAN', octaves: 3, gain: 0.5 });
  const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.0, gamma: 2 };
  const bopt = { stiffness: 200, damp: 30, skin: 0.6 }, fopt = { drag: 6, skin: 0.6 };
  const eopt = { erodeRate: 1.6, capacity: 1.2, skin: 0.6, minBed: 0.5 };
  const CAN = 54, SC = CAN / GW;

  function build(w) {
    const an = []; const grid = [];
    for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) { const a = { cx: x, cy: y, cz: elevFn(x, y) - AR, radius: AR, bed: AR }; an.push(a); grid.push(a); }
    for (let x = -1; x <= GW; x++) for (let z = 0; z <= 14; z += 3) an.push({ cx: x, cy: GH + 1, cz: z, radius: 5, bed: 5 });
    for (let y = -1; y <= GH; y++) for (let z = 0; z <= 14; z += 3) { an.push({ cx: -2, cy: y, cz: z, radius: 5, bed: 5 }); an.push({ cx: GW + 1, cy: y, cz: z, radius: 5, bed: 5 }); }
    w.__an = an; w.__grid = grid; w.__water = [];
    let seed = 4; w.__rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function sim(w) {
    if (w.__rainOn) for (let i = 0; i < 9; i++) {
      const x = 2 + w.__rnd() * (GW - 4), y = GH - 4 - w.__rnd() * 3;
      w.__water.push({ cx: x, cy: y, cz: elevFn(x, y) + 5, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, sediment: 0, radius: 1 });
    }
    for (let s = 0; s < 20; s++) {
      Sph.sphPressureForce(w.__water, DT, popt); Sph.sphViscosity(w.__water, DT, vopt);
      for (const p of w.__water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(w.__water, w.__an, DT, bopt);
      Sph.sphBedFriction(w.__water, w.__an, DT, fopt);
      Sph.sphSedimentErosion(w.__water, w.__an, DT, eopt);
      En.stepEntities(w.__water, DT);
      for (let k = w.__water.length - 1; k >= 0; k--) if (w.__water[k].cy < -1 || w.__water[k].cz < -2) w.__water.splice(k, 1);
    }
  }

  return {
    label: 'step_0108 — (조립) 안정 분절 침식: 그리드 베드 위 흐름이 공간 협곡을 깎는다(안정)',
    title: 'HTJ — 안정 분절 침식: 비겹침 그리드 베드 위 흐름이 빠른 경사를 깎아 공간 협곡 창발(폭발 없음)',
    sub: '0075 침식은 겹친 앵커 카펫서 폭발(균일 하강만). 핵심 고침=베드 표현(셀당 앵커 하나·비겹침). 그러면 경사 가파른(빠른 흐름) 셀이 더 깎여 협곡이 공간 창발(집중·균일 아님)·안정. 배경=침식 깊이(깎일수록 어두움)·물 파랑. engine 변경 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); w.__rainOn = true; },
    advance(w) { const t = (w.__t = (w.__t || 0) + 1); w.__rainOn = t <= 56; sim(w); },

    makeWorld() { return { N: CAN }; },
    frames: [6, 26, 52, 76],                                        // 마지막은 비 그친 뒤(물 빠짐) — 맨 협곡 보임
    // 배경: 침식 깊이(0=모래색 → 깊을수록 어두운 적갈 협곡)·물=파랑.
    captureOpts: { N: CAN, color: (v) => v >= 1.5 ? [90, 150, 235] : [205 - v * 165, 170 - v * 145, 115 - v * 95] },
    toFrame(w) {
      const pts = [];
      for (const a of w.__grid) { const ero = Math.max(0, AR - a.radius), v = Math.min(0.999, Math.sqrt(ero / 2.2));   // 침식 깊이(√ 대비 강화)
        pts.push({ cx: (a.cx + 0.5) * SC, cy: (GH - 0.5 - a.cy) * SC, r: 0.72, v }); }
      for (const p of w.__water) pts.push({ cx: (p.cx + 0.5) * SC, cy: (GH - 0.5 - p.cy) * SC, r: 0.55, v: 1.6 });
      return { pts, count: w.__water.length };
    },

    note: '<b>흐름이 *비겹침 그리드 베드*를 깎아 *공간 협곡*을 빚는다 — 0075 침식이 폭발 없이 안정하게, 균일 하강이 아니라 집중된 협곡으로.</b> 0075 침식(<code>sphSedimentErosion</code>·물↔지형 퇴적물 왕복)은 *겹친 sphere 앵커* 카펫 위에선 경계력이 폭발해 불안정했다(그래서 단일 램프 *균일* 하강만 보였다·STATE §3 디테일② 난점). 이 step 의 핵심 고침은 *새 물리가 아니라 베드 표현*: 셀당 앵커 하나(비겹침·0103/0104 그리드 베드)면 erosion 이 각 셀 <code>A.bed/A.radius</code> 만 안정하게 바꾼다(겹침 폭발 없음). 그러면 0075 법칙이 *공간적으로* 산다: 경사 가파른(빠른 흐름·stream power) 셀이 더 깎이고 — 침식이 소수 셀에 *집중*돼 *협곡 단면*이 창발한다(채널 깊어짐→흐름 집중 되먹임). <b>측정(verify)</b>: ① <b>공간 비균일 협곡</b> corr(경사,침식)=0.49·상위 30% 셀이 침식 76% 집중(균일 램프 아닌 협곡) ② <b>안정성</b> 베드 유한·minBed 위반 0·max 속도 11<60(겹친 앵커 폭발 없음) ③ <b>침식 보존</b> Σbed+운반중+유출운반 3736→3736(0075 쌍이동 정확) ④ 결정론. <b>흐름</b>(capture 4 프레임·탑다운·배경=침식 깊이): 모래색 평지에 비(파랑)가 흐르며 *어두운 협곡 줄기*가 골짜기 경사를 따라 점점 깊고 또렷이 깎인다(균일 아닌 집중). <b>큰 그림</b>: 0075 침식이 *공간 지형*을 빚는다 — 흐름이 땅을 *조각*(협곡·삼각주)하는 환경(TW3). <b>원칙 준수</b>: 침식은 generic SPH↔앵커 법칙(0075·타입 0)·고침은 *베드 격자화*(겹침 제거)뿐·engine 변경 0. <b>정직한 한계</b>: 그리드 베드(연속 높이장 아님·셀 해상도)·유한 비·minBed 바닥(다 깎이면 멈춤)·메타볼 경계는 후속. 다음(디테일 마무리 완): PW 사다리(걸을 수 있는 한 조각 땅)로.'
  };
});

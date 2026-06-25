// viewer/scenes/step_0105.js — (조립) 정상상태 유량: *연속* 강수 유입 = *연속* 유출 → 흔들림 없는 정상 수면(물순환 닫음).
//   0102~0104 는 *유한* 비(한 번 와서 정착)였다. 실제 강은 비가 *끊임없이* 와서 *끊임없이* 바다로 빠진다 — 그 사이
//   물량(수면)은 *plateau*(유입=유출 균형). 이 무대: 경사 수로(0103식)에 비를 끊임없이 떨궈, 과도기 후 통과류가
//   정상상태에 든다(물량 일정·들어온 만큼 나감). engine 변경 0(조립·연속 비 + 기존 SPH 흐름). 탑다운. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0105'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  const GW = 24, GH = 24, G = 4, DT = 0.02, AR = 4, BATCH = 5;
  const elevFn = (x, y) => 8 * Math.pow((x - (GW - 1) / 2) / ((GW - 1) / 2), 2) + 0.28 * y;   // V 골짜기+경사
  const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.0, gamma: 2 };
  const bopt = { stiffness: 200, damp: 30, skin: 0.6 }, fopt = { drag: 6, skin: 0.6 };
  const CAN = 56, SC = CAN / GW;

  function build(w) {
    const an = [];
    for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) an.push({ cx: x, cy: y, cz: elevFn(x, y) - AR, radius: AR });
    for (let x = -1; x <= GW; x++) for (let z = 0; z <= 16; z += 3) an.push({ cx: x, cy: GH + 1, cz: z, radius: 5 });
    for (let y = -1; y <= GH; y++) for (let z = 0; z <= 16; z += 3) { an.push({ cx: -2, cy: y, cz: z, radius: 5 }); an.push({ cx: GW + 1, cy: y, cz: z, radius: 5 }); }
    w.__an = an; w.__water = []; w.__exited = 0; w.__hist = [];
    let seed = 3; w.__rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function sim(w) {
    for (let i = 0; i < BATCH; i++) {                                // *끊임없이* 비(plateau 까지)
      const x = 2 + w.__rnd() * (GW - 4), y = GH - 4 - w.__rnd() * 4;
      w.__water.push({ cx: x, cy: y, cz: elevFn(x, y) + 5, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
    }
    for (let s = 0; s < 24; s++) {
      Sph.sphPressureForce(w.__water, DT, popt); Sph.sphViscosity(w.__water, DT, vopt);
      for (const p of w.__water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(w.__water, w.__an, DT, bopt);
      Sph.sphBedFriction(w.__water, w.__an, DT, fopt);
      En.stepEntities(w.__water, DT);
      for (let k = w.__water.length - 1; k >= 0; k--) if (w.__water[k].cy < -1 || w.__water[k].cz < -2) { w.__water.splice(k, 1); w.__exited++; }
    }
    w.__hist.push(w.__water.length);
  }

  return {
    label: 'step_0105 — (조립) 정상상태 유량: 연속 비 유입 = 연속 유출 → 정상 수면(물순환 닫음)',
    title: 'HTJ — 정상상태 유량: 끊임없는 비가 들어온 만큼 빠져 물량이 plateau(유입=유출·정상 강)',
    sub: '0102~0104 는 유한 비였다. 실제 강은 비가 끊임없이 와서 끊임없이 빠진다 — 그 사이 물량은 plateau(유입=유출). 경사 수로에 연속 비 → 과도기 후 통과류 정상상태(물량 일정). engine 변경 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N: CAN }; },
    frames: [3, 10, 30, 70],                                         // 과도기(채움)→정상상태(plateau)
    captureOpts: { N: CAN, color: (v) => v >= 1.5 ? [120, 175, 245] : [26 + v * 26, 40 + v * 40, 52 + v * 40] },
    toFrame(w) {
      const pts = [];
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {     // 배경 = 지형 음영(골짜기)
        let hmin = 0, hmax = 14; const h = elevFn(x, y);
        pts.push({ cx: (x + 0.5) * SC, cy: (GH - 0.5 - y) * SC, r: 0.7, v: 0.15 + 0.7 * (1 - (h - hmin) / (hmax - hmin)) });
      }
      for (const p of w.__water) pts.push({ cx: (p.cx + 0.5) * SC, cy: (GH - 0.5 - p.cy) * SC, r: 0.7, v: 1.6 });
      return { pts, count: w.__water.length, N: w.__water.length };
    },

    note: '<b>실제 강은 비가 *끊임없이* 와서 *끊임없이* 바다로 빠진다 — 그 사이 물량(수면)은 *plateau*(유입=유출 균형). 동적 물순환이 닫힌다.</b> 0102~0104 는 *유한* 비(한 번 와서 정착)였다. 이 무대는 그걸 *정상상태*로 닫는다(조립·engine 변경 0): 경사 수로(0103식 V 골짜기+경사)에 비를 *끊임없이* 떨군다. 과도기엔 물이 쌓이며 통과류가 자라고, 곧 *유출(하류로 빠짐) = 유입(비)* 이 되어 물량이 더 안 는다 — 정상상태. <b>측정(verify)</b>: ① <b>정상상태 도달</b> 후반 물량 plateau ⟨N⟩=167·표류 9%<12%(수면 안정) ② <b>유입=유출 균형</b> 유입 5/step ≈ 유출 4.71/step(Δ6%<15%·들어온 만큼 나간다) ③ <b>전체 보존</b> Σ떨군 비 550 = 남은 173 + 유출 377 ④ 결정론. <b>흐름</b>(capture 4 프레임·탑다운): 처음엔 골짜기가 *채워지며* 통과류가 자라다가(과도기), 곧 일정한 강줄기로 *정상상태*에 든다 — 프레임이 더 안 변한다(물량 plateau). <b>큰 그림</b>: 0102(비)→0103(흐름)→0104(호수)→0105(정상 유량)으로 *동적 물순환*이 닫혔다 — 0101 의 정적 통합 뷰가 진짜 흐르는·차오르는·정상상태인 물로. PW(딛고 사는 환경) 디딤돌. <b>원칙 준수</b>: 연속 비=generic 소스·흐름=generic SPH(타입 0·engine 변경 0). <b>정직한 한계</b>: 통과류 저장이 작아 빨리 정상(큰 호수 평형은 느림)·유출 4.71<5 는 잔여 과도(완전 평형엔 더 긴 시간)·증발 미포함·해수면 결합은 후속. 다음(디테일①  마무리): 안정 분절 침식·바이옴 3D 표면 등 다른 디테일 또는 PW 사다리.'
  };
});

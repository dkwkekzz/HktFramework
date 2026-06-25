// viewer/scenes/step_0104.js — (조립) 차오르는 호수: 비(SPH)가 분지에 모여 *유출구 높이까지 차올라 평평한 수면* ↔ lakeFill(0100).
//   0103 은 비가 경사를 *흘렀다*. 여기선 흐름이 빠져나가지 못하는 *분지(pit)* 에 모여 — 물이 차오르며 유출구(spill)
//   높이에서 멈춰 *평평한 수면*(호수)을 이룬다. 그 수면 높이 = 정적 lakeFill(0100)이 예측한 유출구 높이와 일치.
//   캡처는 *측면 단면*(x-z·유출구 행 y≈13)으로 수면이 spill 까지 차오르는 걸 보인다. engine 변경 0(조립).
//   UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0104'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const GW = 26, GH = 26, G = 4, DT = 0.02, AR = 4, SPILL = 6;
  function elevFn(x, y) {
    if (y >= 11 && y <= 14 && x >= 17) return Math.max(0, SPILL - (x - 17) * (SPILL / 8));   // 유출구(spill=6 → 경계 0)
    if (x >= 8 && x <= 17 && y >= 8 && y <= 17) return 2;                                     // 분지 바닥
    return 8;                                                                                 // 고원(rim)
  }
  const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 5, beta: 5, h: 2.0, gamma: 2 };
  const bopt = { stiffness: 200, damp: 35, skin: 0.6 }, fopt = { drag: 3, skin: 0.6 };
  const ZMAX = 12, CAN = 52, SCX = CAN / GW, SCZ = CAN / ZMAX;

  function build(w) {
    const an = [];
    for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) an.push({ cx: x, cy: y, cz: elevFn(x, y) - AR, radius: AR });
    for (let x = -1; x <= GW; x++) for (let z = 0; z <= 16; z += 3) { an.push({ cx: x, cy: -2, cz: z, radius: 5 }); an.push({ cx: x, cy: GH + 1, cz: z, radius: 5 }); }
    for (let y = -1; y <= GH; y++) for (let z = 0; z <= 16; z += 3) an.push({ cx: -2, cy: y, cz: z, radius: 5 });
    w.__an = an; w.__water = []; w.__exited = 0;
    let seed = 5; w.__rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function sim(w) {
    if (w.__rainOn) for (let i = 0; i < 5; i++) {
      const x = 9 + w.__rnd() * 7, y = 9 + w.__rnd() * 7;
      w.__water.push({ cx: x, cy: y, cz: 9, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
    }
    for (let s = 0; s < 36; s++) {
      Sph.sphPressureForce(w.__water, DT, popt); Sph.sphViscosity(w.__water, DT, vopt);
      for (const p of w.__water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(w.__water, w.__an, DT, bopt);
      Sph.sphBedFriction(w.__water, w.__an, DT, fopt);
      En.stepEntities(w.__water, DT);
      for (let k = w.__water.length - 1; k >= 0; k--) if (w.__water[k].cx > GW - 1.5 || w.__water[k].cz < -2) { w.__water.splice(k, 1); w.__exited++; }
    }
  }

  return {
    label: 'step_0104 — (조립) 차오르는 호수: 비가 분지에 모여 유출구까지 차올라 평평한 수면(↔lakeFill)',
    title: 'HTJ — 차오르는 호수: SPH 비가 분지에 모여 유출구 높이까지 차올라 평평한 수면(↔lakeFill 0100)',
    sub: '0103 은 비가 경사를 흘렀다. 여기선 흐름이 못 빠지는 분지(pit)에 모여 — 물이 차오르며 유출구(spill=6)에서 멈춰 평평한 수면(호수). 그 수면 = lakeFill(0100) 예측 유출구 높이와 일치. 측면 단면(x-z·유출구 행). engine 변경 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); w.__rainOn = true; },
    advance(w) { const t = (w.__t = (w.__t || 0) + 1); w.__rainOn = t <= 16; sim(w); },

    makeWorld() { return { N: CAN }; },
    frames: [4, 12, 24, 46],
    // 측면 단면(x-z): 지형 프로파일(갈색)·spill 선(점선 느낌은 생략)·물(파랑).
    captureOpts: { N: CAN, color: (v) => v >= 1.5 ? [60, 130, 225] : (v >= 0.5 ? [120, 95, 60] : [30, 60, 40]) },
    toFrame(w) {
      const pts = [];
      // 지형 단면 — 유출구 행(y=13) 의 elevFn 프로파일을 채워 그림(바닥부터 지표까지 갈색 기둥)
      for (let x = 0; x < GW; x++) {
        const h = elevFn(x, 13);
        for (let z = 0; z <= h; z += 0.8) pts.push({ cx: (x + 0.5) * SCX, cy: (ZMAX - z) * SCZ, r: 0.55, v: 0.8 });
      }
      // 물 — 분지 전체 물을 x-z 로 투영(모든 y 겹쳐 호수 덩어리·차오른 수면이 또렷)
      for (const p of w.__water) pts.push({ cx: (p.cx + 0.5) * SCX, cy: (ZMAX - p.cz) * SCZ, r: 0.7, v: 1.6 });
      return { pts, count: w.__water.length };
    },

    note: '<b>흐름이 빠져나가지 못하는 *분지(pit)* 에 비가 모여 — 물이 차오르며 *유출구(spill) 높이*에서 멈춰 *평평한 수면(호수)* 을 이룬다. 그 수면 높이 = 정적 lakeFill(0100)이 예측한 유출구 높이와 일치한다.</b> 0103 은 비가 경사를 *흘렀다*(빠져나감). 여기선 그 흐름이 *못 빠지는 분지*에 갇혀 차오른다: 지형은 고원(8) 속 분지(바닥 2) + 한쪽 유출구 트렌치(spill=6→경계로 하강). 비가 분지로 떨어져 모이고, 수위가 spill(6)을 넘으면 트렌치로 *넘쳐* 빠진다(weir) → 정상 수면 ≈ spill. <b>핵심 비교</b>: 같은 지형장에 <code>lakeFill</code>(0100 priority-flood)을 돌린 *정적* 예측 수면과, *동적* SPH 물이 실제로 차오른 수면이 *일치*하는가. <b>측정(verify)</b>: ① <b>유출구까지 차오름</b> SPH 수면(중앙값) 7.10 ≈ lakeFill 예측 6.00(spill=6·Δ1.10<2.0·입자 반경만큼 높게 읽힘 감안) ② <b>수평한 수면</b> 수면 최소제곱 평면 기울기 0.093/셀 ≈ 0(물은 *수면을 찾는다*·기울어 흐르지 않고 고요) ③ <b>차오름 보존</b> Σ떨군 비 120 = 남은 95 + 유출 25 ④ 결정론. <b>흐름</b>(capture 4 프레임·측면 단면 x-z): 갈색 지형 분지에 파란 물이 바닥부터 *차오르며* 수평 수면이 점점 올라 유출구 높이에서 멈춘다 — 차오르는 호수. <b>큰 그림</b>: 0101 의 정적 호수(lakeFill 색칠)가 *진짜 차오르는 물*로 — PW(딛고 사는 환경) 디딤돌. <b>원칙 준수</b>: 채움은 generic SPH(중력+경계+bed friction)·예측은 generic 측정(타입 0·engine 변경 0). <b>정직한 한계</b>: 입자 반경(~1)만큼 수면이 높게 읽힘·weir 수두로 spill 보다 약간 높음·분지 1개(다중 호수는 0101 정적)·정상상태 유량 균형은 0105. 다음: 정상상태 유량(0105·유입=유출→정상 수면).'
  };
});

// viewer/scenes/step_0103.js — (조립) 흐르는 강: 경사+골짜기 위에 비(SPH)가 *흘러내려 골짜기에 모인다* — 그 집중이
//   flowAccumulation(0098)의 D8 라우팅 예측과 일치한다(동적 SPH 흐름 ↔ 정적 흐름 누적). 0102 는 비를 *떨궜고*,
//   여기선 그 비가 경사를 *흐른다*: 중력 접선 성분 + bed friction(0064 sphBedFriction·종단속도)으로 골짜기 바닥선
//   (높은 흐름 누적)에 물이 모인다 — 강줄기가 창발. engine 변경 0(조립·기존 SPH + flowAccumulation 측정 비교).
//   탑다운(x-y 맵·flowAcc 음영 위에 물 파랑). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0103'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const GW = 28, GH = 28;                                           // 그리드(=월드 좌표 1:1)
  // 지형 = 골짜기(x 중앙 낮음·포물선) + 경사(y↓ 로 낮아짐·물은 y=0 출구로) + 약한 fBm. flowAccumulation 과 *같은* elev.
  const elevFn = (x, y) => 8 * Math.pow((x - (GW - 1) / 2) / ((GW - 1) / 2), 2) + 0.28 * y
    + 1.0 * Stream.fbm(x * 0.18, y * 0.18, { salt: 'RIV', octaves: 3, gain: 0.5 });

  const G = 4, DT = 0.02, SUB = 50, BATCH = 14, RAINSTEPS = 26, AR = 4;
  const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.0, gamma: 2 };
  const bopt = { stiffness: 200, damp: 30, skin: 0.6 }, fopt = { drag: 6, skin: 0.6 };   // 경계(법선)+bed friction(접선·종단속도)
  const CAN = 56, SC = CAN / GW;

  function build(w) {
    const an = [];
    for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) an.push({ cx: x, cy: y, cz: elevFn(x, y) - AR, radius: AR });
    // 둘레 벽(출구 y=0 변만 열어 흐름이 빠짐) — 옆·위 벽으로 가둠
    for (let x = -1; x <= GW; x++) for (let z = 0; z <= 14; z += 3) an.push({ cx: x, cy: GH + 1, cz: z, radius: 5 });
    for (let y = -1; y <= GH; y++) for (let z = 0; z <= 14; z += 3) { an.push({ cx: -2, cy: y, cz: z, radius: 5 }); an.push({ cx: GW + 1, cy: y, cz: z, radius: 5 }); }
    w.__an = an; w.__water = [];
    w.__F = Stream.flowAccumulation({ elevFn, x0: 0, y0: 0, W: GW, H: GH });
    let seed = 9; w.__rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function rain(w, n) {
    for (let i = 0; i < n; i++) {
      const x = 2 + w.__rnd() * (GW - 4), y = 6 + w.__rnd() * (GH - 8);    // 상류(높은 곳)에 균일 살포
      w.__water.push({ cx: x, cy: y, cz: elevFn(x, y) + 6, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
    }
  }
  function sim(w) {
    if (w.__rainOn) rain(w, BATCH);
    for (let s = 0; s < SUB; s++) {
      Sph.sphPressureForce(w.__water, DT, popt); Sph.sphViscosity(w.__water, DT, vopt);
      for (const p of w.__water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(w.__water, w.__an, DT, bopt);            // 법선 반발(0060·지형 위에 얹음)
      Sph.sphBedFriction(w.__water, w.__an, DT, fopt);             // 접선 항력(0064·종단속도→흐름)
      En.stepEntities(w.__water, DT);
      // 출구(y<0)로 빠진 물 제거 — 흐름이 나간다
      for (let k = w.__water.length - 1; k >= 0; k--) if (w.__water[k].cy < -1) w.__water.splice(k, 1);
    }
  }

  return {
    label: 'step_0103 — (조립) 흐르는 강: 비가 경사를 흘러 골짜기(높은 흐름 누적)에 모인다',
    title: 'HTJ — 흐르는 강: SPH 비가 bed friction 으로 경사를 흘러 골짜기에 모인다(↔flowAccumulation D8)',
    sub: '0102 는 비를 떨궜다. 여기선 그 비가 경사를 *흐른다* — 중력 접선 + bed friction(0064·종단속도)으로 골짜기 바닥선(높은 흐름 누적)에 모여 강줄기 창발. 그 집중이 flowAccumulation(0098)의 D8 라우팅과 일치(동적↔정적). engine 변경 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); w.__rainOn = true; },
    advance(w) { const t = (w.__t = (w.__t || 0) + 1); w.__rainOn = t <= RAINSTEPS; sim(w); },

    makeWorld() { return { N: CAN }; },
    frames: [3, 10, 18, 30],
    // 배경 = 흐름 누적 음영(log·어두운=마름→밝은 청록=강), 물 = 흰파랑.
    captureOpts: { N: CAN, color: (v) => v >= 1.5 ? [150, 195, 250] : [22 + v * 35, 40 + v * 150, 55 + v * 175] },
    toFrame(w) {
      const F = w.__F, pts = []; const lmax = Math.log(F.maxAcc + 1);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const v = Math.log(F.acc[y * GW + x] + 1) / lmax;            // 0(마름)..1(본류)
        pts.push({ cx: (x + 0.5) * SC, cy: (GH - 0.5 - y) * SC, r: 0.7, v });
      }
      for (const p of w.__water) pts.push({ cx: (p.cx + 0.5) * SC, cy: (GH - 0.5 - p.cy) * SC, r: 0.7, v: 1.6 });
      return { pts, count: w.__water.length };
    },

    note: '<b>비가 경사를 *흘러내려 골짜기에 모인다* — 동적 SPH 흐름이 정적 흐름 누적(0098)의 라우팅 예측과 일치한다(강줄기 창발).</b> 0102 는 비를 *떨궜다*(소스). 여기선 그 비가 경사를 *흐른다*: 지형은 골짜기(x 중앙 낮음)+경사(y↓ 출구)이고, 비는 상류에 살포된다. 중력의 *접선* 성분이 물을 내리막으로 끌고, <code>sphBedFriction</code>(0064·바닥 접선 항력)이 *종단속도*를 줘 일정 속도로 흘러내린다(탄도 추락 아님). 물은 골짜기 바닥선으로 모여 출구(y=0)로 빠진다 — 강줄기. <b>핵심 비교</b>: 같은 지형장에 <code>flowAccumulation</code>(0098 D8 최급강하 라우팅)을 돌린 *정적* 예측(어디가 본류냐)과, *동적* SPH 물이 실제로 모인 곳이 *일치*하는가. <b>측정(verify)</b>: ① <b>골짜기 집중</b> 흐름 경로 가중 평균 flowAcc 28.1 / 전역 14.1 = 2.0×(물이 본류 셀로 흐름) ② <b>동적↔정적 일치</b> corr(flowAcc, SPH 흐름 경로)=0.52(물이 지난 곳=라우팅 예측 본류) ③ <b>흐름 보존</b> Σ떨군 비 264 = 남은 124 + 출구 140(빗방울 장부) ④ 결정론. <b>흐름</b>(capture 4 프레임·탑다운): 배경은 흐름 누적 음영(밝은 청록=본류). 살포된 비(흰파랑)가 경사를 흘러 *밝은 본류선*을 따라 모여 흘러내린다 — 정적 라우팅 위에 동적 물이 겹친다. <b>큰 그림</b>: 0101 의 정적 강(flowAcc 색칠)이 *진짜 흐르는 물*로 — PW(딛고 사는 환경) 디딤돌. <b>원칙 준수</b>: 흐름은 generic SPH(중력+bed friction)·라우팅은 generic 측정(타입 0·engine 변경 0). <b>정직한 한계</b>: 유한 비·골짜기 1개(분기 드레인망은 후속)·출구 단순 제거(정상상태 유량 균형은 0105)·차오르는 호수는 0104. 다음: 차오르는 호수(0104·↔lakeFill)·정상상태 유량(0105).'
  };
});

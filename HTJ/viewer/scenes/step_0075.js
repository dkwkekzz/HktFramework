// viewer/scenes/step_0075.js — 침식: 흐르는 물(SPH)이 침식가능 바닥을 *깎아 내려간다*(물이 땅을 빚는다·물↔지형 왕복).
//   0064(TW3 강)는 물을 경사 채널로 흘렸으나 바닥은 *정적*이었다(물→지형 일방). 이 step 은 새 엔진 법칙
//   sphSedimentErosion 으로 그 일방을 왕복으로 닫는다: 흐름이 빠른 곳은 바닥을 깎아 싣고(침식·물이 갈색으로
//   탁해짐), 느린 곳은 내려놓는다(퇴적). 깎인 만큼 바닥 반경이 줄어 *물이 따라 내려간다*(2-way 결합·다음 step 의
//   0060 경계가 갱신된 radius 를 읽음). x-z 단면(강 옆모습)·회색=바닥(시간 따라 내려감)·파랑=맑은 물·갈색=퇴적물 실은 물.
//
//   engine 법칙(htj-sph.js sphSedimentErosion·VER 16) — 0064 강 무대 재사용. UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0075'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  const R0 = 600, XC = 145.5, ZC = -567.6, HWy = 6, BRw = 200, G = 4, DT = 0.02;
  function wp(cx, cy, cz) { return { cx, cy, cz, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1, sediment: 0 }; }

  function build(w) {
    const floor0 = (x) => ZC + Math.sqrt(Math.max(0, R0 * R0 - (x - XC) * (x - XC)));
    // 램프 바닥(erodable·bed=radius)·댐(좌)·상류 back(우)·y 벽(채널). 0064 와 같은 골격.
    w.__anchors = [
      { cx: XC, cy: 0, cz: ZC, radius: R0, bed: R0 },
      { cx: -(BRw + 52), cy: 0, cz: floor0(-50), radius: BRw, bed: BRw }, { cx: (BRw + 52), cy: 0, cz: floor0(50), radius: BRw, bed: BRw },
      { cx: 0, cy: -(BRw + HWy), cz: floor0(0), radius: BRw, bed: BRw }, { cx: 0, cy: (BRw + HWy), cz: floor0(0), radius: BRw, bed: BRw },
    ];
    w.__ramp = w.__anchors[0];
    w.__popt = { stiffness: 90, h: 2.0, gamma: 2 }; w.__vopt = { alpha: 1.5, beta: 2, h: 2.0, gamma: 2 }; w.__bopt = { stiffness: 150, damp: 30, skin: 0.6 };
    w.__water = []; w.__seed = 7; w.__s = 0;
  }
  function floorZ(w, x) { const R = w.__ramp.radius; return ZC + Math.sqrt(Math.max(0, R * R - (x - XC) * (x - XC))); }
  function sim(w, n) {
    const dt = DT, A = w.__anchors;
    const rnd = () => { w.__seed = (Math.imul(w.__seed, 1664525) + 1013904223) >>> 0; return w.__seed / 4294967296; };
    for (let k = 0; k < n; k++) {
      w.__s++;
      if (w.__water.length < 180 && w.__s % 18 === 0) for (let j = 0; j < 3; j++) { const x = 46 - rnd() * 4; w.__water.push(wp(x, (rnd() - 0.5) * 8, floorZ(w, x) + 3 + rnd() * 3)); }
      Sph.sphPressureForce(w.__water, dt, w.__popt); Sph.sphViscosity(w.__water, dt, w.__vopt);
      for (const p of w.__water) p.pz -= p.mass * G * dt;
      Sph.sphBoundaryForce(w.__water, A, dt, w.__bopt); Sph.sphBedFriction(w.__water, A, dt, { drag: 0.6, skin: w.__bopt.skin });
      // 침식 약하게 + minBed 캡(바닥이 화면 밖으로 안 슬라이드)·갈색 퇴적물 운반이 주연.
      Sph.sphSedimentErosion(w.__water, A, dt, { erodeRate: 0.12, capacity: 0.32, skin: w.__bopt.skin, minBed: R0 - 24 });
      En.stepEntities(w.__water, dt);
    }
  }

  // x-z 단면 투영(강 옆모습): 우(+x)=상류 高·좌(−x)=하류 댐 低. 바닥은 *현재* radius 로 그려 시간 따라 내려감.
  const Nc = 64, HWx = 52, OX = Nc * 0.5, OZ = Nc * 0.74, SC = Nc * 0.92 / (2 * HWx);
  const speed = (p) => Math.hypot(p.px, p.py, p.pz) / p.mass;

  return {
    label: 'step_0075 — 침식: 흐르는 물이 침식가능 바닥을 깎아 내려간다(물↔지형 왕복)',
    title: 'HTJ — 침식: 물이 땅을 빚는다(흐르는 물이 바닥을 깎아 싣고 내려놓는다·바닥이 따라 내려감)',
    sub: '0064(강)는 물을 흘렸으나 바닥은 정적이었다(물→지형 일방). 새 엔진 법칙 sphSedimentErosion 이 그 일방을 왕복으로: 빠른 흐름은 바닥을 깎아 싣고(침식·물이 갈색으로 탁해짐) 느린 곳은 내려놓는다(퇴적). 깎인 만큼 바닥 반경이 줄어 물이 따라 내려간다(2-way 결합). Σbed+Σsediment 보존·0064 동역학 불변(erodeRate=0). x-z 단면.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w, 1666); },

    makeWorld() { return { N: Nc }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N: Nc, color: (v) => v >= 2.5 ? [70, 76, 92] : v >= 1 ? [120 + (v - 1) * 70, 78 + (v - 1) * 24, 48] : [40 + v * 90, 95 + v * 120, 195 + v * 55] },
    toFrame(w) {
      const pts = [];
      // 바닥(현재 radius)·댐·상류벽 — 회색(v=3). 바닥은 floorZ(현재) 라 침식되면 내려간다.
      for (let x = -HWx; x <= HWx + 1e-9; x += 2.5) pts.push({ cx: OX + x * SC, cy: OZ - floorZ(w, x) * SC, r: 0.5, v: 3 });
      for (let z = 0; z <= 14 + 1e-9; z += 1.5) pts.push({ cx: OX - HWx * SC, cy: OZ - (floorZ(w, -50) + z) * SC, r: 0.5, v: 3 });
      for (let z = 0; z <= 14 + 1e-9; z += 1.5) pts.push({ cx: OX + HWx * SC, cy: OZ - (floorZ(w, 50) + z) * SC, r: 0.5, v: 3 });
      // 물 — 맑은 물=파랑(밝기=속도)·퇴적물 실은 물=갈색(탁도=load).
      for (const p of w.__water) {
        const load = p.sediment || 0;
        const v = load > 0.25 ? 1 + Math.min(1, load / 2.5) * 0.95 : Math.min(0.95, speed(p) / 4);
        pts.push({ cx: OX + p.cx * SC, cy: OZ - p.cz * SC, r: 0.8, v });
      }
      const carved = R0 - w.__ramp.bed, susp = w.__water.reduce((s, p) => s + (p.sediment || 0), 0);
      return { pts, count: w.__water.length, carved: Math.round(carved * 10) / 10, suspended: Math.round(susp * 10) / 10 };
    },

    note: '<b>물이 땅을 빚는다 — 흐르는 물이 바닥을 *깎아 싣고*(침식) 느려지면 *내려놓는다*(퇴적).</b> 0064(TW3 강)는 물을 경사 채널로 흘렸지만 바닥은 *정적*이었다 — 물→지형 *일방*(거의 모든 지형 step 이 적은 공통 한계). 이 step 의 새 엔진 법칙 <code>sphSedimentErosion</code> 이 그 일방을 *왕복*으로 닫는다: 입자가 스칼라 <code>sediment</code> 를 운반하고, 흐름 용량 <b>C = capacity·|v_t|</b>(stream power·빠를수록 더 운반)보다 적게 실었으면 바닥(<code>A.bed</code>)을 깎아 싣고(침식·물이 <span style="color:#a86">갈색</span>으로 탁해짐), 넘치면 바닥에 내려놓는다(퇴적). <b>2-way 결합</b>: 깎인 만큼 <code>A.radius</code> 가 줄어 *물이 따라 내려간다*(다음 step 의 0060 경계력이 갱신 radius 를 읽음) — capture 에서 회색 바닥선이 흐름 아래로 *내려가는* 것이 그것. <b>보존</b>: 모든 이동은 bed↔load 쌍 이동 → Σbed+Σsediment 정확 보존(질량은 사라지지 않고 땅↔흐름을 오갈 뿐)·퇴적물은 수동 스칼라라 운동량·열 안 건드림(erodeRate=0 → 0064 정확 회귀). <b>원칙 준수</b>: 0064(접선 마찰)·0060(법선)과 같은 SPH↔앵커 *generic* 법칙(타입 모름·"지형/강" 분기 없음·바닥=generic 정적 경계). <b>흐름</b>(capture 4 프레임): 맑은 물이 상류서 흘러내리며 바닥을 깎아 갈색으로 탁해지고, 바닥(회색선)이 점점 내려가며, 하류 댐에 고인 느린 물은 퇴적물을 내려놓는다. <b>정직한 한계</b>: 바닥이 단일 큰 램프라 *균일하게* 내려간다(공간적 협곡/삼각주는 분절 바닥이 필요한데 분절 SPH 바닥은 새어 불안정 — verify 는 규정 흐름으로 빠른 곳 깎임·느린 곳 쌓임을 보이고, 안정 분절 결합은 후속)·퇴적물 수동 스칼라(운반이 운동량엔 무영향·실제 하중은 후속)·정적 minBed 바닥(기반암 한계). 다음: 안정 분절 침식(공간 협곡)·SW5 격자 은퇴.'
  };
});

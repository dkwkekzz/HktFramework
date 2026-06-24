// step_0075/verify.js — 침식(SPH 퇴적물 운반: 바닥↔흐름 용량 기반 교환) 검증. 순수·독립.
//   새 거동 = 흐르는 물(SPH)이 바닥(앵커)을 *깎아 싣고*(load<용량) 느려지면 *내려놓는다*(load>용량) → 흐름이
//   땅을 빚는다(지형 정적·물→지형 일방 해소). 빠른 상류는 깎이고 느린 하류는 쌓여 graded 단면 창발.
//   보존(Σbed+Σsediment)·항등(erodeRate=0→0064 회귀)·결정론은 tools/htj-verify-lib.js 공용 가드.
//   실행: node HTJ/steps/step_0075/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const EPS = 1e-9;

function wp(cx, cy, cz, vx, sed) { return { cx, cy, cz, mass: 1, px: vx || 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1, sediment: sed || 0 }; }
function budget(parts, anchors) { let b = 0, s = 0; for (const A of anchors) b += (A.bed != null ? A.bed : A.radius); for (const p of parts) s += (p.sediment || 0); return b + s; }

// ① 침식+퇴적 (새 거동·controlled) — 빠른 빈 입자는 바닥을 깎아 싣고(bed↓·load↑), 느린 가득 입자는 내려놓는다(bed↑·load↓).
(() => {
  // 침식: 표면 위(pen>0)에서 접선(+x)으로 빠르게 미끄러지는 빈 입자.
  const aE = [{ cx: 0, cy: 0, cz: -10, radius: 10.5, bed: 10.5 }];   // 바닥 앵커(표면 z≈0.5)
  const pE = [wp(0, 0, 0.3, 6, 0)];                                  // z=0.3(pen>0)·vx=6(빠른 흐름)·load 0
  const bed0 = aE[0].bed, sed0 = pE[0].sediment;
  Sph.sphSedimentErosion(pE, aE, 0.05, { erodeRate: 0.8, capacity: 1, skin: 0.4 });
  const eroded = aE[0].bed < bed0 - 1e-6 && pE[0].sediment > sed0 + 1e-6 && Math.abs(aE[0].radius - aE[0].bed) < 1e-12;
  // 퇴적: 거의 멈춘(접선 느린) 가득 실은 입자 → 용량 초과분을 바닥에 내려놓음.
  const aD = [{ cx: 0, cy: 0, cz: -10, radius: 10.5, bed: 10.5 }];
  const pD = [wp(0, 0, 0.3, 0.2, 5)];                               // vx=0.2(느림·용량 작음)·load 5(과적)
  const bedD0 = aD[0].bed, sedD0 = pD[0].sediment;
  Sph.sphSedimentErosion(pD, aD, 0.05, { erodeRate: 0.8, capacity: 1, skin: 0.4 });
  const deposited = aD[0].bed > bedD0 + 1e-6 && pD[0].sediment < sedD0 - 1e-6;
  ok(eroded && deposited,
    `침식+퇴적 — 빠른 빈 입자: bed ${bed0}→${aE[0].bed.toFixed(3)}↓·load 0→${pE[0].sediment.toFixed(3)}↑(깎아 싣음) · 느린 가득 입자: bed ${bedD0}→${aD[0].bed.toFixed(3)}↑·load 5→${pD[0].sediment.toFixed(3)}↓(내려놓음)`);
})();

// ② 실제 강 침식 창발 (조립·강 무대) — 진짜 SPH 강(0064 무대)이 침식가능 바닥을 *흘러내리며 깎는다*(물이 땅을 빚는다).
//   기울인 큰 램프 바닥이 erodable → 물이 흐르는 동안 bed(반경)가 줄고(깎임) 부유 퇴적물이 생긴다. 깎인 만큼
//   A.radius 가 줄어 *물이 따라 내려간다*(2-way 결합·다음 step 0060 경계가 갱신 radius 를 읽음). Σbed+Σsediment 보존.
(() => {
  const R = 600, XC = 145.5, ZC = -567.6, HWy = 6, BRw = 200, G = 4, dt = 0.02;
  const floorZ = (x) => ZC + Math.sqrt(Math.max(0, R * R - (x - XC) * (x - XC)));
  const anchors = [
    { cx: XC, cy: 0, cz: ZC, radius: R, bed: R },                  // 램프 바닥(erodable)
    { cx: -(BRw + 52), cy: 0, cz: floorZ(-50), radius: BRw, bed: BRw }, { cx: (BRw + 52), cy: 0, cz: floorZ(50), radius: BRw, bed: BRw },
    { cx: 0, cy: -(BRw + HWy), cz: floorZ(0), radius: BRw, bed: BRw }, { cx: 0, cy: (BRw + HWy), cz: floorZ(0), radius: BRw, bed: BRw },
  ];
  const ramp = anchors[0], before = budget([], anchors);
  const popt = { stiffness: 90, h: 2.0, gamma: 2 }, vopt = { alpha: 1.5, beta: 2, h: 2.0, gamma: 2 }, bopt = { stiffness: 150, damp: 30, skin: 0.6 };
  let water = [], seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let s = 1; s <= 5000; s++) {
    if (water.length < 180 && s % 18 === 0) for (let j = 0; j < 3; j++) { const x = 46 - rnd() * 4; water.push(wp(x, (rnd() - 0.5) * 8, floorZ(x) + 3 + rnd() * 3)); }
    Sph.sphPressureForce(water, dt, popt); Sph.sphViscosity(water, dt, vopt);
    for (const w of water) w.pz -= w.mass * G * dt;
    Sph.sphBoundaryForce(water, anchors, dt, bopt); Sph.sphBedFriction(water, anchors, dt, { drag: 0.6, skin: bopt.skin });
    Sph.sphSedimentErosion(water, anchors, dt, { erodeRate: 0.4, capacity: 0.4, skin: bopt.skin, minBed: 0 });
    En.stepEntities(water, dt);
  }
  const carved = R - ramp.bed, susp = water.reduce((s, w) => s + (w.sediment || 0), 0);
  const conserved = Math.abs(budget(water, anchors) - before) / before < 1e-9;
  ok(carved > 5 && susp > 0 && conserved && Math.abs(ramp.radius - ramp.bed) < 1e-9,
    `실제 강 침식 창발 — 흐르는 물이 램프 바닥을 ${carved.toFixed(2)} 깎음(bed ${R}→${ramp.bed.toFixed(1)}·radius 따라감→물이 내려감) · 부유 퇴적물 ${susp.toFixed(2)} · Σbed+Σsed 보존 ${conserved}`);
})();

// ③ 질량 보존 (공용 가드) — Σ bed + Σ sediment 는 침식/퇴적 전후 정확 보존(땅↔흐름 쌍 이동).
(() => {
  const anchors = [{ cx: 0, cy: 0, cz: -10, radius: 10.5, bed: 10.5 }, { cx: 5, cy: 0, cz: -10, radius: 10.5, bed: 10.5 }];
  const parts = [wp(0, 0, 0.3, 5, 0), wp(5, 0, 0.3, 0.1, 4), wp(2.5, 0, 0.4, 3, 1)];
  const before = budget(parts, anchors);
  for (let t = 0; t < 30; t++) Sph.sphSedimentErosion(parts, anchors, 0.05, { erodeRate: 0.7, capacity: 1, skin: 0.4, minBed: 2 });
  show(L.conserved('Σ bed + Σ sediment', before, budget(parts, anchors)));
})();

// ④ 항등(노브=0→회귀 0·공용 가드) — erodeRate=0 → 바닥·입자 불변(0064 동역학 그대로).
(() => {
  const mk = () => ({ A: [{ cx: 0, cy: 0, cz: -10, radius: 10.5, bed: 10.5 }], P: [wp(0, 0, 0.3, 6, 0)] });
  const base = mk(); const zero = mk();
  Sph.sphSedimentErosion(zero.P, zero.A, 0.05, { erodeRate: 0, capacity: 1, skin: 0.4 });
  const snap = (x) => JSON.stringify([x.A.map(a => [a.bed, a.radius]), x.P.map(p => [p.sediment, p.px])]);
  show(L.identity('erodeRate=0 → bed·sediment 불변', snap(base), snap(zero)));
})();

// ⑤ 결정론 (공용 가드) — 같은 입력 → 같은 침식 결과.
show(L.deterministic('같은 흐름 → 같은 침식', () => {
  const A = [{ cx: 0, cy: 0, cz: -10, radius: 10.5, bed: 10.5 }];
  const P = [wp(0, 0, 0.3, 6, 0), wp(0.5, 0, 0.35, 4, 0.5)];
  for (let t = 0; t < 10; t++) Sph.sphSedimentErosion(P, A, 0.05, { erodeRate: 0.6, capacity: 1, skin: 0.4, minBed: 2 });
  return [A.map(a => a.bed.toFixed(6)), P.map(p => (p.sediment).toFixed(6))];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

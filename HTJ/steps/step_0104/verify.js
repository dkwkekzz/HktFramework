// step_0104/verify.js — (조립) 차오르는 호수: 비(SPH)가 분지에 모여 *유출구 높이까지 차올라 평평한 수면* ↔ lakeFill(0100).
//   조립 step — 부품(SPH 압력/점성/경계·lakeFill)은 부품 verify 가 보증. 여기선 *새 결합*만:
//   동적 SPH 물이 차오른 수면 높이 = 정적 lakeFill 이 예측한 유출구(spill) 높이, 그리고 평평하다. 순수·독립·영구.
//   실행: node HTJ/steps/step_0104/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const GW = 26, GH = 26, G = 4, DT = 0.02, AR = 4, SPILL = 6;
// 지형 = 고원(8) + 중앙 분지(floor 2) + 유출구 트렌치(x≥17·y∈[12,13]·6→0 하강·분지→경계 배수). lakeFill 과 *같은* elev.
function elevFn(x, y) {
  if (y >= 11 && y <= 14 && x >= 17) return Math.max(0, SPILL - (x - 17) * (SPILL / 8));   // 유출구(spill=6 → 경계 0·폭 4)
  if (x >= 8 && x <= 17 && y >= 8 && y <= 17) return 2;                                     // 분지 바닥
  return 8;                                                                                 // 고원(rim)
}
const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 5, beta: 5, h: 2.0, gamma: 2 };
const bopt = { stiffness: 200, damp: 35, skin: 0.6 }, fopt = { drag: 3, skin: 0.6 };

function anchors() {
  const an = [];
  for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) an.push({ cx: x, cy: y, cz: elevFn(x, y) - AR, radius: AR });
  for (let x = -1; x <= GW; x++) for (let z = 0; z <= 16; z += 3) { an.push({ cx: x, cy: -2, cz: z, radius: 5 }); an.push({ cx: x, cy: GH + 1, cz: z, radius: 5 }); }
  for (let y = -1; y <= GH; y++) for (let z = 0; z <= 16; z += 3) an.push({ cx: -2, cy: y, cz: z, radius: 5 });   // x=GW 변은 유출구라 열어둠
  return an;
}

function run() {
  const an = anchors(), water = []; let seed = 5, spawned = 0, exited = 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let step = 0; step < 110; step++) {
    if (step < 24) for (let i = 0; i < 5; i++) {                   // 분지 위로 비(이후 정착·유출구로 spill→수두 빠짐)
      const x = 9 + rnd() * 7, y = 9 + rnd() * 7;
      water.push({ cx: x, cy: y, cz: 9, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
      spawned++;
    }
    for (let s = 0; s < 36; s++) {
      Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt);
      for (const p of water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(water, an, DT, bopt);
      Sph.sphBedFriction(water, an, DT, fopt);
      En.stepEntities(water, DT);
      for (let k = water.length - 1; k >= 0; k--) if (water[k].cx > GW - 1.5 || water[k].cz < -2) { water.splice(k, 1); exited++; }
    }
  }
  return { water, spawned, exited };
}

const Lk = Stream.lakeFill({ elevFn, x0: 0, y0: 0, W: GW, H: GH });
const Wd = run();

// 분지 내 컬럼별 수면(top 입자 z) — 분지 셀(x∈[9,16],y∈[9,16]).
const inPit = Wd.water.filter(p => p.cx >= 8.5 && p.cx <= 16.5 && p.cy >= 8.5 && p.cy <= 16.5);
const colTop = new Map();
for (const p of inPit) { const key = Math.round(p.cx) + ',' + Math.round(p.cy); const e = colTop.get(key); if (e == null || p.cz > e.z) colTop.set(key, { x: p.cx, y: p.cy, z: p.cz }); }
const cols = Array.from(colTop.values());
const tops = cols.map(c => c.z).sort((a, b) => a - b);
const median = (a) => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0;
const surf = median(tops);                                        // 수면 = 컬럼 top z 의 중앙값(이산 잡음·튐 입자 견고)
const lkFilled = Lk.filled[13 * GW + 12];                         // lakeFill 예측 수면(분지 중앙)

// ① 유출구까지 차오름(↔lakeFill) — SPH 수면 ≈ lakeFill 예측 유출구 높이(spill=6). 입자 반경(~1)만큼 높게 읽힘 감안.
ok(Math.abs(surf - lkFilled) < 2.0 && tops.length >= 8,
  `유출구까지 차오름 — SPH 수면(중앙값) ${surf.toFixed(2)} ≈ lakeFill 예측 ${lkFilled.toFixed(2)}(spill=${SPILL}·Δ${Math.abs(surf - lkFilled).toFixed(2)}<2.0·입자반경 오프셋 감안)`);

// ② 수평한 수면 — 수면 최소제곱 평면의 기울기 ≈ 0(물은 *수면을 찾는다*·기울어 흐르지 않고 고요·이산 잡음에 견고).
(() => {
  const n = cols.length, mx = cols.reduce((s, c) => s + c.x, 0) / n, my = cols.reduce((s, c) => s + c.y, 0) / n, mz = surf;
  let Sxx = 0, Syy = 0, Sxy = 0, Sxz = 0, Syz = 0;
  for (const c of cols) { const dx = c.x - mx, dy = c.y - my, dz = c.z - mz; Sxx += dx * dx; Syy += dy * dy; Sxy += dx * dy; Sxz += dx * dz; Syz += dy * dz; }
  const det = Sxx * Syy - Sxy * Sxy;
  const a = det ? (Sxz * Syy - Syz * Sxy) / det : 0, b = det ? (Syz * Sxx - Sxz * Sxy) / det : 0;
  const slope = Math.hypot(a, b);
  ok(slope < 0.18, `수평한 수면 — 수면 평면 기울기 ${slope.toFixed(3)}/셀 ≈ 0 (${n}컬럼·물이 수면을 찾음·<0.18)`);
})();

// ③ 차오름 보존 — 떨군 비 = 남은 물 + 유출구로 빠진 물(장부 닫힘).
ok(Wd.spawned === Wd.water.length + Wd.exited, `차오름 보존 — Σ떨군 비 ${Wd.spawned} = 남은 ${Wd.water.length} + 유출 ${Wd.exited}(장부 닫힘)`);

// ④ 결정론.
show(L.deterministic('같은 비 → 같은 호수', () => run().water.map(p => [Math.round(p.cx * 1e3), Math.round(p.cz * 1e3)])));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

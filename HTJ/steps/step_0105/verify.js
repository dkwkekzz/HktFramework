// step_0105/verify.js — (조립) 정상상태 유량: *연속* 강수 유입 = *연속* 유출 → 흔들림 없는 정상 수면(물순환 닫음).
//   조립 step — 부품(SPH·경계·bed friction)은 부품 verify 가 보증. 여기선 *새 결합*만:
//   비가 끊임없이 내리고 유출구로 끊임없이 빠지면, 과도기 후 물량(수면)이 *plateau* — 유입=유출 균형. 순수·독립·영구.
//   실행: node HTJ/steps/step_0105/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// 경사 수로(0103식) — 골짜기(x 중앙 낮음)+경사(y↓ 출구). 연속 비 → 통과류가 빨리 정상상태(저장 적음).
const GW = 24, GH = 24, G = 4, DT = 0.02, AR = 4, BATCH = 5;
const elevFn = (x, y) => 8 * Math.pow((x - (GW - 1) / 2) / ((GW - 1) / 2), 2) + 0.28 * y;   // 깨끗한 V 골짜기+경사
const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.0, gamma: 2 };
const bopt = { stiffness: 200, damp: 30, skin: 0.6 }, fopt = { drag: 6, skin: 0.6 };

function anchors() {
  const an = [];
  for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) an.push({ cx: x, cy: y, cz: elevFn(x, y) - AR, radius: AR });
  for (let x = -1; x <= GW; x++) for (let z = 0; z <= 16; z += 3) an.push({ cx: x, cy: GH + 1, cz: z, radius: 5 });   // 상류 벽
  for (let y = -1; y <= GH; y++) for (let z = 0; z <= 16; z += 3) { an.push({ cx: -2, cy: y, cz: z, radius: 5 }); an.push({ cx: GW + 1, cy: y, cz: z, radius: 5 }); }   // 옆벽(y=0 출구만 열림)
  return an;
}

function run() {
  const an = anchors(), water = []; let seed = 3, spawned = 0, exited = 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const count = [], exitStep = [];
  for (let step = 0; step < 110; step++) {                           // 끊임없이 상류에 비(과도기 후 plateau)
    for (let i = 0; i < BATCH; i++) {
      const x = 2 + rnd() * (GW - 4), y = GH - 4 - rnd() * 4;        // 상류(높은 y)에 살포
      water.push({ cx: x, cy: y, cz: elevFn(x, y) + 5, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
      spawned++;
    }
    let exThis = 0;
    for (let s = 0; s < 24; s++) {
      Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt);
      for (const p of water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(water, an, DT, bopt);
      Sph.sphBedFriction(water, an, DT, fopt);
      En.stepEntities(water, DT);
      for (let k = water.length - 1; k >= 0; k--) if (water[k].cy < -1 || water[k].cz < -2) { water.splice(k, 1); exited++; exThis++; }   // y=0 출구
    }
    count.push(water.length); exitStep.push(exThis);
  }
  return { water, spawned, exited, count, exitStep };
}

const Wd = run();
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const NS = Wd.count.length, half = Math.floor(NS / 2);
const steady = Wd.count.slice(half);                                // 후반 = 정상상태 창

// ① 정상상태 도달(plateau) — 후반 물량의 변화가 작다: |끝−중간| / 평균 ≪ 1(수면이 안정).
(() => {
  const m = mean(steady), drift = Math.abs(mean(Wd.count.slice(-10)) - mean(Wd.count.slice(half, half + 10)));
  const rel = drift / Math.max(m, 1);
  ok(rel < 0.12, `정상상태 도달 — 후반 물량 plateau ⟨N⟩=${m.toFixed(0)}·표류 ${drift.toFixed(0)}(${(100 * rel).toFixed(0)}%<12%·수면 안정)`);
})();

// ② 유입=유출 균형 — 정상상태 창에서 평균 유출/step ≈ 유입/step(BATCH): 들어온 만큼 나간다.
(() => {
  const outRate = mean(Wd.exitStep.slice(half));
  const rel = Math.abs(outRate - BATCH) / BATCH;
  ok(rel < 0.15, `유입=유출 균형 — 유입 ${BATCH}/step ≈ 유출 ${outRate.toFixed(2)}/step(Δ${(100 * rel).toFixed(0)}%<15%·물순환 닫힘)`);
})();

// ③ 전체 보존 — 떨군 비 = 남은 물 + 빠진 물(장부 닫힘).
ok(Wd.spawned === Wd.water.length + Wd.exited, `전체 보존 — Σ떨군 비 ${Wd.spawned} = 남은 ${Wd.water.length} + 유출 ${Wd.exited}(장부 닫힘)`);

// ④ 결정론.
show(L.deterministic('같은 강수 → 같은 정상 흐름', () => run().count));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

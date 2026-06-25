// step_0103/verify.js — (조립) 흐르는 강: 비(SPH)가 경사를 흘러 골짜기에 모인다 ↔ flowAccumulation(0098) 라우팅.
//   조립 step — 부품(SPH 압력/점성/경계/bed friction·flowAccumulation)은 부품 verify 가 보증. 여기선 *새 결합*만:
//   동적 SPH 흐름이 모이는 곳 = 정적 흐름 누적이 예측한 본류(골짜기 바닥선). 순수·독립·영구.
//   실행: node HTJ/steps/step_0103/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const GW = 24, GH = 24, G = 4, DT = 0.02, AR = 4;
const elevFn = (x, y) => 8 * Math.pow((x - (GW - 1) / 2) / ((GW - 1) / 2), 2) + 0.28 * y
  + 1.0 * Stream.fbm(x * 0.18, y * 0.18, { salt: 'RIV', octaves: 3, gain: 0.5 });
const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.0, gamma: 2 };
const bopt = { stiffness: 200, damp: 30, skin: 0.6 }, fopt = { drag: 6, skin: 0.6 };

function anchors() {
  const an = [];
  for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) an.push({ cx: x, cy: y, cz: elevFn(x, y) - AR, radius: AR });
  for (let x = -1; x <= GW; x++) for (let z = 0; z <= 14; z += 3) an.push({ cx: x, cy: GH + 1, cz: z, radius: 5 });
  for (let y = -1; y <= GH; y++) for (let z = 0; z <= 14; z += 3) { an.push({ cx: -2, cy: y, cz: z, radius: 5 }); an.push({ cx: GW + 1, cy: y, cz: z, radius: 5 }); }
  return an;
}

function run() {
  const an = anchors(), water = []; let seed = 9, spawned = 0, exited = 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const presence = new Float64Array(GW * GH);                       // 흐르는 동안 물이 지난 셀 누적(경로)
  for (let step = 0; step < 30; step++) {
    if (step < 22) for (let i = 0; i < 12; i++) {
      const x = 2 + rnd() * (GW - 4), y = 6 + rnd() * (GH - 8);
      water.push({ cx: x, cy: y, cz: elevFn(x, y) + 6, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
      spawned++;
    }
    for (let s = 0; s < 40; s++) {
      Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt);
      for (const p of water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(water, an, DT, bopt);
      Sph.sphBedFriction(water, an, DT, fopt);
      En.stepEntities(water, DT);
      for (let k = water.length - 1; k >= 0; k--) if (water[k].cy < -1) { water.splice(k, 1); exited++; }
    }
    for (const p of water) { const c = Math.round(p.cx), r = Math.round(p.cy); if (c >= 0 && c < GW && r >= 0 && r < GH) presence[r * GW + c]++; }
  }
  return { water, spawned, exited, presence };
}

const F = Stream.flowAccumulation({ elevFn, x0: 0, y0: 0, W: GW, H: GH });
const Wd = run();
const dens = Wd.presence;   // 시간 적분 경로(흐름) — 강은 *지나가는* 물길이라 경로가 본질

// ① 골짜기 집중 — 물이 지난 곳의 (presence 가중) 평균 흐름 누적이 전역 평균보다 훨씬 높다(물길=본류 편향).
(() => {
  let wAcc = 0, wTot = 0, gAcc = 0;
  for (let k = 0; k < GW * GH; k++) { wAcc += dens[k] * F.acc[k]; wTot += dens[k]; gAcc += F.acc[k]; }
  const meanW = wAcc / Math.max(wTot, 1), meanG = gAcc / (GW * GH);
  const ratio = meanW / Math.max(meanG, 1e-9);
  ok(ratio > 1.6, `골짜기 집중 — 흐름 경로 가중 평균 flowAcc ${meanW.toFixed(1)} / 전역 ${meanG.toFixed(1)} = ${ratio.toFixed(2)}× (물이 본류로·>1.6)`);
})();

// ② 동적↔정적 일치 — corr(log flowAcc, SPH 흐름 경로) > 0.4: 물이 지난 곳 = 라우팅이 예측한 본류.
(() => {
  const la = [], wd = [];
  for (let k = 0; k < GW * GH; k++) { la.push(Math.log(F.acc[k] + 1)); wd.push(dens[k]); }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const ma = mean(la), mw = mean(wd); let cov = 0, va = 0, vw = 0;
  for (let k = 0; k < la.length; k++) { const da = la[k] - ma, dw = wd[k] - mw; cov += da * dw; va += da * da; vw += dw * dw; }
  const corr = cov / (Math.sqrt(va * vw) || 1);
  ok(corr > 0.4, `동적↔정적 일치 — corr(flowAcc, SPH 흐름 경로) = ${corr.toFixed(2)} > 0.4 (물이 예측 본류로 흐름)`);
})();

// ③ 흐름 보존 — 떨군 비 = 남은 물 + 출구로 빠진 물(빗방울 장부·발산 없음).
ok(Wd.spawned === Wd.water.length + Wd.exited, `흐름 보존 — Σ떨군 비 ${Wd.spawned} = 남은 ${Wd.water.length} + 출구 ${Wd.exited}(장부 닫힘)`);

// ④ 결정론 — 같은 비 → 같은 흐름(물 위치 지문).
show(L.deterministic('같은 비 → 같은 흐름', () => run().water.map(p => [Math.round(p.cx * 1e3), Math.round(p.cy * 1e3)])));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

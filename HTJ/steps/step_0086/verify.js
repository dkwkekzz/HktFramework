// step_0086/verify.js — (조립) SW5 통합 루프: 격자+SPH 가 한 세계에 공존하며 단일 Φ 로 함께 굴러간다.
//   조립 step → engine 변경 0. 0080 은 autoMigrate(0077)+PM 중력(0078) 만 한 무대였다 — 이 step 은 그 위에
//   *완전한 루프*를 얹는다: autoMigrate + SPH 압력/점성(0041/0046·이주 입자가 유체로 거동) + PM 중력(TSC 0084)
//   + 격자 이류 advect(0006·격자 배경도 함께 흐름) + stepEntities. 0080 대비 새로움 = ② SPH 내부물리 ③ 격자 이류 합류.
//   부품 보존은 각 step verify 가 보증 → 여기선 *합쳐서 생긴 상호작용 + 전체 루프 전역 보존*만. 순수·독립·영구.
//   실행: node HTJ/steps/step_0086/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Grav = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const In = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const N = 16, DT = 0.04;
const popt = { stiffness: 4, h: 2.2, gamma: 1.4 }, vopt = { alpha: 0.6, beta: 1, h: 2.2, gamma: 1.4 };
function emptyWorld() { const w = W.createWorld(N); if (!w.fields.energy) w.addField('energy'); for (const f of ['mom_x', 'mom_y', 'mom_z']) if (!w.fields[f]) w.addField(f); return w; }
function blob(rho, cx, cy, cz, val, sig) { for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rho[(z * N + y) * N + x] += val * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / sig); }
const gridM = (w) => { const a = w.fields.energy; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const gridP = (w, f) => { const a = w.fields[f]; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const partM = (P) => P.reduce((s, p) => s + (p.mass || 0), 0);
const partP = (P, k) => P.reduce((s, p) => s + (p[k] || 0), 0);
function seed() { const w = emptyWorld(), rho = w.fields.energy; blob(rho, 4, 8, 8, 6, 4); blob(rho, 11, 8, 8, 34, 3); return w; }

// ① 공존 + 단일 Φ 상호인력 — 한 세계에 격자(옅은 좌)+SPH(밀집 우) 동시, 같은 Φ 로 서로 끈다(격자 px 와 입자 px 반대·합≈0).
(() => {
  const w = seed(); let P = [];
  const r = Sph.autoMigrate(w, P, { rhoOn: 12, rhoOff: 0.01 }); P = r.particles;
  const coexist = P.length > 0 && gridM(w) > 1e-6;
  Grav.applyParticleMeshGravity(w, P, DT, { G: 1, iters: 150, tsc: true });
  const gpx = gridP(w, 'mom_x'), ppx = partP(P, 'px');
  ok(coexist && gpx > 1e-6 && ppx < -1e-6 && Math.abs(gpx + ppx) < 1e-9,
    `공존+단일 Φ — 격자(${gridM(w).toFixed(0)})+SPH(${P.length}) 공존 ${coexist}·상호인력 격자 px ${gpx.toExponential(2)}(+x)·입자 px ${ppx.toExponential(2)}(−x)·합≈0`);
})();

// ② SPH 내부물리 작동(0080 엔 없던) — 이주 입자가 압력/점성으로 *유체로 거동* → 낙하 KE 가 internalE 로(가열).
(() => {
  const w = seed(); let P = [], heat = 0;
  for (let t = 0; t < 30; t++) {
    const r = Sph.autoMigrate(w, P, { rhoOn: 12, rhoOff: 0.01 }); P = r.particles;
    if (P.length) { Sph.sphPressureForce(P, DT, popt); Sph.sphViscosity(P, DT, vopt); }
    Grav.applyParticleMeshGravity(w, P, DT, { G: 1, iters: 110, tsc: true });
    In.advect(w, DT); En.stepEntities(P, DT);
  }
  heat = P.reduce((s, p) => s + (p.internalE || 0), 0);
  ok(heat > 1, `SPH 내부물리 — 이주 입자 유체 거동: Σ internalE = ${heat.toFixed(1)} > 0(압력/점성이 낙하 KE→열·0080 엔 없던 축)`);
})();

// ③ 격자 이류 합류(0080 엔 없던) — advect 가 격자 질량을 *옮긴다*(PM 중력 운동량으로 흐름). 한 step 의 advect 전후 L1 차이 > 0.
(() => {
  const w = seed(); let P = [];
  for (let t = 0; t < 5; t++) { const r = Sph.autoMigrate(w, P, { rhoOn: 12, rhoOff: 0.01 }); P = r.particles; if (P.length) { Sph.sphPressureForce(P, DT, popt); Sph.sphViscosity(P, DT, vopt); } Grav.applyParticleMeshGravity(w, P, DT, { G: 1, iters: 110, tsc: true }); In.advect(w, DT); En.stepEntities(P, DT); }
  Grav.applyParticleMeshGravity(w, P, DT, { G: 1, iters: 110, tsc: true });   // 격자에 운동량 적재
  const before = Float64Array.from(w.fields.energy);
  In.advect(w, DT);
  let l1 = 0; const a = w.fields.energy; for (let i = 0; i < a.length; i++) l1 += Math.abs(a[i] - before[i]);
  ok(l1 > 1e-6, `격자 이류 합류 — advect 가 격자 배경을 옮긴다: Σ|ρ_after − ρ_before| = ${l1.toExponential(2)} > 0(격자도 Φ 로 흐름)`);
})();

// ④ 전역 보존(전체 루프) — { autoMigrate; SPH; PM 중력; advect; step } 30 회 반복해도 (격자+입자) 총 질량·운동량 보존(정지 시작→Σp=0).
(() => {
  const w = seed(); let P = [];
  const m0 = gridM(w) + partM(P);
  for (let t = 0; t < 30; t++) {
    const r = Sph.autoMigrate(w, P, { rhoOn: 12, rhoOff: 0.01 }); P = r.particles;
    if (P.length) { Sph.sphPressureForce(P, DT, popt); Sph.sphViscosity(P, DT, vopt); }
    Grav.applyParticleMeshGravity(w, P, DT, { G: 1, iters: 110, tsc: true });
    In.advect(w, DT); En.stepEntities(P, DT);
  }
  const m1 = gridM(w) + partM(P), px = gridP(w, 'mom_x') + partP(P, 'px'), py = gridP(w, 'mom_y') + partP(P, 'py'), pz = gridP(w, 'mom_z') + partP(P, 'pz');
  show(L.conserved('전역 질량(격자+입자·통합 루프 30회)', m0, m1));
  ok(Math.abs(px) < 1e-7 && Math.abs(py) < 1e-7 && Math.abs(pz) < 1e-7,
    `전역 운동량 보존 — 정지 시작 → Σp = (${px.toExponential(2)}, ${py.toExponential(2)}, ${pz.toExponential(2)}) ≈ 0`);
})();

// ⑤ 결정론 — 같은 입력 → 같은 통합 루프.
show(L.deterministic('같은 입력 → 같은 통합 루프', () => {
  const w = seed(); let P = [];
  for (let t = 0; t < 8; t++) { const r = Sph.autoMigrate(w, P, { rhoOn: 12, rhoOff: 0.01 }); P = r.particles; if (P.length) { Sph.sphPressureForce(P, DT, popt); Sph.sphViscosity(P, DT, vopt); } Grav.applyParticleMeshGravity(w, P, DT, { G: 1, iters: 90, tsc: true }); In.advect(w, DT); En.stepEntities(P, DT); }
  return [Array.from(w.fields.energy).map(v => v.toFixed(5)), P.map(p => [p.cx.toFixed(5), p.px.toFixed(6), (p.internalE || 0).toFixed(4)])];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

// step_0080/verify.js — (조립) autoMigrate(0077) + 입자-메시 중력(0078/0079) 한 무대. 순수·독립·영구.
//   새 거동 = 밀집 격자 영역이 SPH 로 이주(autoMigrate)한 뒤에도 *같은 Φ* 로 격자와 중력 결합(applyParticleMeshGravity).
//   엔진 변경 0(기존 두 법칙 조립) → 부품 보존은 0077/0078/0079 verify 가 보증. 여기선 *합쳐서 생긴 상호작용 + 전역 보존*만.
//   실행: node HTJ/steps/step_0080/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const Grav = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];
function emptyWorld(N) { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
const gridM = (w) => { const a = w.fields.energy; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const partM = (P) => P.reduce((s, p) => s + (p.mass || 0), 0);
const gridP = (w, f) => { const a = w.fields[f]; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const partP = (P, k) => P.reduce((s, p) => s + (p[k] || 0), 0);
function blob(rho, N, cx, val, sig) {
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    rho[(z * N + y) * N + x] += val * Math.exp(-((x - cx) ** 2 + (y - (N - 1) / 2) ** 2 + (z - (N - 1) / 2) ** 2) / 8);
}

// ① 조립 창발 — 밀집 영역이 SPH 로 이주 후에도 격자와 *서로 끌린다*(한 세계로 결합).
(() => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy;
  blob(rho, N, 3, 6, 0);                                      // 좌: 옅은 격자 덩어리(< rhoOn → 격자 유지)
  blob(rho, N, 9, 30, 0);                                     // 우: 밀집 덩어리(≥ rhoOn → SPH 이주)
  const r = SPH.autoMigrate(w, [], { rhoOn: 12, rhoOff: 0.01 });   // 우 밀집만 SPH·좌 옅은 건 격자
  const P = r.particles;
  const coexist = P.length > 0 && gridM(w) > 1e-6;            // 격자(좌)+SPH(우) 공존
  Grav.applyParticleMeshGravity(w, P, 1, { G: 1, iters: 250, cic: true });
  const gpx = gridP(w, 'mom_x'), ppx = partP(P, 'px');
  ok(coexist && gpx > 1e-6 && ppx < -1e-6 && Math.abs(gpx + ppx) < 1e-9,
    `조립 창발 — 우 밀집→SPH(${P.length}개)·좌 격자 공존 ${coexist} · PM 중력 결합: 격자 px ${gpx.toExponential(2)}(+x) · 입자 px ${ppx.toExponential(2)}(−x) · 합≈0`);
})();

// ② 전역 보존(조립 루프) — { autoMigrate; PM 중력 } 6 회 반복해도 (격자+입자) 총 질량·운동량 보존(정지 시작→Σp=0).
(() => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy;
  blob(rho, N, 4, 8, 0); blob(rho, N, 8, 26, 0);
  let P = [];
  const m0 = gridM(w) + partM(P);
  for (let t = 0; t < 6; t++) {
    const r = SPH.autoMigrate(w, P, { rhoOn: 12, rhoOff: 0.01 }); P = r.particles;
    Grav.applyParticleMeshGravity(w, P, 0.5, { G: 1, iters: 150, cic: true });
    for (const p of P) { const m = p.mass || 1; p.cx += p.px / m * 0.5; p.cy += p.py / m * 0.5; p.cz += p.pz / m * 0.5; }  // 입자 자유 운동
  }
  const m1 = gridM(w) + partM(P), px = gridP(w, 'mom_x') + partP(P, 'px'), py = gridP(w, 'mom_y') + partP(P, 'py'), pz = gridP(w, 'mom_z') + partP(P, 'pz');
  show(L.conserved('전역 질량(격자+입자·조립 6 루프)', m0, m1));
  ok(Math.abs(px) < 1e-8 && Math.abs(py) < 1e-8 && Math.abs(pz) < 1e-8,
    `전역 운동량 보존 — 정지 시작 → Σp = (${px.toExponential(2)}, ${py.toExponential(2)}, ${pz.toExponential(2)}) ≈ 0`);
})();

// ③ 결정론 — 같은 입력 → 같은 조립 결과.
show(L.deterministic('같은 입력 → 같은 조립(이주+PM 중력)', () => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy;
  blob(rho, N, 4, 8, 0); blob(rho, N, 8, 26, 0);
  let P = [];
  for (let t = 0; t < 3; t++) {
    const r = SPH.autoMigrate(w, P, { rhoOn: 12, rhoOff: 0.01 }); P = r.particles;
    Grav.applyParticleMeshGravity(w, P, 0.5, { G: 1, iters: 120, cic: true });
    for (const p of P) { const m = p.mass || 1; p.cx += p.px / m * 0.5; p.cy += p.py / m * 0.5; }
  }
  return [Array.from(w.fields.mom_x).map(v => v.toFixed(6)), P.map(p => [p.cx.toFixed(5), p.cy.toFixed(5), p.px.toFixed(6)])];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

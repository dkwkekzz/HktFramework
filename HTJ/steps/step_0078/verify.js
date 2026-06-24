// step_0078/verify.js — 입자-격자 통합 중력(Particle-Mesh): 격자 유체와 SPH 입자가 하나의 Φ 를 공유한다. 순수·독립·영구.
//   새 거동 = 0007 중력의 입자-메시 판. 입자 질량을 격자에 적치 → 결합 밀도로 단일 Poisson → a=−∇Φ 로 격자·입자 함께 가속.
//   순 운동량 정확 보존(격자+입자 평균 가속 차감). 입자 없음 → applyGravity 와 byte 동일(회귀 0).
//   보존·결정론·항등은 tools/htj-verify-lib.js 공용 가드. 실행: node HTJ/steps/step_0078/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Grav = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z'];
function emptyWorld(N) { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
const gridP = (w, f) => { const a = w.fields[f]; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const partP = (P, k) => P.reduce((s, p) => s + (p[k] || 0), 0);
function blob(rho, N, cx, val, sig) {                       // 가우시안 격자 덩어리
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d2 = (x - cx) ** 2 + (y - (N - 1) / 2) ** 2 + (z - (N - 1) / 2) ** 2;
    rho[(z * N + y) * N + x] += val * Math.exp(-d2 / (2 * sig * sig));
  }
}

// ① 새 거동 — 상호 인력: 격자 덩어리(왼쪽)와 SPH 입자(오른쪽)가 *서로* 끌린다(같은 Φ 공유).
(() => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy;
  blob(rho, N, 2, 40, 1.3);                                 // 격자 질량 x≈2
  const P = [{ cx: 8, cy: (N - 1) / 2, cz: (N - 1) / 2, mass: 30, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 0, energy: 0 }];
  Grav.applyParticleMeshGravity(w, P, 1, { G: 1, iters: 300 });
  const gpx = gridP(w, 'mom_x'), ppx = partP(P, 'px');
  // 격자는 +x(입자 쪽)로, 입자는 −x(격자 쪽)로 가속 = 서로 끌림. 합은 0(보존).
  ok(gpx > 1e-6 && ppx < -1e-6 && Math.abs(gpx + ppx) < 1e-9,
    `상호 인력 — 격자 px ${gpx.toExponential(2)}(+x·입자 쪽) · 입자 px ${ppx.toExponential(2)}(−x·격자 쪽) · 합 ${(gpx + ppx).toExponential(2)}≈0`);
})();

// ② 순 운동량 정확 보존 (격자+입자) — 정지에서 시작 → 가속 후에도 총 운동량 0.
(() => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy;
  blob(rho, N, 3, 35, 1.4); blob(rho, N, 9, 20, 1.1);       // 격자 두 덩어리(비대칭)
  const P = [{ cx: 6, cy: 5, cz: 6, mass: 25, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 0, energy: 0 },
             { cx: 7, cy: 8, cz: 5, mass: 15, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 0, energy: 0 }];
  Grav.applyParticleMeshGravity(w, P, 0.7, { G: 1, iters: 250 });
  const px = gridP(w, 'mom_x') + partP(P, 'px'), py = gridP(w, 'mom_y') + partP(P, 'py'), pz = gridP(w, 'mom_z') + partP(P, 'pz');
  ok(Math.abs(px) < 1e-9 && Math.abs(py) < 1e-9 && Math.abs(pz) < 1e-9,
    `순 운동량 보존 — 정지 시작 → (격자+입자) Σp = (${px.toExponential(2)}, ${py.toExponential(2)}, ${pz.toExponential(2)}) ≈ 0`);
})();

// ③ 항등(입자 없음 → 0007 applyGravity 와 byte 동일) — PM 이 격자 전용일 땐 옛 중력 그대로.
(() => {
  const N = 10;
  const wa = emptyWorld(N), wb = emptyWorld(N);
  blob(wa.fields.energy, N, 4, 30, 1.5); blob(wb.fields.energy, N, 4, 30, 1.5);
  Grav.applyGravity(wa, 0.5, { G: 1, iters: 200 });
  Grav.applyParticleMeshGravity(wb, [], 0.5, { G: 1, iters: 200 });
  const dump = (w) => JSON.stringify(['mom_x', 'mom_y', 'mom_z', 'phi'].map(f => Array.from(w.fields[f]).map(v => v.toFixed(12))));
  show(L.identity('입자 없음 → applyGravity 와 byte 동일', dump(wa), dump(wb)));
})();

// ④ 항등(노브=0 → 회귀 0) — G=0 이면 격자·입자 불변.
(() => {
  const N = 8, w = emptyWorld(N), rho = w.fields.energy; blob(rho, N, 4, 20, 1.4);
  const P = [{ cx: 2, cy: 2, cz: 2, mass: 9, px: 0.5, py: 0, pz: 0, KEcm: 0, internalE: 0, energy: 0 }];
  const before = JSON.stringify([Array.from(rho), Array.from(w.fields.mom_x), P.map(p => [p.px, p.mass])]);
  Grav.applyParticleMeshGravity(w, P, 1, { G: 0 });
  const after = JSON.stringify([Array.from(rho), Array.from(w.fields.mom_x), P.map(p => [p.px, p.mass])]);
  show(L.identity('G=0 → 격자·입자 불변', before, after));
})();

// ⑤ 결정론 — 같은 입력 → 같은 PM 중력 결과.
show(L.deterministic('같은 입력 → 같은 입자-메시 중력', () => {
  const N = 10, w = emptyWorld(N); blob(w.fields.energy, N, 3, 28, 1.4);
  const P = [{ cx: 7, cy: 5, cz: 5, mass: 22, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 0, energy: 0 }];
  Grav.applyParticleMeshGravity(w, P, 0.6, { G: 1, iters: 200 });
  return [Array.from(w.fields.mom_x).map(v => v.toFixed(8)), P.map(p => [p.px.toFixed(8), p.py.toFixed(8), p.energy.toFixed(8)])];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

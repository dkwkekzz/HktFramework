// step_0079/verify.js — 입자-메시 중력 CIC(cloud-in-cell) 보간: NGP(셀 해상도) → trilinear(sub-cell). 순수·독립·영구.
//   새 거동 = 셀 사이 입자가 8 셀에 부피 가중 적치 + 같은 가중 힘 수집 → 부드러운 sub-cell 격자력(NGP 의 blocky 제거).
//   적치/수집 대칭이라 순 운동량 정확 보존(scheme 무관). cic 안 줌 → NGP = 0078 동일(회귀 0).
//   보존·결정론·항등은 tools/htj-verify-lib.js 공용 가드. 실행: node HTJ/steps/step_0079/verify.js
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
const mk = (cx, cy, cz, m) => ({ cx, cy, cz, mass: m, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 0, energy: 0 });

// ① 새 거동 — CIC 적치: 셀 정확히 중간(x=4.5)에 놓인 입자는 두 이웃 셀에 *반반* 분배(NGP 은 한 셀에 몰빵).
(() => {
  const N = 10, w = emptyWorld(N);
  const P = [mk(4.5, 5, 5, 8)];                              // x 방향 두 셀 사이 정중앙
  Grav.applyParticleMeshGravity(w, P, 0.0001, { G: 1e-9, cic: true });  // 거의 0 힘 — 적치 결합밀도만 보기 위해
  // 결합 밀도장(__pmrho)에서 셀 (4,5,5)·(5,5,5) 가 각각 4(=8/2)·나머지 0.
  const src = w.fields['__pmrho'], c4 = src[(5 * N + 5) * N + 4], c5 = src[(5 * N + 5) * N + 5];
  ok(Math.abs(c4 - 4) < 1e-9 && Math.abs(c5 - 4) < 1e-9,
    `CIC 적치 — x=4.5 입자(m=8) → 셀 4·5 에 반반(${c4.toFixed(3)}, ${c5.toFixed(3)})·NGP 면 한 셀에 8`);
})();

// ② 새 거동 — sub-cell 힘 연속성: 입자를 셀 사이로 조금씩 옮기면 CIC 힘은 *연속 변화*, NGP 힘은 셀 경계서 *점프*.
(() => {
  const N = 12;
  function force(xc, cic) {
    const w = emptyWorld(N), rho = w.fields.energy;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)   // 격자 인력원(좌측 평면)
      rho[(z * N + y) * N + x] = 30 * Math.exp(-((x - 2) ** 2 + (y - 5.5) ** 2 + (z - 5.5) ** 2) / 8);
    const p = mk(xc, 6, 6, 5);
    Grav.applyParticleMeshGravity(w, [p], 1, { G: 1, iters: 200, cic: !!cic });
    return p.px;                                             // x 방향 힘(운동량)
  }
  // x=7.0 → 7.5 사이를 0.1 씩: CIC 의 최대 인접 점프 ≪ NGP 의 점프(NGP 는 7.5 에서 셀 7→8 로 갈아탐).
  const xs = [7.0, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7];
  const dCIC = xs.slice(1).map((x, i) => Math.abs(force(x, true) - force(xs[i], true)));
  const dNGP = xs.slice(1).map((x, i) => Math.abs(force(x, false) - force(xs[i], false)));
  const maxCIC = Math.max(...dCIC), maxNGP = Math.max(...dNGP);
  ok(maxCIC < maxNGP * 0.5 && maxCIC > 0,
    `sub-cell 연속 — 0.1 이동당 힘 점프 최대: CIC ${maxCIC.toExponential(2)} ≪ NGP ${maxNGP.toExponential(2)}(셀 경계 갈아탐)`);
})();

// ③ 순 운동량 정확 보존(CIC) — 적치/수집 대칭 → scheme 무관. 정지 시작 → 총 운동량 0.
(() => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    rho[(z * N + y) * N + x] = 25 * Math.exp(-((x - 3) ** 2 + (y - 6) ** 2 + (z - 6) ** 2) / 6);
  const P = [mk(7.4, 5.6, 6.3, 20), mk(8.7, 8.2, 5.1, 12)];   // 비정렬 위치(CIC 8 셀 분배)
  Grav.applyParticleMeshGravity(w, P, 0.7, { G: 1, iters: 250, cic: true });
  const px = gridP(w, 'mom_x') + partP(P, 'px'), py = gridP(w, 'mom_y') + partP(P, 'py'), pz = gridP(w, 'mom_z') + partP(P, 'pz');
  ok(Math.abs(px) < 1e-9 && Math.abs(py) < 1e-9 && Math.abs(pz) < 1e-9,
    `순 운동량 보존(CIC) — 정지 시작 → Σp = (${px.toExponential(2)}, ${py.toExponential(2)}, ${pz.toExponential(2)}) ≈ 0`);
})();

// ④ 항등(cic 안 줌 → NGP = 0078 동일) — 정수 좌표 입자는 CIC 도 단일 셀(NGP 와 같은 결과).
(() => {
  const N = 10;
  const wa = emptyWorld(N), wb = emptyWorld(N);
  for (const w of [wa, wb]) { const rho = w.fields.energy; for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rho[(z * N + y) * N + x] = 20 * Math.exp(-((x - 3) ** 2 + (y - 5) ** 2 + (z - 5) ** 2) / 6); }
  const Pa = [mk(7, 5, 5, 9)], Pb = [mk(7, 5, 5, 9)];           // 정수 좌표 → CIC weight=1 한 셀
  Grav.applyParticleMeshGravity(wa, Pa, 0.5, { G: 1, iters: 200 });             // NGP(기본)
  Grav.applyParticleMeshGravity(wb, Pb, 0.5, { G: 1, iters: 200, cic: true });  // CIC(정수→동일)
  const dump = (w, P) => JSON.stringify([Array.from(w.fields.mom_x).map(v => v.toFixed(10)), P.map(p => [p.px.toFixed(10), p.energy.toFixed(10)])]);
  show(L.identity('정수 좌표 입자 → CIC=NGP(0078 동일)', dump(wa, Pa), dump(wb, Pb)));
})();

// ⑤ 결정론 — 같은 입력 → 같은 CIC 중력 결과.
show(L.deterministic('같은 입력 → 같은 CIC 중력', () => {
  const N = 10, w = emptyWorld(N), rho = w.fields.energy;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rho[(z * N + y) * N + x] = 18 * Math.exp(-((x - 3) ** 2 + (y - 5) ** 2 + (z - 5) ** 2) / 6);
  const P = [mk(6.6, 4.3, 5.7, 14)];
  Grav.applyParticleMeshGravity(w, P, 0.6, { G: 1, iters: 200, cic: true });
  return [Array.from(w.fields.mom_x).map(v => v.toFixed(8)), P.map(p => [p.px.toFixed(8), p.py.toFixed(8), p.energy.toFixed(8)])];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

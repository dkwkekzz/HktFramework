// step_0084/verify.js — PM 중력 TSC(Triangular-Shaped Cloud·2차) 보간: CIC(C⁰·kink) → TSC(C¹·매끈).
//   새 거동 = 입자 질량을 가장 가까운 셀 ±1(27 셀)에 *2차* 가중 적치/수집 → 격자력이 셀 이동에도 매끈(CIC 의
//   1차 kink 제거). 적치/수집 대칭 → 순 운동량 정확 보존. tsc 안 줌 → CIC/NGP = 0079/0078 동일(회귀 0).
//   보존·결정론·항등은 tools/htj-verify-lib.js 공용 가드. 실행: node HTJ/steps/step_0084/verify.js
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

// ① 새 거동 — TSC 적치(2차): 정수 좌표 입자도 27 셀에 퍼진다(C¹). 중심=m·0.75³·면이웃>0·27셀 합=m(보존). CIC 면 한 셀에 몰빵.
(() => {
  const N = 10, w = emptyWorld(N);
  Grav.applyParticleMeshGravity(w, [mk(5, 5, 5, 8)], 1e-4, { G: 1e-12, tsc: true });   // 정수 좌표·거의 0 힘(적치만)
  const src = w.fields['__pmrho'], at = (x, y, z) => src[(z * N + y) * N + x];
  const center = at(5, 5, 5), face = at(4, 5, 5);
  let sum = 0; for (let i = 0; i < src.length; i++) sum += src[i];
  ok(Math.abs(center - 8 * 0.75 ** 3) < 1e-9 && face > 1e-6 && Math.abs(sum - 8) < 1e-9,
    `TSC 적치(2차) — 정수 x=5 입자(m=8): 중심 ${center.toFixed(3)}(=8·0.75³)·면이웃 ${face.toFixed(3)}>0·27셀 합 ${sum.toFixed(3)}=8·NGP/CIC 면 한 셀 몰빵`);
})();

// ② 새 거동 — C¹ 매끈: 입자를 미세 이동하면 적치 가중의 *2차 차분*(기울기 점프)이 TSC ≪ CIC(CIC 의 삼각 kink 제거).
(() => {
  const N = 12, PROBE = (6 * N + 6) * N + 6;
  function deposit(xc, scheme) {
    const w = emptyWorld(N);
    Grav.applyParticleMeshGravity(w, [mk(xc, 6, 6, 8)], 1e-4, { G: 1e-12, cic: scheme === 'cic', tsc: scheme === 'tsc' });
    return w.fields['__pmrho'][PROBE];
  }
  const xs = []; for (let x = 5.0; x <= 7.0 + 1e-9; x += 0.05) xs.push(Math.round(x * 1000) / 1000);
  const sd = (scheme) => { const v = xs.map(x => deposit(x, scheme)); let mx = 0; for (let i = 1; i < v.length - 1; i++) { const s = Math.abs(v[i + 1] - 2 * v[i] + v[i - 1]); if (s > mx) mx = s; } return mx; };
  const mTSC = sd('tsc'), mCIC = sd('cic');
  ok(mTSC < mCIC * 0.1 && mTSC > 0,
    `C¹ 매끈 — 미세 이동당 적치 가중 2차 차분 최대: TSC ${mTSC.toExponential(2)} ≪ CIC ${mCIC.toExponential(2)}(삼각 kink 제거)`);
})();

// ③ 순 운동량 정확 보존(TSC) — 적치/수집 대칭 → scheme 무관. 정지 시작 → 총 운동량 0.
(() => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    rho[(z * N + y) * N + x] = 25 * Math.exp(-((x - 3) ** 2 + (y - 6) ** 2 + (z - 6) ** 2) / 6);
  const P = [mk(7.4, 5.6, 6.3, 20), mk(8.7, 8.2, 5.1, 12)];
  Grav.applyParticleMeshGravity(w, P, 0.7, { G: 1, iters: 250, tsc: true });
  const px = gridP(w, 'mom_x') + partP(P, 'px'), py = gridP(w, 'mom_y') + partP(P, 'py'), pz = gridP(w, 'mom_z') + partP(P, 'pz');
  ok(Math.abs(px) < 1e-9 && Math.abs(py) < 1e-9 && Math.abs(pz) < 1e-9,
    `순 운동량 보존(TSC) — 정지 시작 → Σp = (${px.toExponential(2)}, ${py.toExponential(2)}, ${pz.toExponential(2)}) ≈ 0`);
})();

// ④ 항등(tsc 안 줌 → CIC=0079 동일) — tsc 플래그 없으면 기존 스텐실 그대로(회귀 0).
(() => {
  const N = 10;
  const wa = emptyWorld(N), wb = emptyWorld(N);
  for (const w of [wa, wb]) { const rho = w.fields.energy; for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rho[(z * N + y) * N + x] = 20 * Math.exp(-((x - 3) ** 2 + (y - 5) ** 2 + (z - 5) ** 2) / 6); }
  const Pa = [mk(6.6, 4.3, 5.7, 14)], Pb = [mk(6.6, 4.3, 5.7, 14)];
  Grav.applyParticleMeshGravity(wa, Pa, 0.5, { G: 1, iters: 200, cic: true });             // CIC(0079)
  Grav.applyParticleMeshGravity(wb, Pb, 0.5, { G: 1, iters: 200, cic: true, tsc: false });  // tsc off → CIC 동일
  const dump = (w, P) => JSON.stringify([Array.from(w.fields.mom_x).map(v => v.toFixed(10)), P.map(p => [p.px.toFixed(10), p.energy.toFixed(10)])]);
  show(L.identity('tsc off → CIC(0079 동일)', dump(wa, Pa), dump(wb, Pb)));
})();

// ⑤ 결정론 — 같은 입력 → 같은 TSC 중력 결과.
show(L.deterministic('같은 입력 → 같은 TSC 중력', () => {
  const N = 10, w = emptyWorld(N), rho = w.fields.energy;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) rho[(z * N + y) * N + x] = 18 * Math.exp(-((x - 3) ** 2 + (y - 5) ** 2 + (z - 5) ** 2) / 6);
  const P = [mk(6.6, 4.3, 5.7, 14)];
  Grav.applyParticleMeshGravity(w, P, 0.6, { G: 1, iters: 200, tsc: true });
  return [Array.from(w.fields.mom_x).map(v => v.toFixed(8)), P.map(p => [p.px.toFixed(8), p.py.toFixed(8), p.energy.toFixed(8)])];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

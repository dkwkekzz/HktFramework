// step_0047/capture.js — 눈 검증: SW5 이웃 탐색 가속 — 가속이 *더 큰 가스 구름*을 연다(물리는 brute 와 비트 동일).
//   design/sphere-world.md §6 SW5 — 셀 리스트로 O(N²)→O(N). 가속은 같은 쌍을 같은 순서로 봐 결과가 brute 와 비트 동일
//   (verify test1) — 그래서 *새 물리는 없다*. 대신 payoff 를 보인다: brute 라면 쌍 검사가 폭증할 큰 구름(240개)을
//   가속 경로로 굴려, 전 SPH 스택(중력+열압력+점성)이 도는 풍부한 가스 구름. 색=온도. PNG 는 tools/htj-capture.js.
//   실행: node HTJ/steps/step_0047/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 64, CEN = (N - 1) / 2, eqR = (n) => En.equivalentRadius(n);
const NP = 240;                                  // 큰 구름 — brute O(N²)=28680 쌍, 가속은 27 셀 후보만
const h = 3.0, dt = 0.12, gopt = { G: 0.18, soft: 7 }, topt = { gamma: 5 / 3, h, accelerate: true }, vopt = { alpha: 1.2, beta: 2.4, gamma: 5 / 3, h, accelerate: true };
let seed = 17; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let ps = [];
for (let i = 0; i < NP; i++) {
  const r = 6 + rnd() * 10, th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1);
  const ux = Math.sin(ph) * Math.cos(th), uy = Math.sin(ph) * Math.sin(th), uz = Math.cos(ph), m = 1, vin = -0.3;
  ps.push({ cx: CEN + r * ux, cy: CEN + r * uy, cz: CEN + r * uz, mass: m, px: m * vin * ux, py: m * vin * uy, pz: m * vin * uz,
    KEcm: 0.5 * m * vin * vin, internalE: 0.2, energy: 0.2 + 0.5 * m * vin * vin, cells: 4, radius: eqR(4) });
}
const rms = () => { let cx = 0, cy = 0, cz = 0, M = 0; for (const p of ps) { cx += p.mass * p.cx; cy += p.mass * p.cy; cz += p.mass * p.cz; M += p.mass; } cx /= M; cy /= M; cz /= M; let s = 0; for (const p of ps) s += (p.cx - cx) ** 2 + (p.cy - cy) ** 2 + (p.cz - cz) ** 2; return Math.sqrt(s / ps.length); };
const totU = () => ps.reduce((s, p) => s + p.internalE, 0), sumPx = () => ps.reduce((s, p) => s + p.px, 0);
const snap = () => ({ pts: ps.map(p => ({ cx: p.cx, cy: p.cy, r: p.radius, t: p.internalE / p.mass })), rms: rms(), U: totU(), P: sumPx() });

// 가속 격자 후보 쌍 수 vs brute 전체 쌍 수(이 N 에서의 절감).
function gridPairs() { const g = SPH.sphNeighborGrid(ps, { h }); let c = 0; for (let i = 0; i < ps.length; i++) { const nb = SPH.sphNeighbors(g, ps, i); for (let t = 0; t < nb.length; t++) if (nb[t] > i) c++; } return c; }
const gp0 = gridPairs(), bp = NP * (NP - 1) / 2;

const stops = [0, 22, 50, 100];
const frames = [];
for (let t = 0, fi = 0; t <= stops[stops.length - 1]; t++) {
  if (fi < stops.length && t === stops[fi]) { frames.push(snap()); fi++; }
  En.applyEntityGravity(ps, dt, gopt);
  SPH.sphThermalPressureForce(ps, dt, topt);     // 가속 경로(accelerate:true)
  SPH.sphViscosity(ps, dt, vopt);                // 가속 경로
  En.stepEntities(ps, dt, { N });
}

let gT = 0; for (const f of frames) for (const p of f.pts) if (p.t > gT) gT = p.t;
for (const f of frames) for (const p of f.pts) p.v = gT > 0 ? p.t / gT : 0;
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

// 검증: ① 가속 후보 쌍 ≪ brute 전체 쌍(이 N 에서 절감) ② 큰 구름이 실제로 거동(rms 변함=무너지고 데움) ③ 운동량 ΣP_x 보존.
const cheaper = gp0 < bp * 0.5;
const evolved = Math.abs(frames[frames.length - 1].rms - frames[0].rms) > 0.5 && frames[2].U > frames[0].U;
let consP = true; for (let k = 1; k < frames.length; k++) if (Math.abs(frames[k].P - frames[0].P) > 1e-3) consP = false;
const ok = fs.existsSync(outPath) && cheaper && evolved && consP;
console.log('\n=== 눈 검증: SW5 이웃 탐색 가속 — 큰 가스 구름(240개)을 가속 경로로 ===');
console.log(`  입자 ${NP}개 · 가속 후보 쌍 ${gp0} ≪ brute 전체 쌍 ${bp}(${(bp / gp0).toFixed(1)}× 절감)`);
console.log('  rms 반지름(무너지고 데움): ' + frames.map(f => f.rms.toFixed(2)).join(' → '));
console.log('  내부E U(압축 데움): ' + frames.map(f => f.U.toFixed(1)).join(' → '));
console.log('  운동량 ΣP_x(보존): ' + frames.map(f => f.P.toFixed(3)).join(' → '));
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

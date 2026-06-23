// step_0045/capture.js — 눈 검증: SW5 능동 열압력 — 데운 가스가 더 세게 떠받쳐 단열 가스 공이 선다.
//   design/sphere-world.md §6 SW5 — P=(γ−1)ρu 되먹임. 중력으로 무너지는 찬 가스가 압축으로 데워지고(0042),
//   데운 u 가 P 를 키워(이 step) 되튀어 *유한한 따뜻한 공*에서 선다. 색=온도. PNG 는 tools/htj-capture.js.
//   실행: node HTJ/steps/step_0045/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 48, CEN = (N - 1) / 2, eqR = (n) => En.equivalentRadius(n);
let seed = 9; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
// 안쪽 속도로 무너지는 찬 가스 구름(internalE 작게 → 압축으로 데워짐).
let ps = [];
for (let i = 0; i < 60; i++) {
  const r = 4 + rnd() * 5, th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1);
  const ux = Math.sin(ph) * Math.cos(th), uy = Math.sin(ph) * Math.sin(th), uz = Math.cos(ph), m = 1, vin = -1.0;
  ps.push({ cx: CEN + r * ux, cy: CEN + r * uy, cz: CEN + r * uz, mass: m, px: m * vin * ux, py: m * vin * uy, pz: m * vin * uz,
    KEcm: 0.5 * m * vin * vin, internalE: 0.2, energy: 0.2 + 0.5 * m * vin * vin, cells: 5, radius: eqR(5) });
}
const h = 3.5, dt = 0.14, gopt = { G: 0.25, soft: 6 }, topt = { gamma: 5 / 3, h };
const rms = () => { let cx = 0, cy = 0, cz = 0, M = 0; for (const p of ps) { cx += p.mass * p.cx; cy += p.mass * p.cy; cz += p.mass * p.cz; M += p.mass; } cx /= M; cy /= M; cz /= M; let s = 0; for (const p of ps) s += (p.cx - cx) ** 2 + (p.cy - cy) ** 2 + (p.cz - cz) ** 2; return Math.sqrt(s / ps.length); };
const totU = () => ps.reduce((s, p) => s + p.internalE, 0), totKE = () => ps.reduce((s, p) => s + 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / p.mass, 0), sumPx = () => ps.reduce((s, p) => s + p.px, 0);
// 스냅: 각 점의 온도(internalE/mass)를 t 로 저장(끝에 정규화), 보존량 기록.
const snap = () => ({ pts: ps.map(p => ({ cx: p.cx, cy: p.cy, r: p.radius, t: p.internalE / p.mass })), rms: rms(), U: totU(), KE: totKE(), P: sumPx() });

// 프레임 시점: 시작 → 수축 → 압축 핫코어(되튐 직전) → 되튐(열압력이 떠받침). 누적 t=0,28,42,60.
const stops = [0, 28, 42, 60];
const frames = []; let minRms = Infinity;
for (let t = 0, fi = 0; t <= stops[stops.length - 1]; t++) {
  if (fi < stops.length && t === stops[fi]) { frames.push(snap()); fi++; }
  En.applyEntityGravity(ps, dt, gopt); SPH.sphThermalPressureForce(ps, dt, topt); En.stepEntities(ps, dt, { N });
  const rr = rms(); if (rr < minRms) minRms = rr;
}

// 온도 → 색값 v(0..1) 정규화(전 프레임 최고 온도 기준).
let gT = 0; for (const f of frames) for (const p of f.pts) if (p.t > gT) gT = p.t;
for (const f of frames) for (const p of f.pts) p.v = gT > 0 ? p.t / gT : 0;

const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

// 검증: ① 수축(min rms < 시작) ② 되튐(끝 rms > min·열압력이 떠받쳐 되돌림) ③ 압축 데움(U↑) ④ 운동량 ΣP_x 정확 보존.
//   (총E=KE+U 는 *중력이 일을 하므로* 늘어남이 정상 — 중력 PE 는 장부에 없음. 압력 법칙 자체의 총E 닫힘은 verify.js test3.)
const contracted = minRms < frames[0].rms;
const rebounded = frames[frames.length - 1].rms > minRms + 0.1;
const heated = frames[frames.length - 1].U > frames[0].U;
let consP = true; for (let k = 1; k < frames.length; k++) if (Math.abs(frames[k].P - frames[0].P) > 1e-3) consP = false;
const ok = fs.existsSync(outPath) && contracted && rebounded && heated && consP;
console.log('\n=== 눈 검증: SW5 능동 열압력 — 데운 가스가 떠받쳐 되튄다(P=(γ−1)ρu) ===');
console.log('  rms 반지름(수축→되튐): ' + frames.map(f => f.rms.toFixed(2)).join(' → ') + `  (최소 ${minRms.toFixed(2)})`);
console.log('  내부E U(압축 데움): ' + frames.map(f => f.U.toFixed(1)).join(' → '));
console.log('  운동E KE: ' + frames.map(f => f.KE.toFixed(1)).join(' → '));
console.log('  운동량 ΣP_x(보존): ' + frames.map(f => f.P.toFixed(3)).join(' → '));
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

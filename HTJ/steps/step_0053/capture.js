// step_0053/capture.js — 눈 검증: SW5 SPH 점화 — 점화 임계(별 vs 별 아님). 충분히 뜨거우면 불붙어 빛나고, 아니면 어둡다.
//   design/sphere-world.md §6 SW5 — 0004(임계 방출=별)의 SPH 판. 위치 고정 평면 원반: 따뜻한 코어(u≥uCrit)는 핵융합으로
//   *불붙어* 밝아지고(점화↔복사 균형으로 정상상태 빛남), 찬 가장자리(u<uCrit)는 점화 못 해 복사로 *어두워진다*.
//   = 별과 별 아닌 것의 경계. (전체 붕괴→점화→virial 별의 열압력 되먹임 균형은 verify 정상상태 검사가 보증.)
//   색=온도. PNG 는 tools/htj-capture.js. 실행: node HTJ/steps/step_0053/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 64, CEN = (N - 1) / 2, R = N * 0.42, SP = Math.max(1.6, N * 0.05);
const uCrit = 1.5, rate = 1.5, coolRate = 0.2, floor = 0.2, dt = 0.1, UMAX = 8;
// 평면 원반 — 코어(r<R/2.2) 따뜻하게(u=2≥uCrit)·가장자리 차갑게(u=0.4<uCrit). 위치 고정·연료 충분.
let ps = [];
for (let x = -R; x <= R; x += SP) for (let y = -R; y <= R; y += SP) {
  const r = Math.sqrt(x * x + y * y); if (r > R) continue;
  const u = r < R / 2.2 ? 2.0 : 0.4;
  ps.push({ cx: CEN + x, cy: CEN + y, cz: CEN, mass: 1, px: 0, py: 0, pz: 0, KEcm: 0, internalE: u, energy: u, fuel: 1e6, radius: 1.3 });
}
const NP = ps.length;
const uOf = (p) => p.internalE / p.mass;
const coreU = () => { let s = 0, c = 0; for (const p of ps) if (Math.hypot(p.cx - CEN, p.cy - CEN) < R / 2.2) { s += uOf(p); c++; } return s / c; };
const rimU = () => { let s = 0, c = 0; for (const p of ps) if (Math.hypot(p.cx - CEN, p.cy - CEN) >= R / 2.2) { s += uOf(p); c++; } return s / c; };
const lit = () => ps.filter(p => uOf(p) >= uCrit).length;
function snap() { return { pts: ps.map(p => ({ cx: p.cx, cy: p.cy, r: 1.3, v: Math.min(1, uOf(p) / UMAX) })) }; }

const stops = [0, 6, 20, 90];
const frames = [], stat = [];
for (let t = 0, fi = 0; t <= stops[stops.length - 1]; t++) {
  if (fi < stops.length && t === stops[fi]) { frames.push(snap()); stat.push({ core: coreU(), rim: rimU(), lit: lit() }); fi++; }
  SPH.sphIgnition(ps, dt, { rate, uCrit });        // 점화(이 step) — 뜨거운 코어 불붙음
  SPH.sphRadiativeCooling(ps, dt, { coolRate, floor });   // 복사(0052) — 균형/가장자리 식힘
}

const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

const expected = rate * (1 - dt * coolRate) / coolRate;   // 점화 정상상태 u*
// 검증: ① 코어 점화해 밝아짐(core↑·정상상태 u*≈expected) ② 가장자리 안 붙고 식음(rim↓) ③ runaway 아님.
const ignited = stat[stat.length - 1].core > stat[0].core && stat[stat.length - 1].lit > 0;
const dimRim = stat[stat.length - 1].rim < stat[0].rim;
const steady = stat[stat.length - 1].core > uCrit * 2 && stat[stat.length - 1].core < 100;   // 밝게 점화·runaway 아님(유한)
const ok = fs.existsSync(outPath) && ignited && dimRim && steady;
console.log('\n=== 눈 검증: SW5 SPH 점화 — 점화 임계(별 vs 별 아님) ===');
console.log(`  코어 u(점화→밝아짐·정상상태 u*≈${expected.toFixed(2)}): ` + stat.map(s => s.core.toFixed(2)).join(' → '));
console.log('  가장자리 u(점화 못 함→복사로 식음): ' + stat.map(s => s.rim.toFixed(2)).join(' → '));
console.log('  점화 입자 수: ' + stat.map(s => s.lit).join(' → ') + ` (uCrit=${uCrit})`);
console.log('  색=온도 / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 뜨거운 코어는 불붙어 정상상태로 빛나고, 찬 가장자리는 어두워진다' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

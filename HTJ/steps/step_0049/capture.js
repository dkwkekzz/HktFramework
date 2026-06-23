// step_0049/capture.js — 눈 검증: SW5 열전도 — 뜨거운 코어가 바깥으로 확산해 온도가 평형화된다.
//   design/sphere-world.md §6 SW5 "압력·확산" — 0002 확산의 SPH 판. 위치는 *고정*(운동 없음) — 색(온도)만 변해
//   전도 법칙이 직접 드러난다: 중심의 뜨거운 코어(빨강)가 바깥 찬 껍질(파랑)로 열을 흘려 점점 균일한 미지근(보라)으로.
//   총 내부E 보존(재분배만)·온도 분산 단조↓(엔트로피↑). PNG 는 tools/htj-capture.js. 실행: node HTJ/steps/step_0049/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 64, CEN = (N - 1) / 2;
const R = 15, SP = 2.2, h = 3.4, kappa = 0.06, dt = 0.4;
// 평면 원반 격자(z=0) — 위치 고정. 중심부(r<R/2.4) 뜨겁게(u=10)·바깥 차갑게(u=0.5).
//   평면이라 화면 투영이 *실제 온도장 그대로*(3D 구면은 찬 껍질이 뜨거운 코어를 가려 안 보임).
let ps = [];
for (let x = -R; x <= R; x += SP) for (let y = -R; y <= R; y += SP) {
  const r = Math.sqrt(x * x + y * y);
  if (r > R) continue;
  const u = r < R / 2.4 ? 10 : 0.5;
  ps.push({ cx: CEN + x, cy: CEN + y, cz: CEN, mass: 1, px: 0, py: 0, pz: 0, KEcm: 0, internalE: u, energy: u, radius: 1 });
}
const NP = ps.length;
const uOf = (p) => p.internalE / p.mass;
const sumU = () => ps.reduce((s, p) => s + p.internalE, 0);
const variance = () => { const m = sumU() / NP; return ps.reduce((s, p) => s + (uOf(p) - m) ** 2, 0) / NP; };
const coreU = () => { let s = 0, c = 0; for (const p of ps) { const r = Math.hypot(p.cx - CEN, p.cy - CEN, p.cz - CEN); if (r < R / 2.4) { s += uOf(p); c++; } } return s / c; };
const shellU = () => { let s = 0, c = 0; for (const p of ps) { const r = Math.hypot(p.cx - CEN, p.cy - CEN, p.cz - CEN); if (r >= R / 2.4) { s += uOf(p); c++; } } return s / c; };
const UMAX = 10;   // 절대 온도 스케일(초기 코어) — 상대 정규화면 균일해진 끝이 빨개져 오해
function snap() { return { pts: ps.map(p => ({ cx: p.cx, cy: p.cy, r: 1.4, v: Math.min(1, uOf(p) / UMAX) })) }; }

const stops = [0, 12, 35, 90];
const frames = [], stat = [];
for (let t = 0, fi = 0; t <= stops[stops.length - 1]; t++) {
  if (fi < stops.length && t === stops[fi]) { frames.push(snap()); stat.push({ U: sumU(), v: variance(), core: coreU(), shell: shellU() }); fi++; }
  SPH.sphThermalConduction(ps, dt, { kappa, h });          // 위치 고정 — 전도만(운동 없음)
}

const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

// 검증: ① 코어 식고 껍질 데움(열 hot→cold) ② 온도 분산 단조↓ ③ 총 내부E 보존.
const flowed = stat[stat.length - 1].core < stat[0].core - 1 && stat[stat.length - 1].shell > stat[0].shell + 0.5;
let monoVar = true; for (let k = 1; k < stat.length; k++) if (stat[k].v > stat[k - 1].v + 1e-9) monoVar = false;
let consU = true; for (const s of stat) if (Math.abs(s.U - stat[0].U) > 1e-6) consU = false;
const ok = fs.existsSync(outPath) && flowed && monoVar && consU;
console.log('\n=== 눈 검증: SW5 열전도 — 뜨거운 코어가 바깥으로 확산 ===');
console.log(`  입자 ${NP}개(위치 고정) · 코어 u(식음): ` + stat.map(s => s.core.toFixed(2)).join(' → '));
console.log('  껍질 u(데움): ' + stat.map(s => s.shell.toFixed(2)).join(' → '));
console.log('  온도 분산(엔트로피↑·단조↓): ' + stat.map(s => s.v.toFixed(2)).join(' → '));
console.log('  총 내부E(보존): ' + stat.map(s => s.U.toFixed(2)).join(' → '));
console.log('  색=온도 / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

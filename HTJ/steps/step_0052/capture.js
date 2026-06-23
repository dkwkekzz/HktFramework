// step_0052/capture.js — 눈 검증: SW5 SPH 복사 냉각 — 가스가 제 열을 빛으로 내보내 식는다(계의 첫 sink).
//   design/sphere-world.md §6 SW5. 위치 고정 평면 원반·중심 뜨겁게(노랑). 매 프레임 복사 냉각만 → 핫코어가 *제자리에서
//   어두워진다*(전도 0049 처럼 퍼지지 않고 *사라진다* = 에너지가 빛으로 계를 떠남). 열+빛 합 일정·질량 불변(콘솔).
//   색=온도(절대). PNG 는 tools/htj-capture.js. 실행: node HTJ/steps/step_0052/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 64, CEN = (N - 1) / 2, R = N * 0.42, SP = Math.max(1.6, N * 0.05);
const coolRate = 0.5, dt = 0.2, floor = 0.3, UMAX = 10;
// 평면 원반(z=0) — 중심 뜨겁게(u=10)·바깥 미지근(u=2). 위치 고정.
let ps = [];
for (let x = -R; x <= R; x += SP) for (let y = -R; y <= R; y += SP) {
  const r = Math.sqrt(x * x + y * y); if (r > R) continue;
  const u = r < R / 2.2 ? 10 : 2;
  ps.push({ cx: CEN + x, cy: CEN + y, cz: CEN, mass: 1, px: 0, py: 0, pz: 0, KEcm: 0, internalE: u, energy: u, radiated: 0, radius: 1.3 });
}
const NP = ps.length;
const uOf = (p) => p.internalE / p.mass;
const sumU = () => ps.reduce((s, p) => s + p.internalE, 0), sumR = () => ps.reduce((s, p) => s + (p.radiated || 0), 0), sumM = () => ps.reduce((s, p) => s + p.mass, 0);
const coreU = () => { let s = 0, c = 0; for (const p of ps) { if (Math.hypot(p.cx - CEN, p.cy - CEN) < R / 2.2) { s += uOf(p); c++; } } return s / c; };
function snap() { return { pts: ps.map(p => ({ cx: p.cx, cy: p.cy, r: 1.3, v: Math.min(1, uOf(p) / UMAX) })) }; }

const stops = [0, 6, 16, 45];
const frames = [], stat = [];
for (let t = 0, fi = 0; t <= stops[stops.length - 1]; t++) {
  if (fi < stops.length && t === stops[fi]) { frames.push(snap()); stat.push({ U: sumU(), R: sumR(), core: coreU(), M: sumM() }); fi++; }
  SPH.sphRadiativeCooling(ps, dt, { coolRate, floor });        // 복사만 — 위치 고정·열↔열 재분배 없음
}

const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

// 검증: ① 코어가 식는다(core u↓) ② 열+빛 합 일정(ΣU+Σ빛 불변=계를 떠난 에너지 회계) ③ 질량 불변.
const cooled = stat[stat.length - 1].core < stat[0].core - 1;
const total0 = stat[0].U + stat[0].R;
let bookkept = true, massOk = true;
for (const s of stat) { if (Math.abs((s.U + s.R) - total0) > 1e-6) bookkept = false; if (Math.abs(s.M - stat[0].M) > 1e-9) massOk = false; }
const radiated = stat[stat.length - 1].R > 0;
const ok = fs.existsSync(outPath) && cooled && bookkept && massOk && radiated;
console.log('\n=== 눈 검증: SW5 SPH 복사 냉각 — 가스가 열을 빛으로 내보내 식는다 ===');
console.log(`  입자 ${NP}개(위치 고정) · 코어 u(식음): ` + stat.map(s => s.core.toFixed(2)).join(' → '));
console.log('  계 내부E ΣU(줄어듦): ' + stat.map(s => s.U.toFixed(0)).join(' → '));
console.log('  방출 빛 Σradiated(늘어남): ' + stat.map(s => s.R.toFixed(0)).join(' → '));
console.log('  열+빛 합(일정·회계): ' + stat.map(s => (s.U + s.R).toFixed(0)).join(' → ') + ` · 질량 ${stat[0].M.toFixed(0)} 불변`);
console.log('  색=온도(절대) / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 핫코어가 퍼지지 않고 제자리서 어두워진다(에너지가 빛으로 계를 떠남)' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

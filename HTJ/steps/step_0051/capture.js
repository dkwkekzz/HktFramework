// step_0051/capture.js — 눈 검증: SW5 격자 유체 → SPH 입자 이주(바통 패스). 격자가 못 하던 자유 붕괴를 입자가 잇는다.
//   design/sphere-world.md §6 SW5 "격자 유체를 구체로 이주 → 격자 은퇴". 4 패널: ① 격자 유체 블롭(슬라이스) →
//   ② 변환 직후 SPH 입자(같은 분포=바통 패스·정확 보존) → ③④ 입자가 SPH 로 자유 붕괴(Eulerian 격자가 못 하던 것).
//   색=온도. 변환 시 질량·운동량·내부E 정확 보존(콘솔). PNG 는 tools/htj-capture.js. 실행: node HTJ/steps/step_0051/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 24, c = (N - 1) / 2, sig = N * 0.16, zc = (c | 0);
// 격자 유체 블롭 — 자기중력으로 살짝 붕괴시켜 운동량·코어 가열을 만든다.
const w = W.createWorld(N); { const rho = w.fields.energy, u = w.addField('therm');
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2, i = (z * N + y) * N + x;
    const r = 2.0 * Math.exp(-d2 / (2 * sig * sig)); rho[i] = r; u[i] = r * 0.3; } }
for (let t = 0; t < 8; t++) { Gr.applyGravity(w, 0.2, { G: 0.25, iters: 40 }); Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 }); Ine.advect(w, 0.2, { scalars: ['therm'] }); }

const fSum = (nm) => { const a = w.fields[nm]; if (!a) return 0; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const latM = fSum('energy'), latP = Math.hypot(fSum('mom_x'), fSum('mom_y'), fSum('mom_z')), latU = fSum('therm');

// 격자 z=중앙 슬라이스 스냅(색=온도).
function latSlice() {
  const rho = w.fields.energy, u = w.fields.therm, pts = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (zc * N + y) * N + x, r = rho[i];
    if (r < 0.05) continue;
    pts.push({ cx: x, cy: y, r: 0.62, T: r > 1e-9 ? u[i] / r : 0 });
  }
  return pts;
}

// ── 이주: 격자장 → SPH 입자(정확 보존) ──
let ps = SPH.fluidToParticles(w);
const parM = ps.reduce((s, p) => s + p.mass, 0), parP = Math.hypot(ps.reduce((s, p) => s + p.px, 0), ps.reduce((s, p) => s + p.py, 0), ps.reduce((s, p) => s + p.pz, 0)), parU = ps.reduce((s, p) => s + p.internalE, 0);
// 입자 z=중앙 부근 슬라이스 스냅(격자 슬라이스와 같은 시야).
function parSlice() {
  return ps.filter(p => Math.abs(p.cz - c) < 1.2).map(p => ({ cx: p.cx, cy: p.cy, r: 0.62, T: p.internalE / p.mass }));
}
const maxRho = () => { SPH.sphDensity(ps, { h: 2.2 }); let mx = 0; for (const p of ps) if (p.density > mx) mx = p.density; return mx; };
const stepSph = () => { En.applyEntityGravity(ps, 0.12, { G: 0.25, soft: 2.5 }); SPH.sphThermalPressureForce(ps, 0.12, { gamma: 5 / 3, h: 2.2 }); En.stepEntities(ps, 0.12, { N }); };

// 4 패널: 격자 슬라이스 · 변환 직후 입자 · SPH 8스텝 · SPH 18스텝.
const snaps = [latSlice(), parSlice()];
const rhoTrack = [maxRho()];
for (let s = 0; s < 8; s++) stepSph(); snaps.push(parSlice()); rhoTrack.push(maxRho());
for (let s = 0; s < 10; s++) stepSph(); snaps.push(parSlice()); rhoTrack.push(maxRho());

let Tmax = 0; for (const f of snaps) for (const p of f) if (p.T > Tmax) Tmax = p.T;
const frames = snaps.map(f => ({ pts: f.map(p => ({ cx: p.cx, cy: p.cy, r: p.r, v: Tmax > 0 ? Math.min(1, p.T / Tmax) : 0 })) }));
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

const conserved = Math.abs(latM - parM) < 1e-9 && Math.abs(latP - parP) < 1e-9 && Math.abs(latU - parU) < 1e-9;
const evolved = rhoTrack[rhoTrack.length - 1] > rhoTrack[0] * 1.2;   // 입자가 자유 붕괴 계속(격자 못 하던 것)
const ok = fs.existsSync(outPath) && conserved && evolved;
console.log('\n=== 눈 검증: SW5 격자 유체 → SPH 입자 이주(바통 패스) ===');
console.log(`  이주: 격자 ${ps.length}개 점유 셀 → SPH 입자 ${ps.length}개`);
console.log(`  정확 보존 — 질량 ${latM.toFixed(4)}→${parM.toFixed(4)} · |ΣP| ${latP.toFixed(4)}→${parP.toFixed(4)} · 내부E ${latU.toFixed(4)}→${parU.toFixed(4)} (Δ≈0: ${conserved})`);
console.log('  이주 후 입자 최대ρ(자유 붕괴 계속): ' + rhoTrack.map(r => r.toFixed(2)).join(' → '));
console.log('  패널: 격자 슬라이스 → 변환 직후 입자 → SPH 8스텝 → SPH 18스텝 · 색=온도 / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 격자 유체가 구체로 이주, 보존하며 자유 붕괴를 잇는다' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

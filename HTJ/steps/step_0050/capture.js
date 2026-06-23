// step_0050/capture.js — 눈 검증: 격자(좌) ↔ 구체 SPH(우) 정성 일치. 같은 자기중력 가스가 둘 다 붕괴+코어 가열.
//   design/sphere-world.md §6 SW5 verify gate. 한 패널에 좌=격자 유체 슬라이스(z=중앙)·우=SPH 입자를 나란히 그려,
//   *표현이 달라도(격자/구체) 창발 물리가 같다*는 걸 한눈에: 둘 다 중심으로 무너지며 코어가 데워진다(파랑→빨강).
//   색=온도(각 substrate 자기 최댓값 정규화). PNG 는 tools/htj-capture.js. 실행: node HTJ/steps/step_0050/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const VN = 64, Lcx = 15.5, Rcx = 47.5, cy = 31.5;   // 뷰포트: 좌 절반=격자·우 절반=SPH
const NFRAMES = 4, LAT_PER = 6, SPH_PER = 16;       // 프레임당 step — 격자/SPH 가 붕괴 속도 달라 분리

// ── 격자 붕괴: z=중앙 슬라이스 스냅(셀→점, 색=온도) ──
const Nl = 24, cl = (Nl - 1) / 2, sigL = Nl * 0.16, zc = (cl | 0);
const wl = W.createWorld(Nl); { const rho = wl.fields.energy, u = wl.addField('therm');
  for (let z = 0; z < Nl; z++) for (let y = 0; y < Nl; y++) for (let x = 0; x < Nl; x++) {
    const d2 = (x - cl) ** 2 + (y - cl) ** 2 + (z - cl) ** 2, i = (z * Nl + y) * Nl + x;
    const r = 2.0 * Math.exp(-d2 / (2 * sigL * sigL)) + 0.02; rho[i] = r; u[i] = r * 0.3; } }
function latSlice() {
  const rho = wl.fields.energy, u = wl.fields.therm, pts = [];
  for (let y = 0; y < Nl; y++) for (let x = 0; x < Nl; x++) {
    const i = (zc * Nl + y) * Nl + x, r = rho[i];
    if (r < 0.15) continue;                                    // 밀도 있는 셀만
    pts.push({ cx: Lcx + (x - cl) * 1.15, cy: cy + (y - cl) * 1.15, r: Math.min(2.2, 0.5 + 0.5 * Math.cbrt(r)), T: r > 1e-9 ? u[i] / r : 0 });
  }
  return pts;
}

// ── SPH 붕괴: 입자 스냅(색=온도 u) ──
let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ps = [];
for (let i = 0; i < 120; i++) { const r = 2 + rnd() * 8, th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1);
  const ux = Math.sin(ph) * Math.cos(th), uy = Math.sin(ph) * Math.sin(th), uz = Math.cos(ph), m = 1, vin = -0.4;
  ps.push({ cx: r * ux, cy: r * uy, cz: r * uz, mass: m, px: m * vin * ux, py: m * vin * uy, pz: m * vin * uz, KEcm: 0.5 * m * vin * vin, internalE: 0.08, energy: 0.08 + 0.5 * m * vin * vin }); }
function sphSnap() { return ps.map(p => ({ cx: Rcx + p.cx * 1.25, cy: cy + p.cy * 1.25, r: 1.3, T: p.internalE / p.mass })); }

// 시뮬 굴리며 stops 에서 좌/우 스냅 수집.
const latSnaps = [], sphSnaps = [], latStat = [], sphStat = [];
const centralT = () => { const i = (zc * Nl + (cl | 0)) * Nl + (cl | 0); const r = wl.fields.energy[i]; return r > 1e-9 ? wl.fields.therm[i] / r : 0; };
const centralRho = () => wl.fields.energy[(zc * Nl + (cl | 0)) * Nl + (cl | 0)];
const sphMaxRho = () => { SPH.sphDensity(ps, { h: 2.8 }); let mx = 0; for (const p of ps) if (p.density > mx) mx = p.density; return mx; };
const com = () => { let x = 0, y = 0, z = 0; for (const p of ps) { x += p.cx; y += p.cy; z += p.cz; } return [x / ps.length, y / ps.length, z / ps.length]; };
const sphCoreU = () => { const [cx, cy2, cz] = com(); const ds = ps.map(p => Math.hypot(p.cx - cx, p.cy - cy2, p.cz - cz)).sort((a, b) => a - b); const R = ds[(ds.length * 0.3) | 0]; let s = 0, n = 0; for (const p of ps) if (Math.hypot(p.cx - cx, p.cy - cy2, p.cz - cz) <= R) { s += p.internalE / p.mass; n++; } return n ? s / n : 0; };
const stepLat = () => { Gr.applyGravity(wl, 0.2, { G: 0.25, iters: 40 }); Th.applyThermalPressure(wl, 0.2, { Kth: 0.3, gamma: 5 / 3 }); Ine.advect(wl, 0.2, { scalars: ['therm'] }); };
const stepSph = () => { En.applyEntityGravity(ps, 0.08, { G: 0.8, soft: 2 }); SPH.sphThermalPressureForce(ps, 0.08, { gamma: 5 / 3, h: 2.8 }); En.stepEntities(ps, 0.08, { N: 200 }); };
for (let k = 0; k < NFRAMES; k++) {
  latSnaps.push(latSlice()); sphSnaps.push(sphSnap()); latStat.push([centralRho(), centralT()]); sphStat.push([sphMaxRho(), sphCoreU()]);
  if (k < NFRAMES - 1) { for (let s = 0; s < LAT_PER; s++) stepLat(); for (let s = 0; s < SPH_PER; s++) stepSph(); }
}
// 각 substrate 자기 최대 온도로 정규화(색=cold→hot 진행) 후 합쳐 4 패널.
let lTmax = 0, sTmax = 0;
for (const f of latSnaps) for (const p of f) if (p.T > lTmax) lTmax = p.T;
for (const f of sphSnaps) for (const p of f) if (p.T > sTmax) sTmax = p.T;
const frames = latSnaps.map((lat, k) => ({ pts: lat.map(p => ({ cx: p.cx, cy: p.cy, r: p.r, v: lTmax > 0 ? Math.min(1, p.T / lTmax) : 0 }))
  .concat(sphSnaps[k].map(p => ({ cx: p.cx, cy: p.cy, r: p.r, v: sTmax > 0 ? Math.min(1, p.T / sTmax) : 0 }))) }));

const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N: VN });

const latColl = latStat[3][0] / latStat[0][0] > 1.5 && latStat[3][1] / latStat[0][1] > 1.2;
const sphColl = sphStat[3][0] / sphStat[0][0] > 1.5 && sphStat[3][1] / sphStat[0][1] > 1.2;
const ok = fs.existsSync(outPath) && latColl && sphColl;
console.log('\n=== 눈 검증: 격자(좌) ↔ 구체 SPH(우) 정성 일치 — 자기중력 가스 붕괴 ===');
console.log('  격자 중심ρ: ' + latStat.map(s => s[0].toFixed(2)).join(' → ') + '  중심T: ' + latStat.map(s => s[1].toFixed(2)).join(' → '));
console.log('  SPH 최대ρ: ' + sphStat.map(s => s[0].toFixed(3)).join(' → ') + '  코어u: ' + sphStat.map(s => s[1].toFixed(3)).join(' → '));
console.log('  좌=격자 슬라이스·우=SPH 입자 · 색=온도(각자 정규화) / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 표현은 달라도 둘 다 붕괴+코어 가열' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

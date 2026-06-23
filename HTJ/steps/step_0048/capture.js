// step_0048/capture.js — 눈 검증: SW5 적응 평활길이 h — 분해능이 밀도를 따라간다.
//   design/sphere-world.md §6 SW5 — h_i=η(m_i/ρ_i)^⅓ 자기일관. 그리는 반지름 = h_i 로 둬 *평활길이를 눈에* 보인다:
//   구름이 중력으로 무너지며 코어가 조밀해지면 거기 h_i 가 줄어(작은 커널 촘촘)·희박 헤일로는 큰 커널. 색=밀도(뜨거울수록 조밀).
//   sphAdaptiveH 는 *수동 측정*(힘 없음) — 운동은 중력+고정-h 열압력이 만들고(적응-h 힘은 후속 벽돌), h 는 그 위에서 분해능을 잰다.
//   PNG 는 tools/htj-capture.js. 실행: node HTJ/steps/step_0048/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 64, CEN = (N - 1) / 2;
const NP = 150, dt = 0.1, h = 3.0, eta = 1.3;
const gopt = { G: 0.4, soft: 3 }, topt = { gamma: 5 / 3, h };   // 운동: 중력(강) + 고정-h 열압력(0045·약한 지지)
let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let ps = [];
for (let i = 0; i < NP; i++) {
  const r = 3 + rnd() * 14, th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1);
  const ux = Math.sin(ph) * Math.cos(th), uy = Math.sin(ph) * Math.sin(th), uz = Math.cos(ph), m = 1, vin = -0.35;
  ps.push({ cx: CEN + r * ux, cy: CEN + r * uy, cz: CEN + r * uz, mass: m, px: m * vin * ux, py: m * vin * uy, pz: m * vin * uz,
    KEcm: 0.5 * m * vin * vin, internalE: 0.15, energy: 0.15 + 0.5 * m * vin * vin, cells: 4, radius: 1 });
}

function snap() {
  SPH.sphAdaptiveH(ps, { eta, h0: h });                       // 적응 h 측정(따뜻한 시작: a.h 재사용)
  let hmin = Infinity, hmax = 0, rmax = 0;
  for (const p of ps) { if (p.h < hmin) hmin = p.h; if (p.h > hmax) hmax = p.h; if (p.density > rmax) rmax = p.density; }
  return {
    pts: ps.map(p => ({ cx: p.cx, cy: p.cy, r: Math.max(0.4, Math.min(6, p.h)), v: rmax > 0 ? p.density / rmax : 0 })),  // r=h_i(분해능)·색=밀도
    hmin, hmax, rmax
  };
}
const rms = () => { let cx = 0, cy = 0, cz = 0; for (const p of ps) { cx += p.cx; cy += p.cy; cz += p.cz; } cx /= ps.length; cy /= ps.length; cz /= ps.length; let s = 0; for (const p of ps) s += (p.cx - cx) ** 2 + (p.cy - cy) ** 2 + (p.cz - cz) ** 2; return Math.sqrt(s / ps.length); };

const stops = [0, 18, 40, 80];
const frames = [], stat = [];
for (let t = 0, fi = 0; t <= stops[stops.length - 1]; t++) {
  if (fi < stops.length && t === stops[fi]) { frames.push(snap()); stat.push({ rms: rms(), hmin: frames[fi].hmin, hmax: frames[fi].hmax }); fi++; }
  En.applyEntityGravity(ps, dt, gopt);
  SPH.sphThermalPressureForce(ps, dt, topt);
  En.stepEntities(ps, dt, { N });
}

const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

// 검증: ① 구름이 무너진다(rms↓) ② 코어가 조밀해지며 *최소 h 가 줄어든다*(분해능이 밀도를 따라감) ③ h 범위가 벌어진다(코어↔헤일로 분해능 분화).
const collapsed = stat[stat.length - 1].rms < stat[0].rms - 1;
const hShrank = stat[stat.length - 1].hmin < stat[0].hmin * 0.7;
const spread = stat[stat.length - 1].hmax / stat[stat.length - 1].hmin > stat[0].hmax / stat[0].hmin;
const ok = fs.existsSync(outPath) && collapsed && hShrank && spread;
console.log('\n=== 눈 검증: SW5 적응 평활길이 h — 분해능이 밀도를 따라간다 ===');
console.log('  rms 반지름(무너짐): ' + stat.map(s => s.rms.toFixed(2)).join(' → '));
console.log('  최소 h(조밀 코어 분해능↑=h↓): ' + stat.map(s => s.hmin.toFixed(2)).join(' → '));
console.log('  h 범위 hmax/hmin(코어↔헤일로 분화): ' + stat.map(s => (s.hmax / s.hmin).toFixed(1)).join(' → '));
console.log('  그림: 원 반지름 = h_i(작을수록 조밀 분해)·색 = 밀도 / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

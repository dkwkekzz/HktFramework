// step_0054/capture.js — 눈 검증: SW5 적응-h 압력 힘 — 분해능이 물질을 따라가면서 힘이 보존된다.
//   design/sphere-world.md §6 SW5. 0048 이 *측정*만 한 입자별 h_i 를 이제 압력 힘이 *쓴다*(대칭 평균 커널 → 운동량
//   정확 보존). 변밀도 구름(조밀 코어+희박 헤일로)을 중력+적응-h 압력으로 굴린다. 그리는 반지름 = h_i 라 *커널이 보인다*:
//   코어엔 작은 커널 촘촘·헤일로엔 큰 커널 — 가변 분해능이 한 무대에 공존하며 힘이 운동량을 정확 보존. 색=밀도.
//   PNG 는 tools/htj-capture.js. 실행: node HTJ/steps/step_0054/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 64, CEN = (N - 1) / 2, dt = 0.08, eta = 1.3;
let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
// 변밀도 구름 — 조밀 코어(반경 5) + 적당히 희박한 헤일로(반경 8~14). h_i 가 코어↔헤일로 ~5× 달라지게.
let ps = [];
const shell = (n, rmin, rmax) => { for (let i = 0; i < n; i++) { const r = rmin + rnd() * (rmax - rmin), th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1); const ux = Math.sin(ph) * Math.cos(th), uy = Math.sin(ph) * Math.sin(th), uz = Math.cos(ph); ps.push({ cx: CEN + r * ux, cy: CEN + r * uy, cz: CEN + r * uz, mass: 1, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 1, energy: 1, h: 3, density: 0, radius: 1 }); } };
shell(110, 0, 5); shell(70, 8, 14);
const NP = ps.length;
const netP = () => { let x = 0, y = 0, z = 0; for (const p of ps) { x += p.px; y += p.py; z += p.pz; } return Math.hypot(x, y, z); };
function snap() {
  SPH.sphAdaptiveH(ps, { eta, h0: 3 });
  let hmin = Infinity, hmax = 0;
  for (const p of ps) { if (p.h < hmin) hmin = p.h; if (p.h > hmax) hmax = p.h; }
  // 색 = h_i(분해능 장): 작은 h(조밀 코어)=뜨거운 색·큰 h(희박 헤일로)=찬 색. 작은 커널을 위에 그리도록 큰 r 먼저.
  const pts = ps.map(p => ({ cx: p.cx, cy: p.cy, r: Math.max(0.6, Math.min(3.5, p.h)), v: hmax > hmin ? 1 - (p.h - hmin) / (hmax - hmin) : 0.5 }))
    .sort((a, b) => b.r - a.r);
  return { pts, hmin, hmax };
}

const stops = [0, 8, 20, 45];
const frames = [], stat = [];
for (let t = 0, fi = 0; t <= stops[stops.length - 1]; t++) {
  if (fi < stops.length && t === stops[fi]) { const s = snap(); frames.push(s); stat.push({ hmin: s.hmin, hmax: s.hmax, P: netP() }); fi++; }
  SPH.sphAdaptiveH(ps, { eta, h0: 3 });                      // 입자별 h_i·ρ_i 재적응(따뜻한 시작)
  En.applyEntityGravity(ps, dt, { G: 0.25, soft: 3 });        // 중력으로 묶어두고
  SPH.sphPressureForceVarH(ps, dt, { stiffness: 0.5, gamma: 2 });   // 적응-h 압력(이 step)
  En.stepEntities(ps, dt, { N });
}

const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

// 검증: ① h 가 가변(코어↔헤일로 분화) ② 순 운동량 정확 보존(가변 h 여도) ③ NaN 없음.
const varied = stat[0].hmax / stat[0].hmin > 3;
let momOk = true; for (const s of stat) if (Math.abs(s.P - stat[0].P) > 1e-6) momOk = false;
const noNaN = ps.every(p => isFinite(p.cx) && isFinite(p.px));
const ok = fs.existsSync(outPath) && varied && momOk && noNaN;
console.log('\n=== 눈 검증: SW5 적응-h 압력 힘 — 분해능이 물질을 따라가며 힘이 보존된다 ===');
console.log(`  입자 ${NP}개 · h 범위(코어 작은 커널↔헤일로 큰 커널): ` + stat.map(s => `${s.hmin.toFixed(1)}~${s.hmax.toFixed(1)}`).join(' → '));
console.log('  순 운동량 |ΣP|(가변 h 여도 정확 보존): ' + stat.map(s => s.P.toExponential(1)).join(' → '));
console.log('  그림: 원 반지름 = h_i(커널)·색 = 분해능(작은 h=뜨거운색 고분해 코어·큰 h=찬색 저분해 헤일로) / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 가변 분해능(작은/큰 커널 공존)에서도 적응-h 압력이 운동량을 정확 보존' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

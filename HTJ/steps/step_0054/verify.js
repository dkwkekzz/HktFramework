// step_0054/verify.js — SW5 적응-h 압력 힘(0048 측정의 힘 연동). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — 0041 압력은 고정 h. 0048 은 입자별 h_i=η(m_i/ρ_i)^⅓ 를 자기일관으로 *재기만*
//   했다(수동 측정). 이 법칙은 그 h_i 를 *힘에 쓴다* — 쌍 h_i≠h_j 면 ∇W 비대칭 → 운동량 보존 위험. **대칭 평균
//   커널** ∇W̄_ij=½(∇W(r,h_i)+∇W(r,h_j)) 로 막는다(W̄ 대칭 → ∇_jW̄=−∇_iW̄ → 순 운동량 정확 보존). SPH 분해능이
//   물질을 따라가면서도 보존 유지 = SPH 물리 마무리.
//   적정 검증: ① 가변 h 운동량 정확 보존 ② 균일 h→0041 비트 일치(포섭) ③ 대칭 평균 커널 반대칭 ④ 적응 h 연동·압축 반발
//   ⑤ 항등/안전·결정론.
//   실행: node HTJ/steps/step_0054/verify.js
'use strict';
const path = require('path');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) + 1e-9 * Math.abs(b);

function ent(cx, cy, cz, mass) { return { cx, cy, cz, mass, px: 0, py: 0, pz: 0, KEcm: 0, internalE: 1, energy: 1 }; }
const clone = (ps) => ps.map(p => ({ ...p }));
function rndGen(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
// 변밀도 구름 — 조밀 코어 + 희박 헤일로(h_i 가 자릿수로 달라지게).
function cloud(seed) {
  const rnd = rndGen(seed), ps = [];
  const shell = (rmin, rmax) => { const r = rmin + rnd() * (rmax - rmin), th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1); return ent(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph), 1); };
  for (let i = 0; i < 40; i++) ps.push(shell(0, 1.5));
  for (let i = 0; i < 40; i++) ps.push(shell(4, 8));
  return ps;
}
const netP = (ps) => { let x = 0, y = 0, z = 0; for (const p of ps) { x += p.px; y += p.py; z += p.pz; } return Math.hypot(x, y, z); };

// ── 1. 가변 h 운동량 정확 보존 — 입자별 h_i 다른데도 대칭 평균 커널로 ΣP 보존 ──
{
  const ps = cloud(3);
  SPH.sphAdaptiveH(ps, { eta: 1.3, h0: 1.5 });             // 입자별 h_i·ρ_i 설정(자기일관)
  const hs = ps.map(p => p.h);
  const P0 = netP(ps);
  SPH.sphPressureForceVarH(ps, 0.05, { stiffness: 0.4, gamma: 2 });
  const P1 = netP(ps);
  const varied = Math.max(...hs) / Math.min(...hs) > 3;     // h 가 실제로 가변(코어↔헤일로)
  check('가변 h 운동량 정확 보존 — 대칭 평균 커널(∇_jW̄=−∇_iW̄)', relOk(P0, P1, 1e-9) && varied,
    `h 범위 ${Math.min(...hs).toFixed(2)}~${Math.max(...hs).toFixed(2)}(×${(Math.max(...hs) / Math.min(...hs)).toFixed(1)} 가변) · |ΣP| ${P0.toExponential(1)}→${P1.toExponential(1)}`);
}

// ── 2. 균일 h → 0041 비트 일치(포섭) — 모든 h 동일이면 ∇W̄=∇W → sphPressureForce 와 동일 ──
{
  const a = cloud(7), b = clone(a), h = 1.8;
  SPH.sphDensity(a, { h }); for (const p of a) p.h = h;     // 균일 h(수동)
  SPH.sphPressureForceVarH(a, 0.05, { stiffness: 0.4, gamma: 2 });
  SPH.sphPressureForce(b, 0.05, { stiffness: 0.4, gamma: 2, h });
  let maxd = 0;
  for (let i = 0; i < a.length; i++) maxd = Math.max(maxd, Math.abs(a[i].px - b[i].px), Math.abs(a[i].py - b[i].py), Math.abs(a[i].pz - b[i].pz));
  check('균일 h → 0041 비트 일치(포섭) — ∇W̄=∇W', maxd === 0, `max|Δpx| ${maxd.toExponential(2)} (0=비트 동일)`);
}

// ── 3. 대칭 평균 커널 반대칭 — ∇_iW̄_ij = −∇_jW̄_ji (운동량 보존의 뿌리) ──
{
  const hi = 1.2, hj = 2.7, dx = 0.6, dy = -0.4, dz = 0.3;
  const wbar = (DX, DY, DZ, a, c) => { const ga = SPH.kernelGradW(DX, DY, DZ, a), gc = SPH.kernelGradW(DX, DY, DZ, c); return [0.5 * (ga[0] + gc[0]), 0.5 * (ga[1] + gc[1]), 0.5 * (ga[2] + gc[2])]; };
  const gij = wbar(dx, dy, dz, hi, hj);          // ∇_iW̄_ij (r=r_i−r_j)
  const gji = wbar(-dx, -dy, -dz, hj, hi);       // ∇_jW̄_ji (r=r_j−r_i·h 순서도 swap)
  const anti = Math.abs(gij[0] + gji[0]) < 1e-15 && Math.abs(gij[1] + gji[1]) < 1e-15 && Math.abs(gij[2] + gji[2]) < 1e-15;
  check('대칭 평균 커널 반대칭 — ∇_iW̄ = −∇_jW̄', anti && (gij[0] !== 0),
    `∇_iW̄ (${gij[0].toFixed(4)},${gij[1].toFixed(4)},${gij[2].toFixed(4)}) = −∇_jW̄`);
}

// ── 4. 적응 h 연동·압축 반발 — 변밀도 구름에 적응 h 압력 → 압축이 반발(퍼짐)·NaN 없음 ──
{
  const ps = cloud(11);
  SPH.sphAdaptiveH(ps, { eta: 1.3, h0: 1.5 });
  const rms0 = (() => { let cx = 0, cy = 0, cz = 0; for (const p of ps) { cx += p.cx; cy += p.cy; cz += p.cz; } cx /= ps.length; cy /= ps.length; cz /= ps.length; let s = 0; for (const p of ps) s += (p.cx - cx) ** 2 + (p.cy - cy) ** 2 + (p.cz - cz) ** 2; return Math.sqrt(s / ps.length); })();
  for (let t = 0; t < 30; t++) {
    SPH.sphAdaptiveH(ps, { eta: 1.3, h0: 1.5 });            // 매 스텝 h 재적응(따뜻한 시작)
    SPH.sphPressureForceVarH(ps, 0.04, { stiffness: 0.3, gamma: 2 });
    for (const p of ps) { p.cx += p.px / p.mass * 0.04; p.cy += p.py / p.mass * 0.04; p.cz += p.pz / p.mass * 0.04; }
  }
  const rms1 = (() => { let cx = 0, cy = 0, cz = 0; for (const p of ps) { cx += p.cx; cy += p.cy; cz += p.cz; } cx /= ps.length; cy /= ps.length; cz /= ps.length; let s = 0; for (const p of ps) s += (p.cx - cx) ** 2 + (p.cy - cy) ** 2 + (p.cz - cz) ** 2; return Math.sqrt(s / ps.length); })();
  const noNaN = ps.every(p => isFinite(p.px) && isFinite(p.cx));
  check('적응 h 연동·압축 반발 — 압력이 퍼뜨림(rms↑)·NaN 없음', noNaN && rms1 > rms0,
    `rms ${rms0.toFixed(2)}→${rms1.toFixed(2)}(반발로 퍼짐) · NaN 없음 ${noNaN}`);
}

// ── 5. 항등/안전·결정론 — k=0→early-return · n<2 · 같은 입력 → 같은 지문 ──
{
  const ps = cloud(21), b = clone(ps);
  SPH.sphPressureForceVarH(ps, 0.05, { stiffness: 0 });     // k=0
  const off = ps.every((p, i) => p.px === b[i].px && p.py === b[i].py);
  const one = SPH.sphPressureForceVarH([ent(0, 0, 0, 1)], 0.05, { stiffness: 0.4 });   // n<2
  function fnv(ps) { let h = 0x811c9dc5 >>> 0; const push = (x) => { const bb = Buffer.alloc(8); bb.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= bb[k]; h = Math.imul(h, 0x01000193) >>> 0; } }; for (const p of ps) push(p.px); return h >>> 0; }
  const run = () => { const q = cloud(33); SPH.sphAdaptiveH(q, { eta: 1.3, h0: 1.5 }); SPH.sphPressureForceVarH(q, 0.05, { stiffness: 0.4, gamma: 2 }); return fnv(q); };
  const detOk = run() === run();
  check('항등/안전·결정론 — k=0 회귀·n<2 무탈·결정론', off && one.length === 1 && detOk,
    `k=0 회귀 ${off} · n<2 ok · 결정론 ${detOk}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 적응-h 압력 힘: 입자별 h_i 를 대칭 평균 커널로 힘에 연동·가변 h 여도 운동량 정확 보존(SPH 물리 마무리)' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

// step_0040/verify.js — SW5 첫 벽돌: SPH 커널 밀도 추정. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — 유체를 구체(SPH 입자)로. 이 단위는 SPH 의 토대 = 밀도 추정:
//   ρ_i = Σ_j m_j·W(|r_i−r_j|, h). 커널 = 3D 3차 B-스플라인(정규화 ∫W dV=1). 밀도는 *수동 측정*(회귀 0).
//
//   검증 대상:
//     1. 커널 정규화 — ∫ W(r,h) dV = 1(수치 적분)·짝함수 W(r)=W(−r)·지지 밖(q≥2) 0.
//     2. 균일 분포 → 참 밀도 — 등간격 격자(수밀도 n₀=1/d³)에서 내부 입자 ρ ≈ m·n₀(연속 극한).
//     3. 단일 입자 — ρ = m·W(0,h) = m/(π h³)(자기 기여)·정확.
//     4. 밀집 → 밀도↑ — 모인 입자(좁은 간격)의 중심 ρ > 흩어진 입자의 중심 ρ(단조).
//     5. 평행이동 불변 — 전체를 옮겨도 각 ρ 불변(국소 양).
//     6. 결정론.
//
//   실행: node HTJ/steps/step_0040/verify.js
'use strict';
const path = require('path');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);

// ── 1. 커널 정규화 — ∫W dV = 1(수치 적분)·짝함수·지지 밖 0 ──
{
  const h = 1.5, step = 0.02, R = 2 * h;
  let integral = 0;
  const dv = step * step * step;
  for (let z = -R; z < R; z += step) for (let y = -R; y < R; y += step) for (let x = -R; x < R; x += step) {
    const r = Math.sqrt((x + step / 2) ** 2 + (y + step / 2) ** 2 + (z + step / 2) ** 2);
    integral += SPH.kernelW(r, h) * dv;
  }
  // 짝함수 W(−r)=W(r)(커널은 거리만 받지만 부호 무관) + 값이 손 계산 공식과 일치(정규화 σ·f(q) 검증).
  const q07 = 0.7 / h, sig = 1 / (Math.PI * h * h * h), wExpect = sig * (1 - 1.5 * q07 * q07 + 0.75 * q07 ** 3);
  const even = SPH.kernelW(-0.7, h) === SPH.kernelW(0.7, h) && relOk(SPH.kernelW(0.7, h), wExpect, 1e-12);
  const outside = SPH.kernelW(2 * h, h) === 0 && SPH.kernelW(2 * h + 1, h) === 0;
  check('커널 정규화 — ∫W dV ≈ 1·짝함수·지지 밖(q≥2) 0',
    relOk(integral, 1, 0.01) && even && outside,
    `∫W dV = ${integral.toFixed(4)}(≈1) · W(2h)=${SPH.kernelW(2 * h, h)} · W(−0.7)=W(0.7)=${SPH.kernelW(0.7, h).toFixed(5)}`);
}

// ── 2. 균일 분포 → 참 밀도 — 등간격 격자서 내부 입자 ρ ≈ m·n₀ ──
{
  const h = 2, d = 0.5, m = 0.3, n0 = 1 / (d * d * d), rhoTrue = m * n0;   // 수밀도·참 밀도
  // 중심(0,0,0) 둘레 ±2h 격자 — 내부 입자가 충분한 이웃을 가짐.
  const parts = [];
  for (let z = -2 * h; z <= 2 * h + 1e-9; z += d) for (let y = -2 * h; y <= 2 * h + 1e-9; y += d) for (let x = -2 * h; x <= 2 * h + 1e-9; x += d)
    parts.push({ cx: x, cy: y, cz: z, mass: m });
  SPH.sphDensity(parts, { h });
  // 중심 입자(0,0,0) 찾기.
  const c = parts.find(p => Math.abs(p.cx) < 1e-9 && Math.abs(p.cy) < 1e-9 && Math.abs(p.cz) < 1e-9);
  check('균일 분포 → 참 밀도 — 등간격 격자 내부 입자 ρ ≈ m·n₀(연속 극한)',
    relOk(c.density, rhoTrue, 0.03 * rhoTrue),
    `ρ_center = ${c.density.toFixed(4)} · 참 밀도 m·n₀ = ${rhoTrue.toFixed(4)}(m=${m}·n₀=${n0}) · 상대오차 ${(100 * Math.abs(c.density - rhoTrue) / rhoTrue).toFixed(2)}%`);
}

// ── 3. 단일 입자 — ρ = m·W(0,h) = m/(π h³)(자기 기여) ──
{
  const h = 1.7, m = 2.5;
  const parts = [{ cx: 3, cy: -1, cz: 0.5, mass: m }];
  SPH.sphDensity(parts, { h });
  const expect = m / (Math.PI * h * h * h);
  check('단일 입자 — ρ = m·W(0,h) = m/(π h³)(자기 기여) 정확',
    relOk(parts[0].density, expect, 1e-9),
    `ρ = ${parts[0].density.toFixed(6)} · m/(π h³) = ${expect.toFixed(6)}`);
}

// ── 4. 밀집 → 밀도↑ — 모인 입자 중심 ρ > 흩어진 입자 중심 ρ ──
{
  const h = 2, m = 1;
  function lattice(d) { const p = []; for (let z = -1; z <= 1; z++) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) p.push({ cx: x * d, cy: y * d, cz: z * d, mass: m }); return p; }
  const tight = lattice(0.6), loose = lattice(1.6);   // 3×3×3, 좁은 간격 vs 넓은 간격
  SPH.sphDensity(tight, { h }); SPH.sphDensity(loose, { h });
  const ct = tight[13].density, cl = loose[13].density;   // 중심 입자(index 13 = (0,0,0))
  check('밀집 → 밀도↑ — 모인 입자(좁은 간격) 중심 ρ > 흩어진 입자 중심 ρ(단조)',
    ct > cl && ct > 0 && cl > 0,
    `좁은 간격 ρ_center = ${ct.toFixed(4)} > 넓은 간격 ρ_center = ${cl.toFixed(4)}`);
}

// ── 5. 평행이동 불변 — 전체를 옮겨도 각 ρ 불변 ──
{
  const h = 1.8, m = 1.2;
  const base = [[0, 0, 0], [1, 0.5, -0.5], [-0.8, 1.1, 0.3], [0.5, -1, 0.7]].map(([x, y, z]) => ({ cx: x, cy: y, cz: z, mass: m }));
  const shifted = base.map(p => ({ cx: p.cx + 10, cy: p.cy - 7, cz: p.cz + 3.5, mass: p.mass }));
  SPH.sphDensity(base, { h }); SPH.sphDensity(shifted, { h });
  let same = true; for (let i = 0; i < base.length; i++) if (!relOk(base[i].density, shifted[i].density, 1e-9)) same = false;
  check('평행이동 불변 — 전체를 옮겨도 각 입자 ρ 불변(국소 양)',
    same, `각 ρ 일치(예: ${base[0].density.toFixed(5)} = ${shifted[0].density.toFixed(5)})`);
}

// ── 6. 결정론 — 같은 입력 → 같은 밀도 지문 ──
{
  function fnv(parts) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of parts) push(p.density);
    return h >>> 0;
  }
  function scene() { const p = []; for (let i = 0; i < 12; i++) p.push({ cx: Math.cos(i) * 2, cy: Math.sin(i) * 2, cz: (i % 3) - 1, mass: 1 + 0.1 * i }); return p; }
  const a = fnv(SPH.sphDensity(scene(), { h: 1.5 }));
  const b = fnv(SPH.sphDensity(scene(), { h: 1.5 }));
  check('결정론 — 같은 입력 → 같은 밀도 추정 지문', a === b, `0x${a.toString(16)}`);
}

// ── 결과 출력 ──
let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 SPH 밀도 추정: 이웃 합으로 국소 밀도·정규화 1·균일→참 밀도·밀집→ρ↑(수동·회귀0)' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

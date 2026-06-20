// step_0007/verify.js — 보편중력 = 질량(=에너지)의 자기중력(Poisson)의 수치 검증. 순수·독립·영구.
//
//   step_0006 의 관성은 질량을 직진만 시켰다(힘 없음). 이 step 은 질량이 만든 퍼텐셜 Φ(∇²Φ=ρ−ρ̄)의
//   기울기로 운동량을 가속한다(g ← g + dt·G·ρ·(−∇Φ−ā)). 모든 질량이 끌어당김 = 만유인력.
//
//   검증 대상:
//     1. Poisson 정합 — 푼 Φ 가 ∇²Φ = (ρ−ρ̄) 를 만족(잔차 작음).
//     2. 인력         — 두 덩어리: 각자 *상대 쪽으로* 운동량을 받는다(서로 끌림).
//     3. 운동량 보존  — 내부 힘은 질량중심 못 가속 → Σg 정확 보존(평균 가속 차감).
//     4. 접근         — 중력+이류로 두 덩어리가 *가까워진다*(거리↓).
//     5. 뭉침         — 농축↑(분산 증가). 확산의 거울상.
//     6. PE→KE        — 붕괴하며 운동에너지 증가(낙하로 가속).
//     7. 질량 보존    — 중력+이류 진화 동안 Σρ 불변.
//     8. 대조(G=0)    — 중력 없으면 운동량 0 → 세계 정지(분산·거리 불변).
//     9. 항등(G=0)    — 중력 0 이면 세계 불변(회귀 0).
//    10. 결정론       — 같은 흐름 → 동일 지문.
//
//   실행: node HTJ/steps/step_0007/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Eng = require(path.resolve(__dirname, '../../engine/htj-energy.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 좌/우 반쪽 질량중심 x 사이 거리(두 덩어리 분리도).
function blobGap(w) {
  const N = w.N, r = w.fields.energy, c = (N - 1) / 2;
  let lx = 0, lm = 0, rx = 0, rm = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = r[(z * N + y) * N + x];
    if (x < c) { lx += v * x; lm += v; } else if (x > c) { rx += v * x; rm += v; }
  }
  return (rx / rm) - (lx / lm);
}

// ── 1. Poisson 정합 ──
{
  const N = 16, w = W.createWorld(N);
  Gr.seedTwoMasses(w, { sep: 4, sigma: 1.5, M0: 1000 });
  Gr.solvePotential(w, { iters: 600, reset: true });
  const res = Gr.poissonResidual(w);
  check('Poisson 정합 — ∇²Φ ≈ (ρ−ρ̄) (잔차 작음)', res < 1e-3, `max 잔차 = ${res.toExponential(2)}`);
}

// ── 2. 인력 ──
{
  const N = 16, c = (N - 1) / 2, w = W.createWorld(N);
  Gr.seedTwoMasses(w, { sep: 4, sigma: 1.5, M0: 1000 });
  Gr.applyGravity(w, 1, { G: 1, iters: 600 });
  const gx = w.fields.mom_x;
  let left = 0, right = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = gx[(z * N + y) * N + x];
    if (x < c) left += v; else if (x > c) right += v;
  }
  check('인력 — 왼쪽 덩어리 +x(오른쪽으로), 오른쪽 −x(왼쪽으로)', left > 0 && right < 0,
    `왼 Σgx=${left.toExponential(2)} (>0), 오 Σgx=${right.toExponential(2)} (<0)`);
}

// ── 3. 운동량 보존 ──
{
  const N = 16, w = W.createWorld(N);
  Gr.seedTwoMasses(w, { sep: 4, sigma: 1.5, M0: 1000 });
  const before = Ine.totalMomentum(w);
  for (let t = 0; t < 5; t++) Gr.applyGravity(w, 0.5, { G: 1, iters: 200 });
  const after = Ine.totalMomentum(w);
  const drift = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
  check('운동량 보존 — 내부 힘은 Σg 못 바꿈(평균 가속 차감)', drift < 1e-6, `|ΔΣg| = ${drift.toExponential(2)}`);
}

// ── 4~8. 중력+이류 진화: 접근·뭉침·PE→KE·질량보존·대조 ──
function evolve(G, steps) {
  const N = 20, w = W.createWorld(N);
  Gr.seedTwoMasses(w, { sep: 5, sigma: 1.6, M0: 1000 });   // 좌우 두 덩어리(영 배경, 내부)
  const m0 = { M: w.total('energy'), v: Eng.energyVariance(w), ke: Gr.kineticEnergy(w), gap: blobGap(w) };
  for (let t = 0; t < steps; t++) { Gr.applyGravity(w, 0.3, { G, iters: 80 }); Ine.advect(w, 0.3); }
  return { w, m0, M: w.total('energy'), v: Eng.energyVariance(w), ke: Gr.kineticEnergy(w), gap: blobGap(w) };
}
{
  const g = evolve(0.3, 20), z = evolve(0.0, 20);
  check('접근 — 중력으로 두 덩어리가 가까워진다(거리↓)', g.gap < g.m0.gap - 0.3,
    `간격 ${g.m0.gap.toFixed(2)} → ${g.gap.toFixed(2)}`);
  check('뭉침 — 농축↑(분산 증가, 확산의 거울상)', g.v > g.m0.v * 3,
    `분산 ${g.m0.v.toExponential(2)} → ${g.v.toExponential(2)}`);
  check('PE→KE — 붕괴하며 운동에너지 증가(낙하 가속)', g.ke > g.m0.ke && g.ke > 0,
    `KE ${g.m0.ke.toExponential(2)} → ${g.ke.toExponential(2)}`);
  check('질량 보존 — 중력+이류 동안 Σρ 불변', Math.abs(g.M - g.m0.M) / g.m0.M < 1e-9,
    `ΔM/M0 = ${(Math.abs(g.M - g.m0.M) / g.m0.M).toExponential(2)}`);
  check('대조 — G=0: 운동량 0 → 세계 정지(분산·거리 불변)',
    Math.abs(z.v - z.m0.v) < 1e-9 && Math.abs(z.gap - z.m0.gap) < 1e-9,
    `분산 Δ=${Math.abs(z.v - z.m0.v).toExponential(2)}, 간격 Δ=${Math.abs(z.gap - z.m0.gap).toExponential(2)}`);
}

// ── 9. 항등(G=0) ──
{
  const N = 16, w = W.createWorld(N);
  Gr.seedTwoMasses(w, { sep: 4, sigma: 1.5 });
  const fp = w.fingerprint('energy'), fpx = w.fingerprint('mom_x');
  Gr.applyGravity(w, 0.5, { G: 0 });
  Gr.applyGravity(w, 0, { G: 1 });
  check('항등 — G=0/dt=0 이면 세계 불변(회귀 0)',
    w.fingerprint('energy') === fp && w.fingerprint('mom_x') === fpx, `0x${fp.toString(16)}`);
}

// ── 10. 결정론 ──
{
  function run() {
    const w = W.createWorld(20);
    Gr.seedTwoMasses(w, { sep: 5, sigma: 1.6, M0: 1000 });
    for (let t = 0; t < 10; t++) { Gr.applyGravity(w, 0.3, { G: 0.3, iters: 80 }); Ine.advect(w, 0.3); }
    return w.fingerprint('energy');
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0007 수치 검증: 보편중력 = 질량(에너지)의 자기중력(Poisson) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

// step_0012/verify.js — 내부 발열(별의 점화, 온도 버전)의 수치 검증. 순수·독립·영구.
//
//   step_0011 까지로 *돌*(차가운 정착 덩어리)은 창발한다. 이 step 은 **밀도·온도 게이트 내부 발열**로
//   *별*(에너지 방출 존재)을 더한다 — 무겁고 뜨거운 코어만 점화해 스스로 열을 만든다(질량 보존):
//     게이트: ρ≥ρ_crit ∧ T≥T_crit (T=u/ρ),  발열: u ← u + dt·rate·ρ (게이트 켜진 셀), ρ 불변.
//   별과 돌이 *같은 법칙의 두 regime*으로 갈린다 — 무거우면 압축으로 임계 넘어 점화(별), 가벼우면
//   못 넘어 식음(돌). author 안 함.
//
//   검증 대상:
//     1. 점화 게이트   — ρ·T 의 AND. 무겁고 뜨거운 셀만 발열; 옅거나 차가우면 무력.
//     2. 질량 보존     — energy(ρ)는 절대 안 건드린다(별이 빛내도 질량 유지 = 0005 질량 소실 닫음).
//     3. 발열량 정확   — 점화 셀 Δu = dt·rate·ρ (정량).
//     4. 자기지속(latch)— 점화한 셀은 발열로 T 가 더 올라 게이트 유지 → u 단조↑(켜지면 유지=별의 정체성).
//     5. 별 vs 돌 (질량이 가른다) — 붕괴 파이프라인: 무거운 코어는 발열 ON≠OFF(점화=별·더 뜨겁고 부풂),
//        가벼운 코어는 발열 ON≡OFF(불활성=돌). 같은 법칙, 임계 하나로 갈림. **헤드라인.**
//     6. 항등(rate=0)  — 발열률 0 이면 세계 불변(회귀 0).
//     7. 항등(dt=0)    — dt=0 이면 세계 불변(회귀 0).
//     8. 결정론        — 같은 흐름 → 동일 지문.
//
//   실행: node HTJ/steps/step_0012/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 셀 4개에 (ρ,T) 를 직접 심는다: dense+hot / dense+cold / sparse+hot / sparse+cold.
function makeCells(specs) {
  const N = 4, w = W.createWorld(N), r = w.fields.energy, u = w.addField('therm');
  for (let k = 0; k < specs.length; k++) { const [rho, T] = specs[k]; r[k] = rho; u[k] = rho * T; }  // u=ρT → T=u/ρ
  return w;
}

// ── 1. 점화 게이트 — ρ·T 의 AND ──
{
  const w = makeCells([[10, 5], [10, 1], [2, 5], [2, 1]]);  // [dense+hot, dense+cold, sparse+hot, sparse+cold]
  const u0 = Float64Array.from(w.fields.therm);
  Fu.applyFusion(w, 0.5, { rate: 1, rhoCrit: 6, tCrit: 3 });
  const u = w.fields.therm;
  const onlyDenseHot = (u[0] > u0[0]) && (u[1] === u0[1]) && (u[2] === u0[2]) && (u[3] === u0[3]);
  check('점화 게이트 — ρ≥ρ_crit ∧ T≥T_crit (무겁고 뜨거운 셀만 발열)', onlyDenseHot,
    `dense+hot Δu=${(u[0] - u0[0]).toFixed(1)}(>0); dense+cold/sparse+hot/sparse+cold Δu=0`);
}

// ── 2. 질량 보존 — energy(ρ) 불변 ──
{
  const w = makeCells([[10, 5], [12, 4], [8, 6], [9, 3]]);   // 모두 점화 조건
  const fpRho = w.fingerprint('energy');
  for (let t = 0; t < 5; t++) Fu.applyFusion(w, 0.3, { rate: 2, rhoCrit: 6, tCrit: 3 });
  check('질량 보존 — energy(ρ)는 안 건드린다(별이 빛내도 질량 유지)', w.fingerprint('energy') === fpRho,
    `fp(energy) 불변 = 0x${fpRho.toString(16)}`);
}

// ── 3. 발열량 정확 — Δu = dt·rate·ρ ──
{
  const w = makeCells([[10, 5]]);
  const u0 = w.fields.therm[0], dt = 0.4, rate = 1.5, rho = 10;
  Fu.applyFusion(w, dt, { rate, rhoCrit: 6, tCrit: 3 });
  const exp = dt * rate * rho, got = w.fields.therm[0] - u0;
  check('발열량 정확 — Δu = dt·rate·ρ', Math.abs(got - exp) < 1e-12, `Δu=${got.toFixed(3)} (예측 dt·rate·ρ=${exp.toFixed(3)})`);
}

// ── 4. 자기지속(latching) — 점화 셀은 발열로 T↑ → 게이트 유지 → u 단조↑ ──
{
  const w = makeCells([[10, 3.0]]);   // 게이트 경계 바로 위(ρ=10≥6, T=3.0≥3)
  let prev = w.fields.therm[0], mono = true, lit = true;
  for (let t = 0; t < 10; t++) {
    Fu.applyFusion(w, 0.3, { rate: 1, rhoCrit: 6, tCrit: 3 });
    const now = w.fields.therm[0];
    if (now <= prev) mono = false;                                  // u 단조↑
    if (Fu.ignitedCount(w, { rhoCrit: 6, tCrit: 3 }) < 1) lit = false; // 계속 점화 상태
    prev = now;
  }
  const Tend = w.fields.therm[0] / 10;
  check('자기지속(latch) — 점화 셀 u 단조↑·게이트 유지(켜지면 유지=별)', mono && lit && Tend > 3,
    `T 3.0→${Tend.toFixed(1)} (단조↑·계속 점화)`);
}

// ── 5. 별 vs 돌 (질량이 가른다) — 붕괴 파이프라인, 발열 ON/OFF 대조 [헤드라인] ──
function collapse(M0, rate) {
  const N = 20, w = W.createWorld(N), rhoCrit = 6, tCrit = 3;
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0, T0: 1 });
  for (let t = 0; t < 80; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });
    Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
    Fu.applyFusion(w, 0.2, { rate, rhoCrit, tCrit });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  return { maxT: Fu.maxTemperature(w), peak: w.max('energy'), mass: w.total('energy'), fpU: w.fingerprint('therm') };
}
{
  const starOn = collapse(4000, 2), starOff = collapse(4000, 0);   // 무거움
  const rockOn = collapse(1000, 2), rockOff = collapse(1000, 0);   // 가벼움
  // 별: 발열이 *활성* → ON 이 OFF 보다 훨씬 뜨겁고(점화 보탬) 임계 넘음. 돌: 발열 *불활성* → ON≡OFF 동일.
  const starActive = starOn.maxT > starOff.maxT * 1.4 && starOn.maxT > 3 && !Number.isNaN(starOn.mass);
  const rockInert = rockOn.fpU === rockOff.fpU && rockOn.maxT < 3;
  check('별 vs 돌 (질량이 가른다) — 무거움=발열 활성(ON≫OFF, 별), 가벼움=발열 불활성(ON≡OFF, 돌)',
    starActive && rockInert,
    `별 maxT ON=${starOn.maxT.toFixed(1)}≫OFF=${starOff.maxT.toFixed(1)}(점화·부풂 peak ${starOn.peak.toFixed(1)}<${starOff.peak.toFixed(1)}); 돌 maxT=${rockOn.maxT.toFixed(1)} ON≡OFF(불활성)`);
}

// ── 6. 항등(rate=0) ──
{
  const w = makeCells([[10, 5], [12, 4]]);
  const fpU = w.fingerprint('therm'), fpR = w.fingerprint('energy');
  Fu.applyFusion(w, 0.5, { rate: 0, rhoCrit: 6, tCrit: 3 });
  check('항등 — rate=0 이면 세계 불변(회귀 0)', w.fingerprint('therm') === fpU && w.fingerprint('energy') === fpR, `0x${fpU.toString(16)}`);
}

// ── 7. 항등(dt=0) ──
{
  const w = makeCells([[10, 5], [12, 4]]);
  const fpU = w.fingerprint('therm');
  Fu.applyFusion(w, 0, { rate: 2, rhoCrit: 6, tCrit: 3 });
  check('항등 — dt=0 이면 세계 불변(회귀 0)', w.fingerprint('therm') === fpU, `0x${fpU.toString(16)}`);
}

// ── 8. 결정론 ──
{
  function run() { const w = makeCells([[10, 5], [12, 4], [8, 6]]); for (let t = 0; t < 8; t++) Fu.applyFusion(w, 0.2, { rate: 1.3, rhoCrit: 6, tCrit: 3 }); return w.fingerprint('therm'); }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0012 수치 검증: 내부 발열(별의 점화) — 별과 돌이 임계로 갈린다 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

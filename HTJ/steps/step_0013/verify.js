// step_0013/verify.js — 복사 냉각(열의 출구 = 빛, 질량 보존)의 수치 검증. 순수·독립·영구.
//
//   step_0012 발열은 코어에 열을 *무한정* 쌓는다(복사 없음 → runaway). 이 step 은 **광학적으로 얇은
//   회색 복사**로 모든 셀이 제 열을 빛으로 내보낸다(질량 보존):
//     u ← u·(1 − dt·coolRate),   빛 = Σ dt·coolRate·u → world.radiated 장부.  energy(ρ) 불변.
//   발열(source)↔복사(sink)가 균형 잡아 별이 *유한 정상상태*에서 빛난다 — 0012 runaway 를 닫는다.
//
//   검증 대상:
//     1. 냉각 정의     — 모든 셀 u 가 factor=(1−dt·coolRate) 로 줄고 음수 안 됨.
//     2. 질량 보존     — energy(ρ)는 절대 안 건드린다(빛은 *열*에서, 질량 아님 = 0005 질량소실 닫음).
//     3. 열 회계       — 세계 안 u 감소분 = 세계 밖 radiated 증가분(빛 장부, 열 보존).
//     4. 돌은 식는다   — 발열 없는 셀: u 가 기하급수로 단조↓ → 0(완전히 식음, T→0).
//     5. 별의 정상상태 (헤드라인 정량) — 발열↔복사 균형 → T* = rate(1−dt·coolRate)/coolRate,
//        **밀도 ρ 무관**(무게 다른 두 별이 같은 표면온도로).
//     6. runaway 닫힘 (헤드라인 대조) — 점화 셀: 발열만(0012)이면 T 무한↑(∝스텝) vs 발열+복사면 유한 평형.
//     7. 붕괴 파이프라인 — 냉각 ON: 빛 방출(radiated>0)·열↓·질량 보존·NaN 없음(창발 통합, robust).
//     8. 항등(coolRate=0) — 세계 불변(회귀 0).
//     9. 항등(dt=0)    — 세계 불변(회귀 0).
//    10. 결정론        — 같은 흐름 → 동일 지문.
//
//   실행: node HTJ/steps/step_0013/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 셀들에 (ρ,T) 를 직접 심는다.
function makeCells(specs) {
  const N = 4, w = W.createWorld(N), r = w.fields.energy, u = w.addField('therm');
  for (let k = 0; k < specs.length; k++) { const [rho, T] = specs[k]; r[k] = rho; u[k] = rho * T; }  // u=ρT → T=u/ρ
  return w;
}

// ── 1. 냉각 정의 — u ← u·(1−dt·coolRate), 음수 없음 ──
{
  const w = makeCells([[10, 5], [3, 2]]);
  const u0 = Float64Array.from(w.fields.therm), dt = 0.5, coolRate = 0.4, f = 1 - dt * coolRate;
  Co.applyCooling(w, dt, { coolRate });
  const u = w.fields.therm;
  const ok = Math.abs(u[0] - u0[0] * f) < 1e-12 && Math.abs(u[1] - u0[1] * f) < 1e-12 && u[0] >= 0 && u[1] >= 0;
  check('냉각 정의 — u ← u·(1−dt·coolRate), 비음수', ok,
    `factor=${f} → u[0] ${u0[0]}→${u[0].toFixed(3)}, u[1] ${u0[1]}→${u[1].toFixed(3)}`);
}

// ── 2. 질량 보존 — energy(ρ) 불변 ──
{
  const w = makeCells([[10, 5], [12, 4], [8, 6], [9, 3]]);
  const fpRho = w.fingerprint('energy');
  for (let t = 0; t < 5; t++) Co.applyCooling(w, 0.3, { coolRate: 0.5 });
  check('질량 보존 — energy(ρ)는 안 건드린다(빛은 열에서, 질량 아님)', w.fingerprint('energy') === fpRho,
    `fp(energy) 불변 = 0x${fpRho.toString(16)}`);
}

// ── 3. 열 회계 — Σu 감소분 = world.radiated 증가분 ──
{
  const w = makeCells([[10, 5], [12, 4], [8, 6]]);
  const u0 = Co.totalInternal(w);
  for (let t = 0; t < 7; t++) Co.applyCooling(w, 0.25, { coolRate: 0.3 });
  const u1 = Co.totalInternal(w), emitted = w.radiated;
  check('열 회계 — 세계 안 u 감소 = 세계 밖 radiated(빛 보존)', Math.abs((u0 - u1) - emitted) < 1e-9,
    `Δu=${(u0 - u1).toFixed(4)} = radiated=${emitted.toFixed(4)}`);
}

// ── 4. 돌은 완전히 식는다 — 발열 없는 셀 u 기하급수 단조↓ → 0 ──
{
  const w = makeCells([[3, 4]]);   // ρ<rhoCrit(=6) → 점화 안 함
  let prev = w.fields.therm[0], mono = true;
  for (let t = 0; t < 60; t++) { Co.applyCooling(w, 0.3, { coolRate: 0.3 }); const now = w.fields.therm[0]; if (now >= prev) mono = false; prev = now; }
  const Tend = w.fields.therm[0] / 3;
  check('돌은 식는다 — 발열 없는 셀 u 단조↓ → 0(완전히 식음)', mono && Tend < 0.05,
    `T 4.0 → ${Tend.toExponential(2)} (단조 감소)`);
}

// ── 5. 별의 정상상태 (헤드라인 정량) — T* = rate(1−dt·coolRate)/coolRate, 밀도 무관 ──
{
  const dt = 0.2, rate = 2, coolRate = 0.1, rhoCrit = 6, tCrit = 3;
  const Tstar = Co.equilibriumT(rate, coolRate, dt);   // 예측 평형온도(ρ 무관)
  function settle(rho) {
    const w = makeCells([[rho, 10]]);                  // 점화 조건(ρ≥6, T=10≥3)에서 출발
    for (let t = 0; t < 3000; t++) { Fu.applyFusion(w, dt, { rate, rhoCrit, tCrit }); Co.applyCooling(w, dt, { coolRate }); }
    return w.fields.therm[0] / rho;                    // 수렴 온도
  }
  const Ta = settle(10), Tb = settle(20);              // 무게 다른 두 별
  const converged = Math.abs(Ta - Tstar) < 1e-6 && Math.abs(Tb - Tstar) < 1e-6;
  const massIndependent = Math.abs(Ta - Tb) < 1e-9;
  check('별의 정상상태 — 발열↔복사 균형 T*=rate(1−dt·coolRate)/coolRate, 밀도 무관 [헤드라인]',
    converged && massIndependent,
    `T*(예측)=${Tstar.toFixed(4)}; ρ=10→T=${Ta.toFixed(4)}, ρ=20→T=${Tb.toFixed(4)} (같은 평형=무게 무관)`);
}

// ── 6. runaway 닫힘 (헤드라인 대조) — 점화 셀: 발열만(0012)이면 T 무한↑ vs 발열+복사면 유한 평형 ──
{
  const dt = 0.2, rate = 2, coolRate = 0.1, rhoCrit = 6, tCrit = 3, rho = 10;
  function runT(steps, withCool) {
    const w = makeCells([[rho, 5]]);
    for (let t = 0; t < steps; t++) { Fu.applyFusion(w, dt, { rate, rhoCrit, tCrit }); if (withCool) Co.applyCooling(w, dt, { coolRate }); }
    return w.fields.therm[0] / rho;
  }
  const off300 = runT(300, false), off600 = runT(600, false);   // 발열만 = 0012: 선형 무한↑
  const on300 = runT(300, true), on600 = runT(600, true);       // 발열+복사: 유한 평형
  const runaway = off600 / off300 > 1.8 && off300 > 100;        // 스텝 2배 → T ~2배(무한 상승)
  const bounded = on600 / on300 < 1.05 && on600 < 20;           // 평형 평탄(스텝 2배에도 ≈불변, 유한)
  check('runaway 닫힘 — 발열만 T 무한↑(∝스텝) vs 발열+복사 유한 평형 [헤드라인]',
    runaway && bounded,
    `발열만 T 300→600스텝 ${off300.toFixed(0)}→${off600.toFixed(0)}(×${(off600 / off300).toFixed(2)} 무한↑) vs 발열+복사 ${on300.toFixed(2)}→${on600.toFixed(2)}(×${(on600 / on300).toFixed(3)} 평형)`);
}

// ── 7. 붕괴 파이프라인 통합 — 냉각 ON: 빛 방출·열 감소·질량 보존·NaN 없음 ──
function collapse(steps, coolRate) {
  const N = 20, w = W.createWorld(N), rhoCrit = 6, tCrit = 3;
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 4000, T0: 1 });
  for (let t = 0; t < steps; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });
    Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
    Fu.applyFusion(w, 0.2, { rate: 2, rhoCrit, tCrit });
    Co.applyCooling(w, 0.2, { coolRate });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  return w;
}
{
  const on = collapse(120, 0.06), off = collapse(120, 0);     // 냉각 ON vs OFF(=0012)
  const uOn = Co.totalInternal(on), uOff = Co.totalInternal(off);
  const litOn = Fu.ignitedCount(on, { rhoCrit: 6, tCrit: 3 }), peakOn = on.max('energy'), peakOff = off.max('energy');
  const light = on.radiated > 0 && (off.radiated || 0) === 0;  // 냉각만 빛을 낸다
  const sustained = litOn > 0;                                 // 점화 *지속*(꺼지지 않음)
  const compact = peakOn > peakOff * 3;                        // 냉각=조밀 유지 vs 무냉각=부풀어 흩어짐
  const lessHeat = uOn < uOff;                                 // 열을 빛으로 버림
  const massOk = Math.abs(on.total('energy') - 4000) < 1e-6 && !Number.isNaN(on.total('energy'));
  check('붕괴 파이프라인 — 냉각 ON: 조밀·점화 지속·빛 방출 vs OFF 과열로 흩어짐 [헤드라인 창발]',
    light && sustained && compact && lessHeat && massOk,
    `ON 점화 ${litOn}셀·peakρ ${peakOn.toFixed(1)}·빛 ${on.radiated.toFixed(0)} vs OFF 점화 0·peakρ ${peakOff.toFixed(1)}(흩어짐)·빛 0; Σu ${uOn.toFixed(0)}<${uOff.toFixed(0)}·Σρ ${on.total('energy').toFixed(0)}`);
}

// ── 8. 항등(coolRate=0) ──
{
  const w = makeCells([[10, 5], [12, 4]]);
  const fpU = w.fingerprint('therm'), fpR = w.fingerprint('energy');
  Co.applyCooling(w, 0.5, { coolRate: 0 });
  check('항등 — coolRate=0 이면 세계 불변(회귀 0)', w.fingerprint('therm') === fpU && w.fingerprint('energy') === fpR, `0x${fpU.toString(16)}`);
}

// ── 9. 항등(dt=0) ──
{
  const w = makeCells([[10, 5], [12, 4]]);
  const fpU = w.fingerprint('therm');
  Co.applyCooling(w, 0, { coolRate: 0.3 });
  check('항등 — dt=0 이면 세계 불변(회귀 0)', w.fingerprint('therm') === fpU, `0x${fpU.toString(16)}`);
}

// ── 10. 결정론 ──
{
  function run() { const w = makeCells([[10, 5], [12, 4], [8, 6]]); for (let t = 0; t < 8; t++) Co.applyCooling(w, 0.2, { coolRate: 0.3 }); return w.fingerprint('therm'); }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0013 수치 검증: 복사 냉각(빛으로 식는 별) — 발열↔복사 균형의 정상상태 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

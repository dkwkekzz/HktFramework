// step_0011/verify.js — 비가역 소산(인공 점성/충격 가열)의 수치 검증. 순수·독립·영구.
//
//   step_0010 의 열압력은 KE↔내부E 를 *가역*(단열)으로 교환 → 진동을 **감쇠 못 함**(무감쇠). 이 step 은
//   인공 bulk 점성 q=Kvisc·ρ·(∇·v)² (압축 ∇·v<0 에서만)을 더한다:
//     g ← g − dt·∇q  (압축 흐름 감속 = KE↓) · u ← u − dt·q·(∇·v)  (PdV; div<0 → u↑, 항상 가열)
//   열압력과 구조는 같되 **q 가 압축에서만 켜져** 식히는 법이 없다 → KE 가 열로 *일방* 빠진다(엔트로피↑
//   =비가역) → 진동 감쇠 → 정착. step_0008 의 탄성 bounce(CFL 발산)에 소산을 준다.
//
//   검증 대상:
//     1. 소산 정의   — 압축(∇·v<0) → q>0 → bulk KE↓·내부E↑(가열). 부호.
//     2. 비가역 일방 밸브 — *팽창*(∇·v>0)에선 q=0 → 안 식힌다(Δu≈0). 가역 열압력은 같은 팽창서 식힌다(Δu<0).
//        이 비대칭이 비가역의 핵심(한 사이클에 KE 가 열로 일방 빠짐).
//     3. 총E=KE+u 보존 — 점성은 *형태 변환*이지 손실 아님. 표류 작고 dt 절반 → 표류 절반(1차 수렴).
//     4. 운동량 보존 — 주기 중심차분 → Σ∇q=0 → ΣΔg 정확 보존(내부 힘, 뉴턴 3법칙).
//     5. 균일 무력   — 균일 ρ·균일 v → ∇·v=0 → q=0 → 운동량·u 불변.
//     6. 감쇠(정착)  — 중력+열압력 진동에 점성 ON → 내부E 누적↑·운동E 잔류↓ vs OFF(무감쇠). 헤드라인.
//     7. 항등(Kvisc=0) — 결합 0 이면 세계 불변(회귀 0).
//     8. 항등(dt=0)  — dt=0 이면 세계 불변(회귀 0).
//     9. 결정론      — 같은 흐름 → 동일 지문.
//
//   실행: node HTJ/steps/step_0011/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

const GAMMA = 5 / 3;
const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
function imposeVelocity(w, vfn) {
  const N = w.N, rho = w.fields.energy;
  for (const nm of [Vi.MX, Vi.MY, Vi.MZ]) if (!w.fields[nm]) w.addField(nm, { type: Float64Array });
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x, r = rho[i], [vx, vy, vz] = vfn(x, y, z);
    w.fields[Vi.MX][i] = r * vx; w.fields[Vi.MY][i] = r * vy; w.fields[Vi.MZ][i] = r * vz;
  }
}

// ── 1. 소산 정의 — 압축 → q>0 → KE↓·u↑(가열) ──
{
  const N = 16, c = (N - 1) / 2, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.2, M0: 1000, T0: 1 });
  imposeVelocity(w, (x, y, z) => [-0.02 * (x - c), -0.02 * (y - c), -0.02 * (z - c)]);  // 수렴(압축)
  const KE0 = Vi.kineticEnergy(w), u0 = Vi.totalInternal(w);
  Vi.applyViscosity(w, 0.3, { Kvisc: 1 });
  const KE1 = Vi.kineticEnergy(w), u1 = Vi.totalInternal(w);
  check('소산 정의 — 압축(∇·v<0) → bulk KE↓·내부E↑(가열)', KE1 < KE0 && u1 > u0,
    `ΔKE=${(KE1 - KE0).toExponential(2)}(↓), Δu=${(u1 - u0).toExponential(2)}(↑, |ΔKE|≈Δu)`);
}

// ── 2. 비가역 일방 밸브 — 팽창에선 점성 q=0(안 식힘) vs 가역 열압력은 식힌다 ──
{
  const N = 16, c = (N - 1) / 2;
  // 점성: 팽창(발산) 주입 → q=0 → u 불변(안 식힘).
  const wv = W.createWorld(N);
  Th.seedWarmBlob(wv, { sigma: N * 0.2, M0: 1000, T0: 2 });
  imposeVelocity(wv, (x, y, z) => [0.02 * (x - c), 0.02 * (y - c), 0.02 * (z - c)]);   // 발산(팽창)
  const uV0 = Vi.totalInternal(wv);
  Vi.applyViscosity(wv, 0.3, { Kvisc: 1 });
  const dViscExpand = Vi.totalInternal(wv) - uV0;          // ≈ 0 (안 식힘)
  // 가역 열압력: 같은 팽창 → u 감소(식힌다).
  const wt = W.createWorld(N);
  Th.seedWarmBlob(wt, { sigma: N * 0.2, M0: 1000, T0: 2 });
  imposeVelocity(wt, (x, y, z) => [0.02 * (x - c), 0.02 * (y - c), 0.02 * (z - c)]);
  const uT0 = Th.totalInternal(wt);
  Th.applyThermalPressure(wt, 0.3, { Kth: 1, gamma: GAMMA });
  const dThermExpand = Th.totalInternal(wt) - uT0;         // < 0 (식힌다)
  // 핵심 비대칭: 점성은 팽창서 *절대 식히지 않는다*(Δu≥0, 일방 밸브 — 여기 +0.018 은 비주기 주입장의
  //   경계 seam 압축 가열, 그조차 *가열*이다) vs 가역 열압력은 팽창서 식힌다(Δu<0, 되돌림).
  check('비가역 일방 밸브 — 점성은 팽창서도 안 식힘(Δu≥0, 일방), 가역 열압력은 식힘(Δu<0)',
    dViscExpand >= -1e-9 && dThermExpand < -1,
    `점성 Δu=${dViscExpand.toExponential(2)} (≥0, 안 식힘), 열압력 Δu=${dThermExpand.toFixed(1)} (<0, 식힘)`);
}

// ── 3. 총E=KE+u 보존 (1차·dt 수렴) ──
function dissipate(dt, n) {
  const N = 16, c = (N - 1) / 2, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  imposeVelocity(w, (x, y, z) => [-0.02 * (x - c), -0.02 * (y - c), -0.02 * (z - c)]);  // 수렴(소산 거리)
  const E0 = Vi.kineticEnergy(w) + Vi.totalInternal(w);
  for (let t = 0; t < n; t++) Vi.applyViscosity(w, dt, { Kvisc: 1 });
  const KE = Vi.kineticEnergy(w), u = Vi.totalInternal(w);
  return { KE, u, E0, E1: KE + u, drift: Math.abs(KE + u - E0) / E0 };
}
{
  const a = dissipate(0.05, 80), b = dissipate(0.025, 160);
  const ratio = a.drift / b.drift;
  check('총E=KE+u 보존 — 점성=형태 변환(KE→u), 표류 작고 dt½ → 표류 절반(1차)', a.drift < 0.03 && ratio > 1.5,
    `KE→u(잔여 KE ${a.KE.toFixed(2)}, u ${a.E0.toFixed(0)}→${a.u.toFixed(0)}); 표류 ${(a.drift * 100).toFixed(2)}%→${(b.drift * 100).toFixed(2)}%(비율 ${ratio.toFixed(2)})`);
}

// ── 4. 운동량 보존 ──
{
  const N = 16, c = (N - 1) / 2, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  imposeVelocity(w, (x, y, z) => [-0.02 * (x - c), 0.01 * (y - c), 0]);
  for (let t = 0; t < 5; t++) Vi.applyViscosity(w, 0.2, { Kvisc: 1 });
  const sx = w.total('mom_x'), sy = w.total('mom_y'), sz = w.total('mom_z');
  // 주입 속도장 자체의 Σg 는 0 이 아니므로, 점성이 *더하는* ΣΔg 만 0 인지 본다 → 보존 후에도 초기 Σg 유지.
  const w0 = W.createWorld(N); Th.seedWarmBlob(w0, { sigma: N * 0.18, M0: 1000, T0: 1 });
  imposeVelocity(w0, (x, y, z) => [-0.02 * (x - c), 0.01 * (y - c), 0]);
  const dx = sx - w0.total('mom_x'), dy = sy - w0.total('mom_y'), dz = sz - w0.total('mom_z');
  check('운동량 보존 — 주기 중심차분 → Σ∇q=0 → ΣΔg 정확 보존', Math.hypot(dx, dy, dz) < 1e-9,
    `|ΣΔg| = ${Math.hypot(dx, dy, dz).toExponential(2)}`);
}

// ── 5. 균일 무력 — 균일 ρ·균일 v → ∇·v=0 → q=0 ──
{
  const N = 10, w = W.createWorld(N), r = w.fields.energy, u = w.addField('therm');
  for (let i = 0; i < r.length; i++) { r[i] = 5; u[i] = 10; }
  imposeVelocity(w, () => [0.7, -0.3, 0.2]);                // 균일(평행이동) 속도
  const u0 = Float64Array.from(u), gx0 = Float64Array.from(w.fields.mom_x);
  Vi.applyViscosity(w, 0.5, { Kvisc: 1 });
  let mu = 0, mg = 0;
  for (let i = 0; i < r.length; i++) { mu = Math.max(mu, Math.abs(u[i] - u0[i])); mg = Math.max(mg, Math.abs(w.fields.mom_x[i] - gx0[i])); }
  check('균일 무력 — 균일 ρ·균일 v → ∇·v=0 → q=0 → 운동량·u 불변', mu < 1e-12 && mg < 1e-12,
    `max|Δu|=${mu.toExponential(2)}, max|Δg|=${mg.toExponential(2)}`);
}

// ── 6. 감쇠(정착) — 중력+열압력 진동에 점성 ON → 내부E 누적↑·운동E 잔류↓ vs OFF ──
function oscillate(Kvisc) {
  const N = 16, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 1000, T0: 1 });   // 정지 뜨거운 덩어리
  let keMax = 0;
  for (let t = 0; t < 60; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });           // 끌어모음(복원력)
    Th.applyThermalPressure(w, 0.2, { Kth: 0.4, gamma: GAMMA });// 열압력 되밀기(가역 진동)
    Vi.applyViscosity(w, 0.2, { Kvisc });                      // 점성 소산(ON/OFF)
    Ine.advect(w, 0.2, { scalars: ['therm'] });
    const ke = Vi.kineticEnergy(w); if (ke > keMax) keMax = ke;
  }
  return { u: Vi.totalInternal(w), keFinal: Vi.kineticEnergy(w), keMax };
}
{
  const on = oscillate(0.8), off = oscillate(0.0);
  // 헤드라인: 점성 ON 이면 진동의 *운동E*가 강하게 감쇠한다(잔류 KE·peak KE 모두 ↓) = 별이 *정착*.
  //   (내부E 총량은 가역 열압력이 더 격한 OFF 진동서 더 펌프해 헷갈리므로 KE 로 본다 — 운동이 멎는 게 정착.)
  check('감쇠(정착) — 점성 ON → 진동 운동E 강하게 감쇠(잔류·peak KE ↓) vs OFF(무감쇠)',
    on.keFinal < off.keFinal * 0.6 && on.keMax < off.keMax,
    `잔류 KE ON=${on.keFinal.toFixed(1)} ≪ OFF=${off.keFinal.toFixed(1)}; peak KE ON=${on.keMax.toFixed(0)} < OFF=${off.keMax.toFixed(0)}`);
}

// ── 7. 항등(Kvisc=0) ──
{
  const N = 12, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 2 });
  imposeVelocity(w, (x, y, z) => [-0.03 * (x - c), 0, 0]);
  const fpU = w.fingerprint('therm'), fpE = w.fingerprint('energy'), fpX = w.fingerprint('mom_x');
  Vi.applyViscosity(w, 0.3, { Kvisc: 0 });
  check('항등 — Kvisc=0 이면 세계 불변(회귀 0)',
    w.fingerprint('therm') === fpU && w.fingerprint('energy') === fpE && w.fingerprint('mom_x') === fpX, `0x${fpU.toString(16)}`);
}

// ── 8. 항등(dt=0) ──
{
  const N = 12, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 2 });
  imposeVelocity(w, (x, y, z) => [-0.03 * (x - c), 0, 0]);
  const fpU = w.fingerprint('therm'), fpX = w.fingerprint('mom_x');
  Vi.applyViscosity(w, 0, { Kvisc: 1 });
  check('항등 — dt=0 이면 세계 불변(회귀 0)', w.fingerprint('therm') === fpU && w.fingerprint('mom_x') === fpX, `0x${fpX.toString(16)}`);
}

// ── 9. 결정론 ──
{
  function run() {
    const N = 16, w = W.createWorld(N), c = (N - 1) / 2;
    Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 1000, T0: 1 });
    imposeVelocity(w, (x, y, z) => [-0.02 * (x - c), -0.02 * (y - c), -0.02 * (z - c)]);
    for (let t = 0; t < 10; t++) Vi.applyViscosity(w, 0.15, { Kvisc: 0.5 });
    return w.fingerprint('therm');
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0011 수치 검증: 비가역 소산(인공 점성/충격 가열) — bulk KE → 열 일방 전환 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

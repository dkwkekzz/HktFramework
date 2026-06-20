// step_0009/verify.js — 내부에너지(온도): 압축은 데우고 팽창은 식힌다(열역학 제1법칙)의 수치 검증. 순수·독립·영구.
//
//   step_0008 의 반발은 밀도만의 함수(차가운 축퇴압) — 열/온도 자유도가 없었다. 이 step 은 새 장 u(내부에너지
//   밀도, `therm`)와 압축 가열 법칙 du/dt = −γ·u·(∇·v) 를 더한다. 수렴 흐름(∇·v<0)은 데우고, 발산(∇·v>0)은
//   식힌다. 연속(dρ/ρ=−∇·v dt)과 짝지으면 **단열 관계 T=u/ρ ∝ ρ^(γ−1)** 가 나온다(이 step 의 핵심 결과).
//
//   검증 대상:
//     1. 정의       — 온도 T=u/ρ, 열압력 P_th=(γ−1)u(이상기체) 가 u 에 단조증가.
//     2. 압축은 데운다 — 수렴 속도장(∇·v<0): 중심 u(온도)가 *증가*.
//     3. 팽창은 식힌다 — 발산 속도장(∇·v>0): 중심 u 가 *감소*.
//     4. 균일 운동 무력 — 균일 속도(평행이동, ∇·v=0): u 불변(데우는 건 압축이지 운동이 아니다).
//     5. 단열 지수    — (Δu/u)/(∇·v·dt) = −γ 정확(기계 정밀도). 연속과의 비 = γ(단열 지수).
//     6. 단열 관계    — T∝ρ^(γ−1): 고정 속도장 압축을 연속과 lockstep → u/ρ^γ 불변(dt→0 수렴).
//     7. 항등(dt=0)   — dt=0 이면 세계 불변(회귀 0).
//     8. 법칙 직교    — applyHeating 은 energy·mom 장을 *건드리지 않는다*(수동 온도 → 기존 step 회귀 0).
//     9. 결정론       — 같은 흐름 → 동일 지문.
//
//   실행: node HTJ/steps/step_0009/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));

const GAMMA = 5 / 3;
const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 셀별로 v = (vfn(x,y,z)) 인 속도장을 운동량 g=ρv 로 싣는다(검증용 속도장 주입).
function imposeVelocity(w, vfn) {
  const N = w.N, rho = w.fields.energy;
  const gx = Th.MX, gy = Th.MY, gz = Th.MZ;
  for (const nm of [gx, gy, gz]) if (!w.fields[nm]) w.addField(nm, { type: Float64Array });
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x, r = rho[i];
    const [vx, vy, vz] = vfn(x, y, z);
    w.fields[gx][i] = r * vx; w.fields[gy][i] = r * vy; w.fields[gz][i] = r * vz;
  }
}

// ── 1. 정의 — T=u/ρ, P_th=(γ−1)u 단조 ──
{
  const w = W.createWorld(4), r = w.fields.energy, u = w.addField('therm', { type: Float64Array });
  r[0] = 2; u[0] = 6; r[1] = 4; u[1] = 6;     // 같은 u, 다른 ρ → T 다름; P_th 는 u 만의 함수
  const T = Th.temperature(w), P = Th.thermalPressure(w, { gamma: GAMMA });
  // T[0]=6/2=3, T[1]=6/4=1.5. P[0]=(2/3)·6=4, P[1]=4. P 단조: u 키우면 P↑.
  const okT = Math.abs(T[0] - 3) < 1e-12 && Math.abs(T[1] - 1.5) < 1e-12;
  const okP = Math.abs(P[0] - 4) < 1e-12 && Math.abs(P[1] - 4) < 1e-12;
  // 단조: u 두 배 → P 두 배.
  const w2 = W.createWorld(2); w2.fields.energy[0] = 1; w2.addField('therm')[0] = 10;
  const P2 = Th.thermalPressure(w2, { gamma: GAMMA });
  check('정의 — T=u/ρ, 열압력 P_th=(γ−1)u 이상기체·단조', okT && okP && P2[0] > P[0],
    `T(ρ2)=${T[0].toFixed(2)}, T(ρ4)=${T[1].toFixed(2)}; P_th((γ−1)·6)=${P[0].toFixed(2)}`);
}

// ── 2. 압축은 데운다 — 수렴 속도장(∇·v=−3α<0) → 중심 u↑ ──
{
  const N = 16, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  const alpha = 0.02;
  imposeVelocity(w, (x, y, z) => [-alpha * (x - c), -alpha * (y - c), -alpha * (z - c)]);  // 안으로 수렴
  const i = ((c | 0) * N + (c | 0)) * N + (c | 0);
  const u0 = w.fields.therm[i];
  Th.applyHeating(w, 0.5, { gamma: GAMMA });
  const u1 = w.fields.therm[i];
  check('압축은 데운다 — 수렴(∇·v<0) → 중심 u(온도)↑', u1 > u0,
    `u: ${u0.toFixed(3)} → ${u1.toFixed(3)} (Δ=${(u1 - u0).toExponential(2)} > 0)`);
}

// ── 3. 팽창은 식힌다 — 발산 속도장(∇·v=+3α>0) → 중심 u↓ ──
{
  const N = 16, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  const alpha = 0.02;
  imposeVelocity(w, (x, y, z) => [alpha * (x - c), alpha * (y - c), alpha * (z - c)]);     // 밖으로 발산
  const i = ((c | 0) * N + (c | 0)) * N + (c | 0);
  const u0 = w.fields.therm[i];
  Th.applyHeating(w, 0.5, { gamma: GAMMA });
  const u1 = w.fields.therm[i];
  check('팽창은 식힌다 — 발산(∇·v>0) → 중심 u(온도)↓', u1 < u0,
    `u: ${u0.toFixed(3)} → ${u1.toFixed(3)} (Δ=${(u1 - u0).toExponential(2)} < 0)`);
}

// ── 4. 균일 운동 무력 — 균일 속도(∇·v=0) → u 불변 ──
{
  const N = 16, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  imposeVelocity(w, () => [0.4, -0.2, 0.3]);     // 균일 평행이동
  const before = Float64Array.from(w.fields.therm);
  Th.applyHeating(w, 0.5, { gamma: GAMMA });
  let maxd = 0; for (let i = 0; i < before.length; i++) maxd = Math.max(maxd, Math.abs(w.fields.therm[i] - before[i]));
  check('균일 운동 무력 — 균일 속도(∇·v=0) → u 불변(데우는 건 압축)', maxd < 1e-12, `max|Δu| = ${maxd.toExponential(2)}`);
}

// ── 5. 단열 지수 — (Δu/u)/(∇·v·dt) = −γ 정확 ──
{
  const N = 16, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  const alpha = 0.02, dt = 0.5;
  imposeVelocity(w, (x, y, z) => [-alpha * (x - c), -alpha * (y - c), -alpha * (z - c)]);
  const i = ((c | 0) * N + (c | 0)) * N + (c | 0);
  const div = Th.divergence(w)[i];               // 중심 ∇·v = −3α
  const u0 = w.fields.therm[i];
  Th.applyHeating(w, dt, { gamma: GAMMA });
  const rel = (w.fields.therm[i] - u0) / u0;      // Δu/u = −γ·div·dt (정확)
  const expect = -GAMMA * div * dt;
  // 단열 지수: (Δu/u) ÷ (연속 Δρ/ρ = −div·dt) = γ.
  const index = rel / (-div * dt);
  check('단열 지수 — (Δu/u)/(∇·v·dt)=−γ 정확, 연속과의 비=γ', Math.abs(rel - expect) < 1e-12 && Math.abs(index - GAMMA) < 1e-12,
    `Δu/u=${rel.toExponential(3)} (기대 ${expect.toExponential(3)}); 단열지수 γ=${index.toFixed(6)}`);
}

// ── 6. 단열 관계 T∝ρ^(γ−1) — 고정 속도장 압축을 연속과 lockstep → u/ρ^γ 불변 ──
{
  const N = 16, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  const alpha = 0.02, dt = 0.02, n = 120;
  const i = ((c | 0) * N + (c | 0)) * N + (c | 0);
  const vfn = (x, y, z) => [-alpha * (x - c), -alpha * (y - c), -alpha * (z - c)];
  const rho = w.fields.energy, u = w.fields.therm;
  const inv0 = u[i] / Math.pow(rho[i], GAMMA), T0 = u[i] / rho[i], rho0 = rho[i];
  for (let t = 0; t < n; t++) {
    imposeVelocity(w, vfn);                       // 속도장 고정 재주입 → ∇·v 매 스텝 동일
    const div = Float64Array.from(Th.divergence(w));   // 가열 전 ∇·v 복사(applyHeating 이 scratch 덮어씀)
    Th.applyHeating(w, dt, { gamma: GAMMA });      // u ← u(1−γ·div·dt)
    for (let k = 0; k < rho.length; k++) rho[k] *= (1 - div[k] * dt);   // 연속(forward Euler), 같은 div
  }
  const inv1 = u[i] / Math.pow(rho[i], GAMMA), T1 = u[i] / rho[i];
  const drift = Math.abs(inv1 - inv0) / inv0;
  const Tpred = T0 * Math.pow(rho[i] / rho0, GAMMA - 1);   // 단열 예측 T∝ρ^(γ−1)
  check('단열 관계 — T∝ρ^(γ−1): u/ρ^γ 불변(연속과 lockstep)', drift < 1e-2,
    `u/ρ^γ drift=${drift.toExponential(2)}; T ${T0.toFixed(3)}→${T1.toFixed(3)}(예측 ${Tpred.toFixed(3)}), ρ ×${(rho[i] / rho0).toFixed(2)}`);
}

// ── 7. 항등(dt=0) ──
{
  const N = 12, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  imposeVelocity(w, (x, y, z) => [-0.02 * (x - c), 0, 0]);
  const fpU = w.fingerprint('therm'), fpE = w.fingerprint('energy'), fpX = w.fingerprint('mom_x');
  Th.applyHeating(w, 0, { gamma: GAMMA });
  check('항등 — dt=0 이면 세계 불변(회귀 0)',
    w.fingerprint('therm') === fpU && w.fingerprint('energy') === fpE && w.fingerprint('mom_x') === fpX, `0x${fpU.toString(16)}`);
}

// ── 8. 법칙 직교 — applyHeating 이 energy·mom 을 건드리지 않는다(수동 온도) ──
{
  const N = 14, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 1 });
  imposeVelocity(w, (x, y, z) => [-0.03 * (x - c), -0.03 * (y - c), -0.03 * (z - c)]);
  const fpE = w.fingerprint('energy'), fpX = w.fingerprint('mom_x'), fpY = w.fingerprint('mom_y');
  for (let t = 0; t < 5; t++) Th.applyHeating(w, 0.3, { gamma: GAMMA });
  check('법칙 직교 — applyHeating 은 energy·mom 불변(기존 step 회귀 0)',
    w.fingerprint('energy') === fpE && w.fingerprint('mom_x') === fpX && w.fingerprint('mom_y') === fpY,
    `energy 0x${fpE.toString(16)} 불변`);
}

// ── 9. 결정론 ──
{
  function run() {
    const N = 16, w = W.createWorld(N), c = (N - 1) / 2;
    Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 1000, T0: 1 });
    imposeVelocity(w, (x, y, z) => [-0.02 * (x - c), -0.02 * (y - c), -0.02 * (z - c)]);
    for (let t = 0; t < 10; t++) Th.applyHeating(w, 0.2, { gamma: GAMMA });
    return w.fingerprint('therm');
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0009 수치 검증: 내부에너지(온도) — 압축은 데우고 팽창은 식힌다(열역학 제1법칙) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

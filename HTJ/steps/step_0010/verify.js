// step_0010/verify.js — 열압력 되먹임(능동 압력): KE↔내부E 가역 교환의 수치 검증. 순수·독립·영구.
//
//   step_0009 의 온도는 *수동*(측정만). 이 step 은 열압력 P_th=Kth·(γ−1)·u 의 기울기로 운동량을 *되밀고*
//   (g ← g − dt·∇P_th) 그 한 일을 내부에너지로 되돌린다(u ← u − dt·P_th·∇·v, PdV). 둘이 짝지어
//   **KE↔내부E 가역 교환**(총E=KE+u 보존). 이로써 step_0007 의 "사라진 에너지" 장부가 닫힌다 — 붕괴
//   운동E가 *열로 회계*된다(사라지는 게 아니라 형태 변환). 단 *가역*(단열)이라 진동을 **감쇠하진 않는다**
//   (정착엔 비가역 소산 필요 — 다음 step).
//
//   검증 대상:
//     1. 능동 정의   — P_th=Kth·(γ−1)u, 뜨거운(=u 큰) 덩어리가 *바깥으로* 밀린다(인력의 거울상).
//     2. 균일 무력   — 균일 u·ρ → ∇P=0, ∇·v=0 → 운동량·u 불변.
//     3. 운동량 보존 — 주기 중심차분 → Σ∇P=0 → ΣΔg 정확 보존(내부 힘, 뉴턴 3법칙).
//     4. KE↔내부E 보존 — push-only: 정지 비균일 u → 열이 운동을 만든다(u→KE). 총E=KE+u 표류 작고
//        dt 절반 → 표류 절반(1차 수렴). 핵심 결과(에너지 장부가 닫힘).
//     5. 가역 방향   — 팽창(발산)은 식히고(u↓·KE↑), 압축(수렴)은 데운다(u↑). PdV 부호.
//     6. 항등(Kth=0) — 결합 0 이면 세계 불변(회귀 0).
//     7. 항등(dt=0)  — dt=0 이면 세계 불변(회귀 0).
//     8. 결정론      — 같은 흐름 → 동일 지문.
//
//   실행: node HTJ/steps/step_0010/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));

const GAMMA = 5 / 3;
const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
function imposeVelocity(w, vfn) {
  const N = w.N, rho = w.fields.energy;
  for (const nm of [Th.MX, Th.MY, Th.MZ]) if (!w.fields[nm]) w.addField(nm, { type: Float64Array });
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x, r = rho[i], [vx, vy, vz] = vfn(x, y, z);
    w.fields[Th.MX][i] = r * vx; w.fields[Th.MY][i] = r * vy; w.fields[Th.MZ][i] = r * vz;
  }
}

// ── 1. 능동 정의 — 뜨거운 덩어리가 바깥으로 밀린다 ──
{
  const N = 16, c = (N - 1) / 2, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 2 });   // 가운데 뜨거운(u 큰) 덩어리, 정지
  Th.applyThermalPressure(w, 0.2, { Kth: 0.05, gamma: GAMMA });
  const gx = w.fields.mom_x; let left = 0, right = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = gx[(z * N + y) * N + x]; if (x < c) left += v; else if (x > c) right += v;
  }
  check('능동 정의 — 뜨거운 덩어리가 바깥으로 밀린다(열압력 P=Kth(γ−1)u)', left < 0 && right > 0,
    `왼 Σgx=${left.toExponential(2)} (<0), 오 Σgx=${right.toExponential(2)} (>0)`);
}

// ── 2. 균일 무력 ──
{
  const N = 10, w = W.createWorld(N), r = w.fields.energy, u = w.addField('therm');
  for (let i = 0; i < r.length; i++) { r[i] = 5; u[i] = 10; }   // 균일 ρ·u
  for (const nm of [Th.MX, Th.MY, Th.MZ]) w.addField(nm);
  const u0 = Float64Array.from(u);
  Th.applyThermalPressure(w, 0.5, { Kth: 1, gamma: GAMMA });
  let mg = 0, mu = 0;
  for (let i = 0; i < r.length; i++) { mg = Math.max(mg, Math.abs(w.fields.mom_x[i])); mu = Math.max(mu, Math.abs(u[i] - u0[i])); }
  check('균일 무력 — 균일 u·ρ → ∇P=0·∇·v=0 → 운동량·u 불변', mg < 1e-12 && mu < 1e-12, `max|g|=${mg.toExponential(2)}, max|Δu|=${mu.toExponential(2)}`);
}

// ── 3. 운동량 보존 ──
{
  const N = 16, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 2 });
  for (let t = 0; t < 5; t++) Th.applyThermalPressure(w, 0.1, { Kth: 0.05, gamma: GAMMA });
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < w.fields.mom_x.length; i++) { sx += w.fields.mom_x[i]; sy += w.fields.mom_y[i]; sz += w.fields.mom_z[i]; }
  check('운동량 보존 — 주기 중심차분 → Σ∇P=0 → ΣΔg 정확 보존', Math.hypot(sx, sy, sz) < 1e-9, `|Σg| = ${Math.hypot(sx, sy, sz).toExponential(2)}`);
}

// ── 4. KE↔내부E 보존 (핵심) — push-only, dt 수렴 ──
function exchange(dt, n) {
  const N = 16, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 1000, T0: 2 });   // 정지, 비균일 u
  const E0 = Th.kineticEnergy(w) + Th.totalInternal(w);
  for (let t = 0; t < n; t++) Th.applyThermalPressure(w, dt, { Kth: 1, gamma: GAMMA });
  const KE = Th.kineticEnergy(w), u = Th.totalInternal(w);
  return { KE, u, E0, E1: KE + u, drift: Math.abs(KE + u - E0) / E0 };
}
{
  const a = exchange(0.05, 80), b = exchange(0.025, 160);
  const ratio = a.drift / b.drift;
  // 열이 운동을 만들었다(KE 0→큰 값, u 줄어듦) + 총E 표류 작고 dt 절반 → 표류 ~절반(1차 수렴).
  check('KE↔내부E 보존 — 열이 운동을 만들고(u→KE) 총E 보존·1차 수렴', a.KE > 100 && a.u < a.E0 && a.drift < 0.03 && ratio > 1.5,
    `KE 0→${a.KE.toFixed(0)}, u ${a.E0.toFixed(0)}→${a.u.toFixed(0)}; 표류 ${(a.drift * 100).toFixed(2)}%→${(b.drift * 100).toFixed(2)}%(dt½, 비율 ${ratio.toFixed(2)})`);
}

// ── 5. 가역 방향 — 팽창은 식히고, 압축은 데운다 ──
{
  // (a) 정지 뜨거운 덩어리 → 자기 열압력으로 팽창 → u↓·KE↑.
  const N = 16, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 1000, T0: 2 });
  const u0 = Th.totalInternal(w);
  for (let t = 0; t < 20; t++) Th.applyThermalPressure(w, 0.1, { Kth: 0.5, gamma: GAMMA });
  const expandCools = Th.totalInternal(w) < u0 && Th.kineticEnergy(w) > 0;
  // (b) 수렴 속도장 주입(압축) → PdV 가 u 를 올린다(KE→u).
  const w2 = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w2, { sigma: N * 0.18, M0: 1000, T0: 2 });
  imposeVelocity(w2, (x, y, z) => [-0.03 * (x - c), -0.03 * (y - c), -0.03 * (z - c)]);
  const i = ((c | 0) * N + (c | 0)) * N + (c | 0), uc0 = w2.fields.therm[i];
  Th.applyThermalPressure(w2, 0.3, { Kth: 0.5, gamma: GAMMA });
  const compressHeats = w2.fields.therm[i] > uc0;
  check('가역 방향 — 팽창은 식히고(u↓·KE↑), 압축은 데운다(u↑)', expandCools && compressHeats,
    `팽창 u ${u0.toFixed(0)}→${Th.totalInternal(w).toFixed(0)}; 압축 코어 u ${uc0.toFixed(2)}→${w2.fields.therm[i].toFixed(2)}`);
}

// ── 6. 항등(Kth=0) ──
{
  const N = 12, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 2 });
  imposeVelocity(w, (x, y, z) => [-0.02 * (x - c), 0, 0]);
  const fpU = w.fingerprint('therm'), fpE = w.fingerprint('energy'), fpX = w.fingerprint('mom_x');
  Th.applyThermalPressure(w, 0.3, { Kth: 0, gamma: GAMMA });
  check('항등 — Kth=0 이면 세계 불변(회귀 0)',
    w.fingerprint('therm') === fpU && w.fingerprint('energy') === fpE && w.fingerprint('mom_x') === fpX, `0x${fpU.toString(16)}`);
}

// ── 7. 항등(dt=0) ──
{
  const N = 12, w = W.createWorld(N), c = (N - 1) / 2;
  Th.seedWarmBlob(w, { sigma: N * 0.18, M0: 1000, T0: 2 });
  imposeVelocity(w, (x, y, z) => [-0.02 * (x - c), 0, 0]);
  const fpU = w.fingerprint('therm'), fpX = w.fingerprint('mom_x');
  Th.applyThermalPressure(w, 0, { Kth: 1, gamma: GAMMA });
  check('항등 — dt=0 이면 세계 불변(회귀 0)', w.fingerprint('therm') === fpU && w.fingerprint('mom_x') === fpX, `0x${fpX.toString(16)}`);
}

// ── 8. 결정론 ──
{
  function run() {
    const N = 16, w = W.createWorld(N);
    Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 1000, T0: 2 });
    for (let t = 0; t < 10; t++) Th.applyThermalPressure(w, 0.1, { Kth: 0.3, gamma: GAMMA });
    return w.fingerprint('mom_x');
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0010 수치 검증: 열압력 되먹임(능동 압력) — KE↔내부E 가역 교환 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

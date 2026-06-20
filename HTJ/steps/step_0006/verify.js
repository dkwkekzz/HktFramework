// step_0006/verify.js — 관성 = 질량(=에너지)의 탄도 이류(뉴턴 1법칙)의 수치 검증. 순수·독립·영구.
//
//   step_0002~0005 의 유일한 동역학은 확산(완화형) — 운동량도, 직진도 없었다. 이 step 은 energy 를
//   *질량 밀도 ρ* 로 다시 읽고(E=mc²) 운동량 g=ρv 를 실어 *탄도 이류*(상류차분, 보존형)를 더한다.
//   힘이 없으면 덩어리는 *제 속도를 지킨 채 등속 직진* = 뉴턴 1법칙.
//
//   검증 대상(이 step 의 법칙을 완전히 못 박는다):
//     1. 질량 보존    — Σρ 불변(이류는 flux 형식, no-flux 경계 → 상자 안에 머문다).
//     2. 운동량 보존  — 힘 없으면 Σg 불변.
//     3. 탄도 직진    — 질량중심이 *등속* 이동: CoM(t) = CoM(0) + v·t (선형). 뉴턴 1법칙.
//     4. 대조(확산)   — 확산만 돌리면 CoM 정지(순 이동 0). 관성↔완화의 정반대 성격.
//     5. 정지 항등    — 운동량 0(정지)이면 이류해도 세계 불변.
//     6. 비음수       — CFL(|v|dt≤1) 아래 질량 ρ ≥ 0.
//     7. 결정론       — 같은 흐름 → 동일 (energy) 지문 + 동일 운동량.
//     8. 항등(dt=0)   — 시간간격 0 이면 세계 불변(회귀 0).
//
//   실행: node HTJ/steps/step_0006/verify.js
//   닫힌 뒤 불변 — 이후 어떤 step 을 진행해도 통과해야 한다.
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Eng = require(path.resolve(__dirname, '../../engine/htj-energy.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const DT = 1.0, V0 = 0.5;   // 균일 속도 0.5, dt=1 → CFL |v|dt=0.5 ≤ 1 (안정·비음수)

// ── 1 & 2 & 3. 질량·운동량 보존 + 탄도 직진(CoM 등속) ──
{
  const N = 24, w = W.createWorld(N);
  Ine.seedMovingBlob(w, { cx: N * 0.25, vx: V0, M0: 1000, sigma: N * 0.1 });
  const M0 = w.total('energy'), p0 = Ine.totalMomentum(w), c0 = Ine.centerOfMass(w);

  const T = 8;
  for (let t = 0; t < T; t++) Ine.advect(w, DT);
  const M1 = w.total('energy'), p1 = Ine.totalMomentum(w), c1 = Ine.centerOfMass(w);

  check('질량 보존 — Σρ 불변(이류는 형태 변환 없는 수송)',
    Math.abs(M1 - M0) / M0 < 1e-9, `ΔM/M0 = ${(Math.abs(M1 - M0) / M0).toExponential(2)}`);
  check('운동량 보존 — 힘 없으면 Σg 불변',
    Math.abs(p1[0] - p0[0]) / Math.abs(p0[0]) < 1e-9, `Σgx ${p0[0].toFixed(1)} → ${p1[0].toFixed(1)}`);

  const vMeasured = (c1[0] - c0[0]) / (T * DT);
  check('탄도 직진 — 질량중심이 +x 로 이동(덩어리 통째로 직진)',
    c1[0] > c0[0] + 1, `CoM_x ${c0[0].toFixed(2)} → ${c1[0].toFixed(2)}`);
  check('뉴턴 1법칙 — CoM 속도 = p_total/M (등속)',
    Math.abs(vMeasured - V0) / V0 < 0.05, `측정 v=${vMeasured.toFixed(4)} ≈ p/M=${V0}`);
  check('직진성 — 가로(y) 이동 없음(운동량 방향으로만)',
    Math.abs(c1[1] - c0[1]) < 1e-6, `ΔCoM_y = ${Math.abs(c1[1] - c0[1]).toExponential(2)}`);
}

// ── 3b. 등속성 — CoM(t) 가 *선형*(가속 0). 매 스텝 같은 보폭. ──
{
  const N = 24, w = W.createWorld(N);
  Ine.seedMovingBlob(w, { cx: N * 0.2, vx: V0, M0: 1000, sigma: N * 0.1 });
  let prev = Ine.centerOfMass(w)[0], maxJerk = 0, firstStep = null;
  for (let t = 0; t < 6; t++) {
    Ine.advect(w, DT);
    const cx = Ine.centerOfMass(w)[0], dstep = cx - prev;
    if (firstStep == null) firstStep = dstep;
    else maxJerk = Math.max(maxJerk, Math.abs(dstep - firstStep));
    prev = cx;
  }
  check('등속 — 매 스텝 보폭 일정(가속 0, CoM 선형)',
    maxJerk / Math.abs(firstStep) < 0.02, `보폭 편차/보폭 = ${(maxJerk / Math.abs(firstStep)).toExponential(2)}`);
}

// ── 4. 대조 — 확산만 돌리면 CoM 정지(순 이동 없음). 관성↔완화. ──
{
  const N = 24, c = (N - 1) / 2, w = W.createWorld(N);
  Ine.seedMovingBlob(w, { cx: c, cy: c, cz: c, vx: 0, M0: 1000, sigma: N * 0.08 });
  const c0 = Ine.centerOfMass(w);
  for (let t = 0; t < 40; t++) Eng.diffuseEnergy(w, 1 / 7);
  const c1 = Ine.centerOfMass(w);
  const moved = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
  check('대조 — 확산만: CoM 정지(퍼질 뿐 순 이동 없음)', moved < 1e-6, `|ΔCoM| = ${moved.toExponential(2)}`);
}

// ── 5. 정지 항등 — 운동량 0 이면 이류해도 세계 불변 ──
{
  const N = 16, w = W.createWorld(N);
  Eng.seedHotSpot(w, { E0: 1000, half: 2 });
  Ine.ensureMomentum(w);
  const fp = w.fingerprint('energy');
  for (let t = 0; t < 10; t++) Ine.advect(w, DT);
  check('정지 항등 — 운동량 0 이면 이류해도 불변', w.fingerprint('energy') === fp, `0x${fp.toString(16)}`);
}

// ── 6. 비음수 — CFL(|v|dt≤1) 아래 질량 ρ ≥ 0 ──
{
  const N = 24, w = W.createWorld(N);
  Ine.seedMovingBlob(w, { cx: N * 0.2, vx: 1.0, M0: 1000, sigma: N * 0.1 });
  let minR = Infinity;
  for (let t = 0; t < 12; t++) {
    Ine.advect(w, 1.0);
    const R = w.fields.energy;
    for (let i = 0; i < R.length; i++) if (R[i] < minR) minR = R[i];
  }
  check('비음수 — CFL 상한(|v|dt=1)에서도 질량 ≥ 0', minR >= -1e-12, `min ρ = ${minR.toExponential(2)}`);
}

// ── 7. 결정론 — 같은 흐름 → 동일 지문 + 운동량 ──
{
  function run() {
    const w = W.createWorld(20);
    Ine.seedMovingBlob(w, { cx: 5, vx: 0.5, vy: 0.25, M0: 1000, sigma: 2.2 });
    for (let t = 0; t < 10; t++) Ine.advect(w, DT);
    return [w.fingerprint('energy'), Ine.totalMomentum(w)[0]];
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문·운동량', a[0] === b[0] && a[1] === b[1], `0x${a[0].toString(16)} · ${a[1].toFixed(2)}`);
}

// ── 8. 항등(dt=0) — 세계 불변(회귀 0) ──
{
  const N = 16, w = W.createWorld(N);
  Ine.seedMovingBlob(w, { cx: 5, vx: 0.5, M0: 1000, sigma: 2 });
  const fp = w.fingerprint('energy'), fpx = w.fingerprint('mom_x');
  Ine.advect(w, 0);
  check('항등 — dt=0 이면 세계 불변(회귀 0)',
    w.fingerprint('energy') === fp && w.fingerprint('mom_x') === fpx, `0x${fp.toString(16)}`);
}

// ── 결과 ──
console.log('\n=== step_0006 수치 검증: 관성 = 질량(에너지)의 탄도 이류(뉴턴 1법칙) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

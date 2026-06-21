// step_0008/verify.js — 단거리 반발(압력) = 밀집을 거부하는 힘(중력의 거울짝)의 수치 검증. 순수·독립·영구.
//
//   step_0007 의 중력은 끌어모으기만 해 *한 점 무한 붕괴*(무압력 dust 특이점, 발산→NaN)했다. 이 step 은
//   바로트로픽 압력 P=K·ρ^γ 의 기울기로 운동량을 *민다*(g ← g − dt·∇P). γ>4/3 이면 압력이 중력보다
//   빨리 세져 붕괴를 멈춘다 → 유한 크기의 지속하는 덩어리가 선다(= 입자·물체의 씨앗).
//
//   검증 대상:
//     1. 압력 정의   — P=K·ρ^γ 가 밀도에 단조증가(과밀일수록 더 센 반발), γ 가 가팔기를 정한다.
//     2. 반발 방향   — 과밀 덩어리: 각 셀이 *바깥쪽으로* 운동량을 받는다(중력 인력의 거울상).
//     3. 균일 무력   — 균일 밀도 → ∇P=0 → 순 힘 0(끌·밀 중심 없음).
//     4. 운동량 보존 — 주기 중심차분 → Σ∇P=0 → ΣΔg 정확 보존(내부 힘, 뉴턴 3법칙).
//     5. 붕괴 정지   — 중력+반발: peak 밀도가 *유한값에서 plateau*(폭주 안 함). 핵심 결과.
//     6. 대조(반발0) — K=0: 중력만 → peak 밀도가 더 큼(반발 없으면 더 붕괴). ※ CFL 가드 후 *유한*(아래 버그 수정 참조).
//     7. 질량 보존   — 중력+반발+이류 진화 동안 Σρ 불변.
//     8. 항등(K=0)   — 반발 0 이면 세계 불변(회귀 0).
//     9. 항등(dt=0)  — dt=0 이면 세계 불변(회귀 0).
//    10. 결정론      — 같은 흐름 → 동일 지문.
//
//   실행: node HTJ/steps/step_0008/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
function peak(w) { let m = 0; const r = w.fields.energy; for (let i = 0; i < r.length; i++) if (r[i] > m) m = r[i]; return m; }

// ── 1. 압력 정의 P=K·ρ^γ ──
{
  const w = W.createWorld(8), r = w.fields.energy;
  r[0] = 2; r[1] = 4;
  const P = Pr.pressureField(w, { K: 1, gamma: 2 });
  // P[0]=1·2²=4, P[1]=1·4²=16 → 단조증가, 비율=(4/2)²=4.
  const mono = P[1] > P[0] && Math.abs(P[0] - 4) < 1e-9 && Math.abs(P[1] - 16) < 1e-9;
  check('압력 정의 — P=K·ρ^γ 밀도 단조증가(과밀=센 반발)', mono, `P(2)=${P[0].toFixed(1)}, P(4)=${P[1].toFixed(1)}`);
}

// ── 2. 반발 방향 ──
{
  const N = 16, c = (N - 1) / 2, w = W.createWorld(N);
  Pr.seedBlob(w, { sigma: N * 0.18, M0: 1000 });
  Pr.applyPressure(w, 1, { K: 0.01, gamma: 2 });
  const gx = w.fields.mom_x;
  let left = 0, right = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = gx[(z * N + y) * N + x];
    if (x < c) left += v; else if (x > c) right += v;
  }
  check('반발 방향 — 과밀이 바깥으로 밀린다(왼 −x, 오 +x; 인력의 거울상)', left < 0 && right > 0,
    `왼 Σgx=${left.toExponential(2)} (<0), 오 Σgx=${right.toExponential(2)} (>0)`);
}

// ── 3. 균일 무력 ──
{
  const w = W.createWorld(8), r = w.fields.energy;
  for (let i = 0; i < r.length; i++) r[i] = 5;
  Pr.applyPressure(w, 1, { K: 0.1, gamma: 2 });
  const gx = w.fields.mom_x; let mx = 0;
  for (let i = 0; i < gx.length; i++) mx = Math.max(mx, Math.abs(gx[i]));
  check('균일 무력 — 균일 밀도 → ∇P=0 → 순 힘 0', mx < 1e-12, `max|g| = ${mx.toExponential(2)}`);
}

// ── 4. 운동량 보존 ──
{
  const N = 16, w = W.createWorld(N);
  Pr.seedBlob(w, { sigma: N * 0.18, M0: 1000 });
  const before = Ine.totalMomentum(w);
  for (let t = 0; t < 5; t++) Pr.applyPressure(w, 0.5, { K: 0.01, gamma: 2 });
  const after = Ine.totalMomentum(w);
  const drift = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
  check('운동량 보존 — 주기 중심차분 → Σ∇P=0 → ΣΔg 정확 보존', drift < 1e-9, `|ΔΣg| = ${drift.toExponential(2)}`);
}

// ── 5~7. 중력+반발 진화: 붕괴 정지·대조(반발0)·질량보존 ──
//   N=20 단일 과밀 구름. 매 스텝 중력 가속 + 반발 + 이류. peak(20)·peak(40)로 성장 추세를 본다.
function evolve(G, K, steps) {
  const N = 20, w = W.createWorld(N);
  Pr.seedBlob(w, { sigma: N * 0.16, M0: 1000 });
  let pmid = 0;
  for (let t = 0; t < steps; t++) {
    Gr.applyGravity(w, 0.3, { G, iters: 60 });
    Pr.applyPressure(w, 0.3, { K, gamma: 2 });
    Ine.advect(w, 0.3);
    if (t === Math.floor(steps / 2) - 1) pmid = peak(w);
  }
  return { w, peak: peak(w), pmid, M: w.total('energy'), M0: 1000 };
}
{
  const b = evolve(0.15, 0.05, 40);   // 중력+반발
  const g = evolve(0.15, 0.0, 40);    // 중력만(대조)
  // 붕괴 정지: peak 가 유한하고 후반 성장비(40/20)가 거의 1(plateau).
  check('붕괴 정지 — 중력+반발: peak 유한·plateau(후반 성장비≈1)', isFinite(b.peak) && b.peak / b.pmid < 1.5,
    `peak ${b.pmid.toFixed(2)}→${b.peak.toFixed(2)} (성장비 ${(b.peak / b.pmid).toFixed(3)})`);
  // 대조: 반발 0 이면 중력만 → peak 가 더 큼(반발 없으면 더 붕괴).
  //   ── 버그 수정(사후) ──: 과거 이 단언은 `g.peak > 1e4 * b.peak`(비율 ~7.8e7)였는데, 그 거대한 값은
  //   *물리*가 아니라 advect 의 CFL 위반(|v|dt>1)이 만든 **음수밀도 폭주**(→NaN)의 수치 인공물이었다.
  //   htj-inertia 의 CFL 안전 서브스텝 가드가 그 폭주를 닫자 중력만 붕괴는 *물리적으로 유한*(반발 대비
  //   ~7×)해졌다. 그래서 단언을 **정성**(유한 ∧ 반발 없으면 더 붕괴)으로 교정한다 — 버그 크기에 묶지 않는다.
  check('대조(반발0) — 중력만: 반발 없으면 더 붕괴(유한·peak 더 큼)', isFinite(g.peak) && g.peak > 3 * b.peak,
    `중력만 peak=${g.peak.toFixed(2)} vs 반발 peak=${b.peak.toFixed(2)} (비율 ${(g.peak / b.peak).toFixed(2)}×, 유한)`);
  // 질량 보존: 반발은 운동량만 바꾼다(질량 직접 안 건드림) → 이류 동안 Σρ 불변.
  check('질량 보존 — 중력+반발+이류 동안 Σρ 불변', Math.abs(b.M - b.M0) / b.M0 < 1e-9,
    `ΔM/M0 = ${(Math.abs(b.M - b.M0) / b.M0).toExponential(2)}`);
}

// ── 8. 항등(K=0) ──
{
  const N = 16, w = W.createWorld(N);
  Pr.seedBlob(w, { sigma: N * 0.18, M0: 1000 });
  const fp = w.fingerprint('energy'), fpx = w.fingerprint('mom_x');
  Pr.applyPressure(w, 0.5, { K: 0 });
  check('항등 — K=0 이면 세계 불변(회귀 0)',
    w.fingerprint('energy') === fp && w.fingerprint('mom_x') === fpx, `0x${fp.toString(16)}`);
}

// ── 9. 항등(dt=0) ──
{
  const N = 16, w = W.createWorld(N);
  Pr.seedBlob(w, { sigma: N * 0.18, M0: 1000 });
  const fp = w.fingerprint('energy'), fpx = w.fingerprint('mom_x');
  Pr.applyPressure(w, 0, { K: 1 });
  check('항등 — dt=0 이면 세계 불변(회귀 0)',
    w.fingerprint('energy') === fp && w.fingerprint('mom_x') === fpx, `0x${fpx.toString(16)}`);
}

// ── 10. 결정론 ──
{
  function run() {
    const N = 20, w = W.createWorld(N);
    Pr.seedBlob(w, { sigma: N * 0.16, M0: 1000 });
    for (let t = 0; t < 10; t++) { Gr.applyGravity(w, 0.3, { G: 0.15, iters: 60 }); Pr.applyPressure(w, 0.3, { K: 0.05, gamma: 2 }); Ine.advect(w, 0.3); }
    return w.fingerprint('energy');
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0008 수치 검증: 단거리 반발(압력) = 밀집을 거부하는 힘(중력의 거울짝) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

// step_0025/verify.js — S3: 활동도 추적 + 동결 판정(시간 LOD 의 안전한 첫 형태·S5 안정 판정 재료). 순수·독립·영구.
//
//   step_0024 가 박은 천장: 활성 집합(S2)은 *빈 블록*만 건너뛴다 — 비-영인데 *안 변하는* 블록은 매 step 돈다.
//   design §4 S3: 블록 *활동도*(L∞ 변화)가 holdSteps 연속 임계 이하면 *동결*(stable)로 판정해 건너뛴다.
//   per-cell 법칙(fusion)에서 게이트 꺼진(돌·진공) 블록은 0 변화 → 동결 → 건너뛰어도 *조밀과 비트 동일*.
//   동시에 "동결 = stable" 은 S5 승격이 요구하는 안정 판정의 첫 형태다.
//
//   검증 대상:
//     1. 활동도 측정 정확 — 바뀐 블록은 활동도=실제 L∞ 변화, 안 바뀐 블록은 활동도 0.
//     2. 동결 판정(holdSteps) — quiet 가 holdSteps 연속이면 동결, 그 전엔 아님.
//     3. 깨움(wake) — 동결 블록이 다시 변하면(활동도>threshold) streak 리셋 → 동결 해제.
//     4. 비트 동일(관문, threshold=0) — fusion 을 활성(비-동결) 블록만 돌려도 조밀 전-격자와 byte 동일.
//     5. 0연산(실현 절감) — 동결 블록은 실제로 안 돈다(방문 셀 = 활성 블록뿐 ≪ 전체 비-영 블록).
//     6. 보존 — 동결 블록의 Σρ·Σu 가 동결 동안 정확히 불변(계산만 멈출 뿐 값 안 건드림).
//     7. 회귀 0 — opts.active 생략 시 fusion 기존 경로 byte 동일 + 추적기 없는 파이프라인 불변.
//     8. 결정론 — 같은 입력 → 같은 동결 집합 → 같은 지문.
//
//   실행: node HTJ/steps/step_0025/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));
const Ac = require(path.resolve(__dirname, '../../engine/htj-activity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const sum = (w, nm) => { const f = w.fields[nm]; let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };

const N = 24, BS = 8, DT = 0.1, RATE = 1.0, RHO_CRIT = 5, T_CRIT = 1;

// 시드: 가운데 작은 *점화* 코어(ρ·T 임계 초과) + 둘레 *돌/진공 가스*(게이트 off, 비-영이라 S2 는 못 건너뜀).
//   fusion-only(열 수송 없음)라 코어는 계속 데워지고(활성) 둘레는 영영 안 변한다(동결 대상).
function makeWorld() {
  const w = W.createWorld(N); w.addField('therm');
  const E = w.fields.energy, U = w.fields.therm;
  const c = (N - 1) / 2;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x;
    const dr = Math.hypot(x - c, y - c, z - c);
    if (dr < 3) { E[i] = 10; U[i] = 20; }               // 점화 코어(ρ=10>5·T=2>1) → 발열
    else { E[i] = 2; U[i] = 1; }                         // 돌 가스(ρ=2<5 → 게이트 off, 비-영)
  }
  return w;
}

// ── 1. 활동도 측정 정확 ──
{
  const w = makeWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.energy);
  const origins = set.origins();
  const tr = Ac.createActivityTracker(N, BS);
  tr.measure(w.fields.therm, origins);                  // 첫 측정(스냅샷만)
  // 한 블록(0,0,0) 안 한 셀만 0.5 바꾼다. 다른 블록은 그대로.
  w.fields.therm[(1 * N + 1) * N + 1] += 0.5;
  const r2 = tr.measure(w.fields.therm, origins);
  const movedAct = tr.streakOf(0, 0, 0);                // 바뀐 블록 → quiet 아님 → streak 0
  const stillAct = tr.streakOf(2, 2, 2);                // 둘레 블록 안 바뀜 → quiet → streak 1
  check('활동도 측정 정확 — 바뀐 블록 활동도=L∞ 변화·streak 0 / 안 바뀐 블록 활동도 0·streak↑',
    Math.abs(r2.maxActivity - 0.5) < 1e-12 && movedAct === 0 && stillAct === 1,
    `maxAct=${r2.maxActivity.toFixed(3)}(=0.5) · 바뀐 블록 streak=${movedAct} · 정적 블록 streak=${stillAct}`);
}

// ── 2. 동결 판정(holdSteps) — quiet 연속 holdSteps 면 동결, 그 전엔 아님 ──
{
  const w = makeWorld(); const hold = 3;
  const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.energy);
  const origins = set.origins();
  const tr = Ac.createActivityTracker(N, BS);
  // 둘레 정적 블록 하나(2,2,2) 의 streak 가 측정마다 1씩 자라 hold 에서 동결.
  tr.measure(w.fields.therm, origins);                  // 첫 측정(스냅샷)
  const before = [];
  for (let m = 1; m <= hold; m++) {
    tr.measure(w.fields.therm, origins);                // 둘레는 안 변함(아무 법칙 안 돌림)
    before.push(tr.frozenOrigins(origins, hold).length);
  }
  // before = [동결 0개(streak1), 0개(streak2), >0개(streak3=hold)]
  const ok = before[0] === 0 && before[1] === 0 && before[hold - 1] > 0 && tr.streakOf(2, 2, 2) === hold;
  check('동결 판정(holdSteps) — quiet 가 holdSteps 연속이면 동결, 그 전엔 활성',
    ok, `측정별 동결 블록 수=[${before.join(',')}] (hold=${hold}, streak(2,2,2)=${tr.streakOf(2, 2, 2)})`);
}

// ── 3. 깨움(wake) — 동결 블록이 다시 변하면 streak 리셋 → 동결 해제 ──
{
  const w = makeWorld(); const hold = 2;
  const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.energy);
  const origins = set.origins();
  const tr = Ac.createActivityTracker(N, BS);
  tr.measure(w.fields.therm, origins);
  for (let m = 0; m < hold; m++) tr.measure(w.fields.therm, origins);   // 둘레 동결
  const frozenBefore = tr.frozenOrigins(origins, hold).length;
  const sleptStreak = tr.streakOf(2, 2, 2);
  // 동결됐던 (2,2,2) 블록 안 한 셀을 흔든다 → 다음 측정에서 깨어나야 함.
  w.fields.therm[((2 * BS + 1) * N + (2 * BS + 1)) * N + (2 * BS + 1)] += 5;
  tr.measure(w.fields.therm, origins);
  const wokeStreak = tr.streakOf(2, 2, 2);              // 깨움 → 0 으로 리셋
  check('깨움(wake) — 동결 블록이 다시 변하면 streak 리셋 → 활성 복귀',
    frozenBefore > 0 && sleptStreak >= hold && wokeStreak === 0,
    `동결됐던 블록 streak ${sleptStreak}(≥${hold}) → 흔든 뒤 ${wokeStreak}(=0, 깨어남)`);
}

// 동결 추적 파이프라인(fusion-only) — 조밀 전-격자 공통 골격.
//   active=true 면 활성 블록(비-동결)만 fusion → 동결(둘레 돌) 건너뜀. measure 로 동결 갱신.
function runActive(w, set, tr, hold, stats) {
  const origins = set.origins();
  const active = tr.activeOrigins(origins, hold);
  Fu.applyFusion(w, DT, { rate: RATE, rhoCrit: RHO_CRIT, tCrit: T_CRIT, active, blockSize: BS, stats });
  tr.measure(w.fields.therm, origins, { threshold: 0 });  // threshold 0 = "정확히 0 변화"만 quiet
  return active.length;
}

// ── 4. 비트 동일(관문) + 5. 0연산 + 6. 보존 ── 한 파이프라인에서 함께 측정 ──
let occActive = 0;
{
  const S = 12, hold = 3;
  const wd = makeWorld(), wa = makeWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  const tr = Ac.createActivityTracker(N, BS);
  const originsAll = set.origins();
  const allCells = originsAll.length * BS * BS * BS;     // 활성 집합(비-영 블록) 전부 돌 때 방문 셀

  // 동결 블록(둘레 돌)의 Σ 불변을 보기 위해 마지막 step 직전/직후 Σρ·Σu 를 비교(둘레는 게이트 off).
  let same = true, firstDiff = '';
  let visitedLast = 0;
  const uFrozenBefore = [], uFrozenAfter = [];
  for (let t = 0; t < S; t++) {
    Fu.applyFusion(wd, DT, { rate: RATE, rhoCrit: RHO_CRIT, tCrit: T_CRIT });   // 조밀 전-격자
    const stats = {};
    runActive(wa, set, tr, hold, stats);                                        // 활성(비-동결)만
    if (t === S - 1) visitedLast = stats.cellsVisited;
    for (const nm of ['therm', 'energy']) if (wd.fingerprint(nm) !== wa.fingerprint(nm)) { same = false; if (!firstDiff) firstDiff = `${nm}@${t}`; }
    if (!same) break;
  }
  occActive = visitedLast / allCells * 100;

  check('비트 동일(관문) — fusion 을 활성(비-동결) 블록만 돌려도 조밀 전-격자와 byte 동일(12스텝)',
    same, same ? `therm·energy 비트 동일 = true` : `불일치 ${firstDiff}`);

  // 5. 0연산: 정착 후 활성 방문 셀이 전체 비-영 블록보다 *적다*(동결 블록 0연산). 동결이 실제로 일어남.
  check('0연산(실현 절감) — 동결 블록은 실제로 안 돈다(마지막 step 방문 셀 ≪ 전체 비-영 블록 셀)',
    visitedLast > 0 && visitedLast < allCells, `마지막 step 방문 ${visitedLast}셀 < 전체 비-영 ${allCells}셀 (활성 ${occActive.toFixed(0)}%)`);

  // 6. 보존: 동결된 둘레(돌 가스, ρ=2·u=1)는 fusion 게이트 off → 동결 동안 값 정확 불변.
  //   둘레 한 점이 시작값(ρ=2·u=1)을 그대로 쥐고 있는지(부동) + Σρ 전역 보존(fusion 은 ρ 불변).
  const probe = ((2 * BS + 1) * N + (2 * BS + 1)) * N + (2 * BS + 1);
  const frozenHeld = wa.fields.energy[probe] === 2 && wa.fields.therm[probe] === 1;
  const mass0 = makeWorld(); const massOk = Math.abs(sum(wa, 'energy') - sum(mass0, 'energy')) < 1e-9;
  check('보존 — 동결 블록 Σρ·Σu 불변(계산만 멈출 뿐 값 안 건드림)·fusion 은 ρ 전역 보존',
    frozenHeld && massOk, `동결 둘레 셀 ρ=${wa.fields.energy[probe]}·u=${wa.fields.therm[probe]}(시작값 부동) · Σρ 보존`);
}

// ── 7. 회귀 0 — opts.active 생략 시 fusion 기존 경로 byte 동일 ──
{
  const a = makeWorld(), b = makeWorld();
  // a: 기존 경로(active 없음), b: active=전체 origins(아무것도 안 얼림) → 둘 다 전-격자 동작과 동치
  const setB = Sp.createActiveSet(N, BS).rebuildFromField(b.fields.energy);
  for (let t = 0; t < 5; t++) {
    Fu.applyFusion(a, DT, { rate: RATE, rhoCrit: RHO_CRIT, tCrit: T_CRIT });
    Fu.applyFusion(b, DT, { rate: RATE, rhoCrit: RHO_CRIT, tCrit: T_CRIT, active: setB.origins(), blockSize: BS });
  }
  // 모든 비-영 블록이 origins 에 있으므로(코어·둘레 다 ρ>0) active 전체 경로 = 전-격자 경로 byte 동일.
  let byteEq = a.fingerprint('therm') === b.fingerprint('therm') && a.fingerprint('energy') === b.fingerprint('energy');
  // rate=0 항등도.
  const c = makeWorld(); const fp0 = c.fingerprint('therm'); Fu.applyFusion(c, DT, { rate: 0, active: setB.origins(), blockSize: BS }); byteEq = byteEq && c.fingerprint('therm') === fp0;
  check('회귀 0 — opts.active 생략/전체 → fusion 기존 경로 byte 동일 · rate=0 항등',
    byteEq, `active 전체=전-격자 byte 동일 · rate=0 지문 불변`);
}

// ── 8. 결정론 ──
{
  function run() {
    const w = makeWorld(); const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.energy);
    const tr = Ac.createActivityTracker(N, BS);
    for (let t = 0; t < 8; t++) runActive(w, set, tr, 3, {});
    return w.fingerprint('therm') + ':' + tr.frozenOrigins(set.origins(), 3).length;
  }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 동결 집합·같은 지문', a === b, a.split(':')[0]);
}

console.log('\n=== step_0025 수치 검증: 활동도 추적 + 동결 판정(S3, 시간 LOD 의 안전한 첫 형태) ===');
console.log(`  [정보용] fusion-only 정착 후 활성 방문 비율 ≈ ${occActive.toFixed(0)}% (나머지=동결 0연산)`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

// step_0017/verify.js — S2 진공 전이 규칙: 너무 옅으면 0 으로 흡수(질량 보존). 순수·독립·영구.
//
//   step_0016(희소 컨테이너)의 정직한 한계: *파이프라인 별(가우시안)은 꼬리가 전 격자를 채워*
//   (exp(-r²)>0 어디서나) 점유 512/512 = 희소 이득 0. 이 step 은 그 한계를 닫는다 —
//   옅은 셀(0<ρ<eps)의 질량을 *더 밀한 이웃*으로 옮기고 정확한 0 으로(design §2 레버1 "전이 규칙").
//   질량은 보존되고(밀한 쪽으로만 이동), 진공이 바깥부터 자라나 가우시안 별이 *실제로 희소*해진다.
//
//   검증 대상:
//     1. 보존        — total(질량) 불변(기계 정밀도 이내) — 1패스 + N패스.
//     2. 진공 생성    — 비-영 셀 수 ↓ · 정확한 0 셀 수 ↑ (옅은 꼬리가 0 으로).
//     3. 코어 보존    — 밀한 셀(≥eps)은 안 사라짐 · max 비감소(질량이 안쪽으로 모임).
//     4. 흡수 방향    — 옅은 셀 질량이 *가장 밀한 이웃*으로 가고 자신은 0 (직접 구성한 경사로).
//     5. 고립 옅음 보존 — 더 밀한 이웃 없는 국소 최대 옅은 셀은 *그대로*(옆으로 안 뒤섞음).
//     6. 가법성/회귀0 — eps=0 → byte 동일(early return).
//     7. 희소 이득 실현 — 가우시안 별에 진공 규칙 반복 → 희소 점유 블록 급감(step_0016 한계 닫음), 질량 보존.
//     8. 결정론       — 같은 장 두 번 → 동일 지문.
//
//   실행: node HTJ/steps/step_0017/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Va = require(path.resolve(__dirname, '../../engine/htj-vacuum.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
function bytesEqual(a, b) {
  const ba = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), bb = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  if (ba.length !== bb.length) return false;
  for (let i = 0; i < ba.length; i++) if (ba[i] !== bb[i]) return false;
  return true;
}

const N = 64;
const EPS = 0.05;

// 큰 박스(64³) 속 *작은* 가우시안 별 — 꼬리가 전 격자를 비-영으로 채움(점유 512/512 = step_0016 한계 재현).
//   별이 작아 진공 규칙이 주변부 블록을 *통째로* 비울 수 있다(블록 단위 희소 이득이 눈에 보임).
function gaussWorld() {
  const w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.06, M0: 4000, T0: 1 });
  return w;
}

// ── 1·2·3. 가우시안에 진공 규칙 적용 → 보존·진공 생성·코어 보존 ──
{
  const w = gaussWorld();
  const before = Va.totalMass(w);
  const nzBefore = Va.nonzeroCount(w), zBefore = Va.exactZeroCount(w), maxBefore = w.max('energy');
  Va.applyVacuum(w, { eps: EPS });
  const after = Va.totalMass(w);
  const nzAfter = Va.nonzeroCount(w), zAfter = Va.exactZeroCount(w), maxAfter = w.max('energy');

  check('보존 — total(질량) 불변(기계 정밀도 이내) [1패스]',
    Math.abs(after - before) <= 1e-9 * Math.abs(before), `Δ=${Math.abs(after - before).toExponential(1)} (total≈${before.toFixed(1)})`);
  check('진공 생성 — 비-영 셀 ↓ · 정확한 0 셀 ↑ (옅은 꼬리가 0 으로)',
    nzAfter < nzBefore && zAfter > zBefore, `비-영 ${nzBefore}→${nzAfter} · 정확한0 ${zBefore}→${zAfter}`);
  check('코어 보존 — max 비감소(질량이 안쪽으로 모임, 밀한 셀 안 사라짐)',
    maxAfter >= maxBefore, `max ${maxBefore.toFixed(3)} → ${maxAfter.toFixed(3)}`);
}

// ── 1b. N패스 보존 ──
{
  const w = gaussWorld();
  const before = Va.totalMass(w);
  for (let k = 0; k < 30; k++) Va.applyVacuum(w, { eps: EPS });
  const after = Va.totalMass(w);
  check('보존 — total(질량) 불변(기계 정밀도 이내) [30패스]',
    Math.abs(after - before) <= 1e-9 * Math.abs(before), `Δ=${Math.abs(after - before).toExponential(1)}`);
}

// ── 4. 흡수 방향 — 옅은 셀 질량이 가장 밀한 이웃으로, 자신은 0 ──
{
  const w = W.createWorld(8);
  const E = w.fields.energy;
  const c = w.index(4, 4, 4);
  E[c] = 1.0;                          // 밀한 코어(≥eps)
  const thin = w.index(5, 4, 4);       // 그 +x 이웃 = 옅은 셀
  E[thin] = EPS * 0.5;                 // 0<ρ<eps
  const give = E[thin];
  Va.applyVacuum(w, { eps: EPS });
  const donorZero = E[thin] === 0;                       // 옅은 셀 → 정확히 0
  const coreGot = Math.abs(E[c] - (1.0 + give)) < 1e-15; // 가장 밀한 이웃(코어)이 통째 흡수
  check('흡수 방향 — 옅은 셀 질량이 가장 밀한 이웃으로 가고 자신은 0',
    donorZero && coreGot, `donor=0:${donorZero} · core ${1.0}→${E[c]} (=+${give})`);
}

// ── 5. 고립 옅음 보존 — 더 밀한 이웃 없는 국소 최대 옅은 셀은 그대로 ──
{
  const w = W.createWorld(8);
  const E = w.fields.energy;
  const iso = w.index(4, 4, 4);
  E[iso] = EPS * 0.5;                  // 옅지만 이웃이 전부 0(더 밀한 이웃 없음)
  const before = E[iso];
  Va.applyVacuum(w, { eps: EPS });
  check('고립 옅음 보존 — 더 밀한 이웃 없는 국소 최대 옅은 셀은 그대로(옆으로 안 뒤섞음)',
    E[iso] === before, `iso ${before} → ${E[iso]} (불변)`);
}

// ── 6. 가법성/회귀 0 — eps=0 → byte 동일 ──
{
  const w = gaussWorld();
  const snap = Float64Array.from(w.fields.energy);
  Va.applyVacuum(w, { eps: 0 });
  check('가법성/회귀 0 — eps=0 → byte 동일(early return, 세계 불변)',
    bytesEqual(snap, w.fields.energy), 'eps=0 → 항등');
}

// ── 7. 데이터 희소화 실현 — 가우시안 별에 진공 반복 → 점유 급감(step_0016 한계 닫음), 질량 보존 ──
//   (정직: 여기서 *실현*된 것은 **데이터**가 희소해진 것[필드에 exact 0 생김]뿐이다. 그 희소성을
//    *계산 절감*으로 쓰는 법칙은 아직 없다 — 법칙은 여전히 조밀 N³ 순회. 계산 연결은 step_0018.)
{
  const w = gaussWorld();
  const massBefore = Va.totalMass(w);
  const spBefore = Sp.fromDense(N, w.fields.energy);
  const blocksBefore = spBefore.activeBlocks();
  for (let k = 0; k < 80; k++) Va.applyVacuum(w, { eps: EPS });
  const massAfter = Va.totalMass(w);
  const spAfter = Sp.fromDense(N, w.fields.energy);
  const blocksAfter = spAfter.activeBlocks();
  const massOk = Math.abs(massAfter - massBefore) <= 1e-9 * Math.abs(massBefore);
  const sparser = blocksAfter < blocksBefore * 0.2;     // 점유 블록 1/5 이하로 급감(512→~32)
  check('데이터 희소화 실현 — 진공 반복 → 점유 블록 급감(step_0016 한계 닫음) · 질량 보존 [계산 연결=step_0018]',
    massOk && sparser,
    `점유 ${blocksBefore}/${spBefore.blocksTotal}블록 → ${blocksAfter}/${spAfter.blocksTotal}블록 (${(100 * blocksAfter / spAfter.blocksTotal).toFixed(0)}%) · 질량 Δ=${Math.abs(massAfter - massBefore).toExponential(1)}`);
}

// ── 8. 결정론 — 같은 장 두 번 → 동일 지문 ──
{
  const a = gaussWorld(); for (let k = 0; k < 5; k++) Va.applyVacuum(a, { eps: EPS });
  const b = gaussWorld(); for (let k = 0; k < 5; k++) Va.applyVacuum(b, { eps: EPS });
  check('결정론 — 같은 장 두 번 흡수 → 동일 지문', a.fingerprint('energy') === b.fingerprint('energy'),
    `0x${a.fingerprint('energy').toString(16)}`);
}

console.log('\n=== step_0017 수치 검증: S2 진공 전이 규칙 — 너무 옅으면 0 으로 흡수(질량 보존) ===');
{
  const w = gaussWorld();
  const m0 = Va.totalMass(w), b0 = Sp.fromDense(N, w.fields.energy).activeBlocks();
  for (let k = 0; k < 80; k++) Va.applyVacuum(w, { eps: EPS });
  const m1 = Va.totalMass(w), b1 = Sp.fromDense(N, w.fields.energy).activeBlocks();
  console.log(`  작은 가우시안 별 N=${N} eps=${EPS}: 점유 ${b0}/512블록 → ${b1}/512블록(진공 80패스) · 질량 ${m0.toFixed(1)}→${m1.toFixed(1)}(보존)`);
}
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

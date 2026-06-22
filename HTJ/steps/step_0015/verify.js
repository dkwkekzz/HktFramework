// step_0015/verify.js — S1 측정 베이스라인: 조밀 격자 비용은 *부피*(점유 아님)에 묶인다. 순수·독립·영구.
//
//   확장성 설계(design/scalability.md)의 전제 = "조밀 균일 격자(Float64Array(N³))는 세계가 커지면
//   부피 비용으로 무너진다." 이 step 은 그 전제를 **실측으로 박는다** — 그리고 S2(희소화)가 *실제로*
//   비용을 줄였는지 비교할 영구 베이스라인을 남긴다.
//
//   정직성 원칙(이 verify 의 핵심): **단언은 엔진을 실제로 측정한 결정론 값에만** 건다.
//     · 메모리는 *실측*(Σ 장 byteLength) — 산수로 꾸민 동어반복이 아니라 진짜 할당량.
//     · **핵심 베이스라인 = 점유 무관성**: 1셀만 찬 세계도 가득 찬 세계와 *같은* 메모리를 쓴다
//       (비용이 *내용*이 아니라 *부피*에 묶임). 이게 바로 S2 희소화가 깨야 할 측정값이다.
//     · 벽시계 ms·계산량은 머신 의존/비결정 → *정보용*만(printed), **단언하지 않는다**.
//       (계산이 부피에 비례하는 건 구조적 사실 — 모든 법칙이 매 스텝 전-격자 N³ 를 순회 — 이지만,
//        그걸 하드코딩 상수로 "측정"한 척하지 않는다. 곡선(capture)·벽시계가 그 증거.)
//
//   검증 대상(전부 실측·결정론):
//     1. 메모리 공식    — Σ(장 byteLength) = nFields × N³ × 8 (모든 장이 Float64Array(N³)).
//     2. 점유 무관(핵심) — 1셀 세계 메모리 = 가득 찬 세계 메모리 (조밀 컨테이너는 빈 칸도 똑같이 쓴다).
//     3. 부피 스케일    — mem(2N)/mem(N) = 8 (조밀 컨테이너 = 부피 스케일, 실측).
//     4. 무너지는 지점  — N=256 메모리 외삽 > 0.5GB (실측 불가 영역 = 전제 확정; *외삽*임을 명시).
//     5. 결정론        — 같은 N 두 번 빌드 → 동일 지문(측정 기반이 결정론적).
//
//   실행: node HTJ/steps/step_0015/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const GRAV_ITERS = 40;          // 중력 완화 반복(red-black → 실제 전-격자 패스 = 2×iters). §3 가속 대상.

// N 격자에 별을 심고(또는 1셀만) 전체 법칙 파이프라인(0013/0014 동일)을 steps 회 굴린 뒤 비용을 *실측*한다.
//   sparse=true → 중앙 1셀만 점유(거의 빈 세계) — 점유 무관성 측정용.
function measure(N, steps, sparse) {
  const w = W.createWorld(N);
  if (sparse) { w.fields.energy[w.index(N >> 1, N >> 1, N >> 1)] = 1; }     // 1셀만 — 거의 빈 세계
  else Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N * N * N * 0.5), T0: 1 });
  const t0 = process.hrtime.bigint();
  for (let t = 0; t < steps; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: GRAV_ITERS });
    Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
    Fu.applyFusion(w, 0.2, { rate: 2, rhoCrit: 6, tCrit: 3 });
    Co.applyCooling(w, 0.2, { coolRate: 0.06 });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  const t1 = process.hrtime.bigint();
  let memBytes = 0, nFields = 0;
  for (const k of Object.keys(w.fields)) { memBytes += w.fields[k].byteLength; nFields++; }    // 실측 메모리
  return { N, cells: N * N * N, nFields, memBytes, msPerStep: Number(t1 - t0) / 1e6 / steps, fp: w.fingerprint('energy') };
}

const STEPS = 6;
const N1 = 16, N2 = 32;                                          // 2배 → ×8 검증쌍
const m1 = measure(N1, STEPS, false), m2 = measure(N2, STEPS, false);
const m48 = measure(48, STEPS, false);                          // viewer 최대
const sparse32 = measure(N2, STEPS, true);                      // 같은 N, 1셀만 점유

// ── 1. 메모리 공식 — Σ(장 byteLength) = nFields·N³·8 (실측) ──
{
  const formula = m1.nFields * m1.cells * 8;
  check('메모리 공식 — Σ(장 byteLength) = nFields·N³·8 (모든 장 Float64Array(N³), 실측)',
    m1.memBytes === formula, `N=${N1}: 실측 ${m1.memBytes}B = ${m1.nFields}장·${m1.cells}칸·8`);
}
// ── 2. 점유 무관(핵심 베이스라인) — 1셀 세계 = 가득 찬 세계 메모리 ──
{
  const sameFields = sparse32.nFields === m2.nFields;
  const sameMem = sparse32.memBytes === m2.memBytes;
  check('점유 무관(핵심) — 1셀 세계도 가득 찬 세계와 동일 메모리(조밀=빈 칸도 똑같이 씀, S2 가 깰 베이스라인)',
    sameFields && sameMem,
    `N=${N2}: 1셀 ${(sparse32.memBytes / 1024 / 1024).toFixed(2)}MB = 가득참 ${(m2.memBytes / 1024 / 1024).toFixed(2)}MB (비용=부피, 점유 아님)`);
}
// ── 3. 부피 스케일 — mem(2N)/mem(N)=8 (실측, 조밀 컨테이너) ──
{
  const ratio = m2.memBytes / m1.memBytes;
  check('부피 스케일 — N 2배 → 메모리 ×8 (조밀 컨테이너는 부피로 스케일, 실측)', Math.abs(ratio - 8) < 1e-9,
    `mem(${N1})=${(m1.memBytes / 1024).toFixed(0)}KB → mem(${N2})=${(m2.memBytes / 1024 / 1024).toFixed(2)}MB (×${ratio.toFixed(2)})`);
}
// ── 4. 무너지는 지점(외삽) — N=256 메모리 > 0.5GB ──
{
  const mem256 = m1.nFields * 256 * 256 * 256 * 8;             // 실측 nFields 기반 외삽(실측 불가 = 그게 요점)
  check('무너지는 지점(외삽) — N=256 조밀 메모리 > 0.5GB (수억 칸=실측 불가 영역=전제 확정)',
    mem256 > 0.5 * 1024 * 1024 * 1024, `N=256: ${m1.nFields}장 × ${(256 ** 3 / 1e6).toFixed(1)}M칸 = ${(mem256 / 1024 / 1024 / 1024).toFixed(2)}GB (외삽)`);
}
// ── 5. 결정론 — 같은 N 두 번 → 동일 지문 ──
{
  const a = measure(N1, STEPS, false), b = measure(N1, STEPS, false);
  check('결정론 — 같은 N 두 번 빌드 → 동일 지문(측정 기반이 결정론적)', a.fp === b.fp, `0x${a.fp.toString(16)}`);
}

console.log('\n=== step_0015 수치 검증: S1 측정 베이스라인 — 조밀 격자 비용은 *부피*(점유 아님)에 묶인다 ===');
console.log('  [정보용·머신 의존·비단언] 계산도 부피에 비례(모든 법칙이 매 스텝 전-격자 N³ 순회);');
console.log('  중력만 *전역·반복*(red-black ' + (2 * GRAV_ITERS) + '패스/step) → S6 트리 가속 대상. 벽시계가 그 증거(아래):');
for (const m of [m1, m2, m48]) {
  console.log(`    N=${String(m.N).padStart(2)} · ${(m.cells / 1e3).toFixed(1).padStart(7)}K칸 · 메모리 ${(m.memBytes / 1024 / 1024).toFixed(2).padStart(6)}MB · 벽시계 ${m.msPerStep.toFixed(2).padStart(7)} ms/step`);
}
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

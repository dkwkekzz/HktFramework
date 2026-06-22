// step_0015/verify.js — S1 측정 베이스라인: 조밀 격자 비용이 O(N³) 임을 *수치로 확정*. 순수·독립·영구.
//
//   확장성 설계(design/scalability.md)의 전제 = "조밀 균일 격자(Float64Array(N³))는 세계가 커지면
//   부피 비용 O(N³) 로 무너진다." 이 step 은 그 전제를 **측정으로 박는다** — N 을 키우며 비용을
//   재고, O(N³) 스케일을 단언한다. 이후 S2(희소화)~ 가 *실제로* 비용을 줄였는지 비교할 영구 베이스라인.
//
//   비용은 두 종류:
//     · 결정론적 프록시(머신 무관·영구 단언 대상):
//         - 메모리 = nFields × N³ × 8 byte (장마다 Float64Array(N³)).
//         - 격자 작업량 = (중력 iters + 국소 법칙 패스수) × N³  (매 스텝 전-격자 순회).
//         - 둘 다 N→2N 에 정확히 ×8 (= 부피 N³).
//     · 벽시계 ms(머신 의존) — *정보용*만(printed), 단언 안 함(비결정·환경마다 다름).
//
//   검증 대상:
//     1. 메모리 공식 — 실측 Σ(장 byteLength) = nFields × N³ × 8 (모든 장이 Float64Array(N³)).
//     2. 메모리 O(N³) — mem(2N)/mem(N) = 8 (부피 스케일).
//     3. 작업량 O(N³) — 격자 작업량(2N)/(N) = 8.
//     4. 중력이 지배항 — 전역 중력(iters·N³)이 단일 최대 비용(국소 법칙들보다 큼) = §3 "중력은 따로".
//     5. 무너지는 지점(전제 확정) — N=256 조밀 격자 메모리 > 0.5 GB (수억 칸 = 실측 불가 영역).
//     6. 결정론 — 같은 N 두 번 빌드 → 동일 지문(비용 측정 기반이 결정론적).
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

// 표준 비용 파라미터 — 0013/0014 와 같은 전체 법칙 파이프라인.
const GRAV_ITERS = 40;          // 중력 완화 반복(전-격자 패스 수)
const LOCAL_PASSES = 7;         // 국소 법칙 전-격자 패스 수(pressure·thermal·visc·fusion·cooling·advect·heating 류, 모델 상수)

// N 격자에 별을 심고 파이프라인을 steps 회 굴린 뒤 비용을 측정한다.
function measure(N, steps) {
  const w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N * N * N * 0.5), T0: 1 });
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
  // 실측 메모리 — 모든 장의 byteLength 합.
  let memBytes = 0, nFields = 0;
  for (const k of Object.keys(w.fields)) { memBytes += w.fields[k].byteLength; nFields++; }
  const cells = N * N * N;
  const work = (GRAV_ITERS + LOCAL_PASSES) * cells;     // 스텝당 전-격자 작업량(프록시)
  const gravWork = GRAV_ITERS * cells, localWork = LOCAL_PASSES * cells;
  const msPerStep = Number(t1 - t0) / 1e6 / steps;      // 벽시계(정보용)
  return { N, cells, nFields, memBytes, work, gravWork, localWork, msPerStep, fp: w.fingerprint('energy') };
}

const STEPS = 6;
const N1 = 16, N2 = 32;                                  // 2배 → ×8 검증쌍
const m1 = measure(N1, STEPS), m2 = measure(N2, STEPS);
const m48 = measure(48, STEPS);                          // viewer 최대

// ── 1. 메모리 공식 — Σ(장 byteLength) = nFields·N³·8 ──
{
  const formula = m1.nFields * m1.cells * 8;
  check('메모리 공식 — Σ(장 byteLength) = nFields·N³·8 (모든 장 Float64Array(N³))',
    m1.memBytes === formula, `N=${N1}: 실측 ${m1.memBytes}B = ${m1.nFields}장·${m1.cells}칸·8`);
}
// ── 2. 메모리 O(N³) — mem(2N)/mem(N)=8 ──
{
  const ratio = m2.memBytes / m1.memBytes;
  check('메모리 O(N³) — N 2배 → 메모리 ×8 (부피 스케일)', Math.abs(ratio - 8) < 1e-9,
    `mem(${N1})=${(m1.memBytes / 1024).toFixed(0)}KB → mem(${N2})=${(m2.memBytes / 1024 / 1024).toFixed(2)}MB (×${ratio.toFixed(2)})`);
}
// ── 3. 작업량 O(N³) — work(2N)/work(N)=8 ──
{
  const ratio = m2.work / m1.work;
  check('작업량 O(N³) — N 2배 → 스텝당 격자 작업 ×8', Math.abs(ratio - 8) < 1e-9,
    `work(${N1})=${(m1.work / 1e6).toFixed(2)}M → work(${N2})=${(m2.work / 1e6).toFixed(1)}M ops/step (×${ratio.toFixed(2)})`);
}
// ── 4. 중력이 지배항 — 전역 중력(iters·N³)이 단일 최대 비용 ──
{
  const dominates = m2.gravWork > m2.localWork && GRAV_ITERS > LOCAL_PASSES;
  check('중력이 지배항 — 전역 중력(iters·N³)이 국소 법칙 합보다 큼 (§3 "중력은 따로")', dominates,
    `중력 ${GRAV_ITERS}패스·N³ vs 국소 ${LOCAL_PASSES}패스·N³ → 중력이 ${(m2.gravWork / m2.localWork).toFixed(1)}× (가속 필요=Barnes-Hut/멀티그리드)`);
}
// ── 5. 무너지는 지점 — N=256 조밀 메모리 > 0.5GB ──
{
  const mem256 = m1.nFields * 256 * 256 * 256 * 8;       // 공식 외삽(실측 불가 = 그게 요점)
  check('무너지는 지점 — N=256 조밀 격자 메모리 > 0.5GB (수억 칸=실측 불가 영역=전제 확정)',
    mem256 > 0.5 * 1024 * 1024 * 1024, `N=256: ${m1.nFields}장 × ${(256 ** 3 / 1e6).toFixed(1)}M칸 = ${(mem256 / 1024 / 1024 / 1024).toFixed(2)}GB`);
}
// ── 6. 결정론 — 같은 N 두 번 → 동일 지문 ──
{
  const a = measure(N1, STEPS), b = measure(N1, STEPS);
  check('결정론 — 같은 N 두 번 빌드 → 동일 지문(비용 측정 기반이 결정론적)', a.fp === b.fp, `0x${a.fp.toString(16)}`);
}

console.log('\n=== step_0015 수치 검증: S1 측정 베이스라인 — 조밀 격자 비용은 O(N³) 로 터진다 ===');
console.log('  [벽시계는 정보용·머신 의존·비단언]');
for (const m of [m1, m2, m48]) {
  console.log(`    N=${String(m.N).padStart(2)} · ${(m.cells / 1e3).toFixed(1).padStart(7)}K칸 · 메모리 ${(m.memBytes / 1024 / 1024).toFixed(2).padStart(6)}MB · 작업 ${(m.work / 1e6).toFixed(1).padStart(6)}M ops/step · 벽시계 ${m.msPerStep.toFixed(2).padStart(7)} ms/step`);
}
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

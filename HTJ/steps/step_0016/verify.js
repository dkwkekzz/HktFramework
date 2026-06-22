// step_0016/verify.js — S2 희소 블록 컨테이너: 빈 공간은 0원(비용을 *부피*→*점유*로). 순수·독립·영구.
//
//   step_0015(S1)가 박은 베이스라인: 조밀 격자는 비용이 *부피*에 묶인다 — 1셀 세계도 가득 찬 세계와
//   *같은* 메모리(점유 무관). 이 step 은 그 베이스라인을 **뒤집는 컨테이너**(engine/htj-sparse.js)를
//   세운다 — 격자를 8³ 블록으로 타일링, *비-영 블록만* 할당. 비용이 *점유한 블록 수*에 비례한다.
//
//   이 step 은 *컨테이너 자료구조*만 세운다(기존 법칙 불변 = 회귀 0). 검증 대상:
//     1. 왕복 비트 동일   — dense → fromDense → toDense() 가 *byte 동일*(빈 칸=0 동치). S2 의 관문.
//     2. 측정 일치        — total/count/max/min 이 조밀과 정확히 같다.
//     3. 점유 비례 메모리  — memBytes ∝ 점유 블록 수 ≪ 조밀 N³·8 (S1 점유 무관성을 *깬다*).
//     4. 점유 무관성 뒤집기 — 1셀 세계 ≪ 가득 찬 세계 (step_0015 §2 단언의 정확한 반대).
//     5. 빈 칸=0 동치     — 미할당 블록 읽기=0 · set(…,0) 무할당 · 전부-0 블록 지문=빈 동치.
//     6. 지문 재정의      — *비-영 칸 정규 직렬화*: 삽입 순서 무관 · 조밀 참조와 교차 일치.
//     7. 결정론          — 같은 내용 두 번 → 동일 지문.
//
//   실행: node HTJ/steps/step_0016/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// N 격자에 별을 심고 전체 법칙 파이프라인(0013/0014 동일)을 steps 회 굴린 뒤 energy 장(조밀)을 돌려준다.
//   → 실제 시뮬 내용(중앙에 뭉친 별 + 빈 우주)으로 희소 컨테이너를 시험한다.
function starWorld(N, steps) {
  const w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N * N * N * 0.5), T0: 1 });
  for (let t = 0; t < steps; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });
    Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
    Fu.applyFusion(w, 0.2, { rate: 2, rhoCrit: 6, tCrit: 3 });
    Co.applyCooling(w, 0.2, { coolRate: 0.06 });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  return w;
}

// 두 Float64Array 가 *byte 동일*인가? (왕복 비트 동일 판정 — 수치 비교 아닌 바이트 비교.)
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  const ba = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const bb = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < ba.length; i++) if (ba[i] !== bb[i]) return false;
  return true;
}

const N = 64, STEPS = 8;
const w = starWorld(N, STEPS);
const dense = w.fields.energy;                 // 실제 시뮬 내용(가우시안 → 비-영 꼬리가 전 격자에 퍼짐)
const sparse = Sp.fromDense(N, dense);

// 정확한 진공을 갖는 별 — seedBall 은 반지름 밖을 *정확히 0* 으로 채운다(희소 이득의 전제).
//   파이프라인 별(가우시안)은 꼬리가 전 격자를 비-영으로 채워 희소하지 않다 — 이게 정직한 한계
//   (희소 이득엔 *정확한 진공* = 활성/비활성 전이 규칙이 필요, design §2 레버1 대가; 후속 step).
const wb = W.createWorld(N);
W.seedBall(wb, { r: N * 0.18 });               // 작은 별 + 정확한 진공 우주
const ball = wb.fields.energy;
const sBall = Sp.fromDense(N, ball);

// ── 1. 왕복 비트 동일 (관문) — *실제 시뮬 내용*(가우시안)에서도 byte 완벽 ──
{
  const back = sparse.toDense();
  check('왕복 비트 동일 — dense → fromDense → toDense() 가 byte 동일(빈 칸=0 동치, S2 관문)',
    bytesEqual(dense, back), `N=${N} 별 세계 · ${dense.length}칸 byte-identical`);
}
// ── 2. 측정 일치 — count/max/min 은 정확(===) · total 은 부동소수 합산 순서차만큼(상대 1e-12) ──
{
  const dTotal = wb.total('energy'), dCount = wb.count('energy', 0), dMax = wb.max('energy'), dMin = wb.min('energy');
  const sTotal = sBall.total(), sCount = sBall.count(0), sMax = sBall.max(), sMin = sBall.min();
  const exact = dCount === sCount && dMax === sMax && dMin === sMin;
  const totalClose = Math.abs(sTotal - dTotal) <= 1e-12 * Math.abs(dTotal);   // 합산 순서(블록 vs gi)만 차이
  check('측정 일치 — count/max/min 정확(===) · total 합산 순서차만(상대 1e-12)',
    exact && totalClose, `count=${sCount} max=${sMax} min=${sMin} total Δ=${Math.abs(sTotal - dTotal).toExponential(1)}`);
}
// ── 3. 점유 비례 메모리 — memBytes ∝ 점유 블록 ≪ 조밀 N³·8 (S1 점유 무관성을 깬다) ──
//   (정확한 진공을 갖는 seedBall 로 — 거기서만 희소 이득이 실재한다.)
{
  const denseBytes = ball.byteLength;
  const sparseBytes = sBall.memBytes();
  const expect = sBall.activeBlocks() * sBall.cellsPerBlock * 8;       // 할당 블록 × 512칸 × 8
  const proportional = sparseBytes === expect;
  const cheaper = sparseBytes < denseBytes;                            // 별은 국소 → 조밀보다 쌈
  check('점유 비례 메모리 — memBytes = 점유블록·512·8 ∝ 점유 (조밀 N³·8 보다 작다, S1 베이스라인 깸)',
    proportional && cheaper,
    `희소 ${(sparseBytes / 1024).toFixed(0)}KB (${sBall.activeBlocks()}/${sBall.blocksTotal}블록) < 조밀 ${(denseBytes / 1024).toFixed(0)}KB = ${(100 * sparseBytes / denseBytes).toFixed(1)}%`);
}
// ── 4. 점유 무관성 뒤집기 — 1셀 세계 ≪ 가득 찬 세계 (step_0015 §2 의 정확한 반대) ──
{
  const one = new Float64Array(N * N * N); one[(N >> 1) * N * N + (N >> 1) * N + (N >> 1)] = 1;  // 1셀만
  const full = new Float64Array(N * N * N); full.fill(1);                                          // 가득
  const sOne = Sp.fromDense(N, one), sFull = Sp.fromDense(N, full);
  const oneBytes = sOne.memBytes(), fullBytes = sFull.memBytes();
  // 1셀 = 정확히 1블록. 가득 = 모든 블록(=조밀과 동급). 조밀은 둘이 동일(점유 무관) — 희소는 천양지차.
  const oneIsOneBlock = oneBytes === sparse.cellsPerBlock * 8;
  const fullIsAll = fullBytes === sFull.blocksTotal * sFull.cellsPerBlock * 8;
  check('점유 무관성 뒤집기 — 1셀 세계 ≪ 가득 찬 세계 (조밀은 동일, 희소는 점유에 비례)',
    oneIsOneBlock && fullIsAll && oneBytes < fullBytes,
    `1셀 ${(oneBytes / 1024).toFixed(1)}KB(1블록) vs 가득 ${(fullBytes / 1024 / 1024).toFixed(2)}MB(전 블록) = ${(fullBytes / oneBytes).toFixed(0)}× 차이`);
}
// ── 5. 빈 칸=0 동치 — 미할당 읽기=0 · set(…,0) 무할당 · 전부-0 블록 지문=빈 동치 ──
{
  const a = Sp.createSparseField(N);
  const readEmpty = a.get(1, 2, 3) === 0;                  // 미할당 블록 읽기 = 0
  a.set(5, 5, 5, 0);                                       // 빈 블록에 0 쓰기
  const noAlloc = a.allocatedBlocks() === 0;               // → 블록 미할당
  // 같은 셀에 값 넣었다 0 으로 되돌린 블록: 지문은 *빈 컨테이너와 동치*(전부-0 블록 건너뜀).
  const b = Sp.createSparseField(N); b.set(10, 10, 10, 7); b.set(10, 10, 10, 0);
  const empty = Sp.createSparseField(N);
  const zeroBlockEquivEmpty = b.fingerprint() === empty.fingerprint();
  check('빈 칸=0 동치 — 미할당 읽기=0 · set(…,0) 무할당 · 전부-0 블록 지문 = 빈 컨테이너 동치',
    readEmpty && noAlloc && zeroBlockEquivEmpty,
    `read0=${readEmpty} noAlloc=${noAlloc} zeroBlock≡empty(0x${empty.fingerprint().toString(16)})`);
}
// ── 6. 지문 재정의 — 비-영 칸 정규 직렬화: 삽입 순서 무관 · 조밀 참조와 교차 일치 ──
{
  // 같은 비-영 내용을 *다른 삽입 순서*로 set → 같은 지문(정규 순서로 직렬화하므로).
  const p = Sp.createSparseField(N), q = Sp.createSparseField(N);
  const pts = [[3, 4, 5, 2.5], [40, 8, 12, -1.5], [20, 33, 7, 9], [1, 1, 1, 4]];
  for (const [x, y, z, v] of pts) p.set(x, y, z, v);
  for (const [x, y, z, v] of pts.slice().reverse()) q.set(x, y, z, v);   // 역순 삽입
  const orderInvariant = p.fingerprint() === q.fingerprint();
  // 조밀에서 같은 규칙으로 계산한 참조 지문과 교차 일치 (희소 지문 = 조밀 내용의 충실한 재정의).
  const ref = Sp.referenceFingerprint(N, dense);
  const crossMatch = sparse.fingerprint() === ref;
  check('지문 재정의 — 비-영 칸 정규 직렬화: 삽입 순서 무관 · 조밀 참조와 교차 일치',
    orderInvariant && crossMatch,
    `순서무관 0x${p.fingerprint().toString(16)} · 희소=조밀참조 0x${ref.toString(16)}`);
}
// ── 7. 결정론 — 같은 내용 두 번 → 동일 지문 ──
{
  const s2 = Sp.fromDense(N, dense);
  check('결정론 — 같은 조밀 내용 두 번 변환 → 동일 지문', sparse.fingerprint() === s2.fingerprint(),
    `0x${sparse.fingerprint().toString(16)}`);
}

console.log('\n=== step_0016 수치 검증: S2 희소 블록 컨테이너 — 빈 공간은 0원(비용을 부피→점유로) ===');
console.log(`  가우시안 별(파이프라인) N=${N}: 점유 ${sparse.activeBlocks()}/${sparse.blocksTotal}블록 = ` +
  `희소 ${(sparse.memBytes() / 1024).toFixed(0)}KB (조밀 대비 ${(100 * sparse.memBytes() / dense.byteLength).toFixed(0)}% — 꼬리가 전 격자 채움, 희소 이득 없음=정직한 한계)`);
console.log(`  정확한 진공 별(seedBall) N=${N}: 점유 ${sBall.activeBlocks()}/${sBall.blocksTotal}블록 = ` +
  `희소 ${(sBall.memBytes() / 1024).toFixed(0)}KB (조밀 대비 ${(100 * sBall.memBytes() / ball.byteLength).toFixed(0)}% — 여기서 희소 이득 실재)`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

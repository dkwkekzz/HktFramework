// step_0032/verify.js — S6(첫 단위): Barnes-Hut 옥트리 중력(직접합산과 ε 이내·O(N log N)). 순수·독립·영구.
//
//   design §3·§4 S6 의 검증 포인트 그대로: "작은 N 에서 직접합산과 오차 ε 이내·O(N log N) 스케일 곡선·
//   운동량 보존". Barnes-Hut: 멀리 있는 질량 무리를 CoM 한 점으로 근사 → 전역 중력을 O(N log N)으로.
//   유체 블록 응집 + 승격 개체를 *한 트리*에(§3 권장 — 개체가 트리 잎).
//
//   검증 대상:
//     1. θ=0 = 직접합산(정확성 관문) — 전부 재귀 → 직접합산과 기계 정밀도 일치.
//     2. θ>0 정확도 — θ=0.5 에서 직접합산 대비 최대 상대오차 < ε(작은 근사 오차).
//     3. O(N log N) — N 키울수록 상호작용/몸체 가 직접합산 N 보다 훨씬 천천히 증가(sub-linear).
//     4. 순 운동량 ≈0 — Σ m_i·a_i ≈ 0(내부력·θ=0 이면 정확).
//     5. 유체+개체 혼합 — 작은 점(유체) 다수 + 무거운 개체 소수 한 트리 → 직접합산과 일치.
//     6. softening 비발산 — 겹친 두 몸체도 힘 유한·NaN 없음.
//     7. 결정론.
//
//   실행: node HTJ/steps/step_0032/verify.js
'use strict';
const path = require('path');
const BH = require(path.resolve(__dirname, '../../engine/htj-bhtree.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 결정론 난수(LCG) — 몸체 배치.
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function makeBodies(n, seed, box) { const r = rng(seed), b = []; for (let i = 0; i < n; i++) b.push({ x: r() * box, y: r() * box, z: r() * box, mass: 0.5 + r() * 2 }); return b; }
function maxRelErr(a, b) {   // 몸체별 상대오차 최대(θ=0 정확성 관문용 — 기계 정밀도 확인).
  let m = 0;
  for (let i = 0; i < a.length; i++) { const da = Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]); const mag = Math.hypot(b[i][0], b[i][1], b[i][2]) + 1e-9; if (da / mag > m) m = da / mag; }
  return m;
}
// BH 표준 정확도 지표 — 최대 절대오차를 *전형적 힘 크기*(평균)로 정규화(상쇄 셀의 작은 분모 폭주 회피).
function errVsMean(a, b) {
  let meanMag = 0; for (const v of b) meanMag += Math.hypot(v[0], v[1], v[2]); meanMag /= (b.length || 1);
  let m = 0; for (let i = 0; i < a.length; i++) { const da = Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]); if (da > m) m = da; }
  return m / (meanMag + 1e-12);
}
function netMomentum(bodies, acc) { let x = 0, y = 0, z = 0; for (let i = 0; i < bodies.length; i++) { x += bodies[i].mass * acc[i][0]; y += bodies[i].mass * acc[i][1]; z += bodies[i].mass * acc[i][2]; } return Math.hypot(x, y, z); }

// ── 1. θ=0 = 직접합산(정확성 관문) ──
{
  const bodies = makeBodies(200, 1, 100);
  const opt = { G: 1, soft: 1 };
  const bh = BH.computeAccelerations(bodies, Object.assign({ theta: 0 }, opt));
  const dir = BH.directAccelerations(bodies, opt);
  const err = maxRelErr(bh.acc, dir.acc);
  check('θ=0 = 직접합산(정확성 관문) — 전부 재귀 → 기계 정밀도 일치', err < 1e-10, `최대 상대오차 ${err.toExponential(2)}`);
}

// ── 2. θ>0 정확도 ──
let accInfo = '';
{
  const bodies = makeBodies(500, 2, 100);
  const opt = { G: 1, soft: 1 };
  const bh = BH.computeAccelerations(bodies, Object.assign({ theta: 0.5 }, opt));
  const dir = BH.directAccelerations(bodies, opt);
  const err = errVsMean(bh.acc, dir.acc);   // 전형적 힘 대비 최대 오차(BH 표준 지표)
  accInfo = `θ=0.5 최대오차/평균힘 ${(err * 100).toFixed(2)}%`;
  check('θ>0 정확도 — θ=0.5 직접합산 대비 (전형적 힘 대비) 최대오차 < 5%', err < 0.05, accInfo);
}

// ── 3. O(N log N) — 상호작용/몸체가 sub-linear ──
let scaleInfo = '';
{
  const sizes = [200, 800, 3200];
  const perBody = [];
  for (const n of sizes) { const bodies = makeBodies(n, 7, 100); const bh = BH.computeAccelerations(bodies, { G: 1, theta: 0.6, soft: 1 }); perBody.push(bh.interactions / n); }
  // 몸체당 상호작용 수가 N 16배에 거의 안 늘면(직접합산은 N 배=16배) O(N log N) 증거.
  const growth = perBody[2] / perBody[0];        // N ×16 일 때 몸체당 상호작용 증가율
  const directGrowth = sizes[2] / sizes[0];       // 직접합산이면 16배
  scaleInfo = `몸체당 상호작용 ${perBody.map(v => v.toFixed(0)).join('→')} (N ×${directGrowth}: BH ×${growth.toFixed(2)} ≪ 직접 ×${directGrowth})`;
  check('O(N log N) — N ×16 에 몸체당 상호작용은 log 적 증가(직접합산 ×16 보다 훨씬 작음)', growth < 4, scaleInfo);
}

// ── 4. 순 운동량 ≈0 ──
{
  const bodies = makeBodies(400, 3, 100);
  const bh = BH.computeAccelerations(bodies, { G: 1, theta: 0.5, soft: 1 });
  const dir = BH.directAccelerations(bodies, { G: 1, soft: 1 });
  const pBH = netMomentum(bodies, bh.acc), pDir = netMomentum(bodies, dir.acc);
  // 직접합산은 정확히 0(내부력). BH 는 근사라 작게 샘 — 충격량 규모 대비 작아야.
  let scale = 0; for (let i = 0; i < bodies.length; i++) scale += bodies[i].mass * Math.hypot(bh.acc[i][0], bh.acc[i][1], bh.acc[i][2]); scale /= bodies.length;
  check('순 운동량 ≈0 — Σm·a≈0(직접합산 정확·BH 근사 작게)', pDir < 1e-9 && pBH / (scale * bodies.length) < 0.02,
    `직접 ${pDir.toExponential(1)}(정확) · BH ${pBH.toExponential(2)}(상대 ${(pBH / (scale * bodies.length) * 100).toFixed(2)}%)`);
}

// ── 5. 유체+개체 혼합 — 작은 점 다수 + 무거운 개체 소수 한 트리 ──
{
  const r = rng(11), bodies = [];
  for (let i = 0; i < 600; i++) bodies.push({ x: r() * 100, y: r() * 100, z: r() * 100, mass: 0.1 });   // 유체 점
  for (let i = 0; i < 4; i++) bodies.push({ x: r() * 100, y: r() * 100, z: r() * 100, mass: 50 });        // 승격 개체
  const opt = { G: 1, soft: 1 };
  const bh = BH.computeAccelerations(bodies, Object.assign({ theta: 0.4 }, opt));
  const dir = BH.directAccelerations(bodies, opt);
  const err = errVsMean(bh.acc, dir.acc);
  check('유체+개체 혼합 — 작은 점 다수 + 무거운 개체 소수 한 트리 → 직접합산 일치(ε 이내)',
    err < 0.05, `혼합 600 유체 + 4 개체 · 최대오차/평균힘 ${(err * 100).toFixed(2)}%`);
}

// ── 6. softening 비발산 — 겹친 몸체 ──
{
  const bodies = [{ x: 5, y: 5, z: 5, mass: 1 }, { x: 5, y: 5, z: 5, mass: 1 }, { x: 5.0001, y: 5, z: 5, mass: 1 }];
  const bh = BH.computeAccelerations(bodies, { G: 1, theta: 0.5, soft: 1 });
  let finite = true; for (const a of bh.acc) for (const v of a) if (!isFinite(v)) finite = false;
  check('softening 비발산 — 겹친 몸체도 힘 유한·NaN 없음', finite, `겹친 3 몸체 가속 유한 ${finite}`);
}

// ── 7. 결정론 ──
{
  function run() { const bodies = makeBodies(300, 5, 100); const bh = BH.computeAccelerations(bodies, { G: 1, theta: 0.5, soft: 1 }); let h = 0; for (const a of bh.acc) h = (h * 131 + Math.round(a[0] * 1e6) + Math.round(a[1] * 1e6)) >>> 0; return h; }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 BH 가속 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0032 수치 검증: S6(첫 단위) Barnes-Hut 옥트리 중력(직접합산 ε 이내·O(N log N)) ===');
console.log(`  [정보용] ${accInfo} · ${scaleInfo}`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

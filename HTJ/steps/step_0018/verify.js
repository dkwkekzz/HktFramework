// step_0018/verify.js — S2 첫 *실현* 절감: 법칙이 빈 블록을 실제로 건너뛴다(조밀과 비트 동일). 순수·독립·영구.
//
//   step_0014~0017 의 정직한 한계: 4개 step 동안 *실현된 계산 절감 = 0* — 법칙 11개 전부 매 step 조밀
//   N³ 를 통째 순회했다. 희소 컨테이너(0016)·진공 규칙(0017)은 *돌아가는 세계의 어떤 법칙도 안 씀*.
//   이 step 이 그 한계를 처음으로 닫는다 — 한 법칙(`applyCooling`, per-cell)을 **활성 블록만 순회**하도록
//   일반화. 빈 블록(전부 0)은 복사에서 무변화(lost=0)이므로 *건너뛰어도 조밀과 비트 동일*하고, 작업량은
//   *부피*가 아니라 *활성 블록*에 비례한다(첫 실현 절감 — 측정으로 박는다).
//
//   검증 대상:
//     1. 비트 동일(관문)  — 활성 순회 vs 조밀 전-격자 → therm 지문·radiated 정확히 같다(여러 스텝).
//     2. 회귀 0          — opts.active 생략 → 기존 조밀 경로(손 계산 u·factor 와 일치).
//     3. 실현 절감(실측)  — 활성 방문 셀 수 = 활성블록·512 ≪ 조밀 N³ (가짜 프록시 아닌 *실제 방문 수*).
//     4. 점유 비례 작업량 — 작은 별 ≪ 큰 별 (조밀은 점유 무관 N³ 고정, 활성은 점유 비례) = 0016 의 *계산* 판.
//     5. 빈 블록 정확 건너뜀 — 활성 목록은 빈 블록 제외 · 빈 블록 셀은 불변(0 유지).
//     6. 결정론          — 같은 입력 두 번 → 동일 결과.
//   (벽시계 ms 는 머신 의존 → 정보용 출력만, 단언 안 함 — step_0015 정직성 정책.)
//
//   실행: node HTJ/steps/step_0018/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 64, BS = 8;

// 희소 therm 별 — seedBall(반지름 밖 정확히 0)로 energy 를 만들고 therm=energy 로 복사(국소 + 진공).
function sparseThermWorld(r) {
  const w = W.createWorld(N);
  W.seedBall(w, { r });
  const E = w.fields.energy, u = w.addField('therm', { type: Float64Array });
  for (let i = 0; i < E.length; i++) u[i] = E[i] * 5;       // therm = ρ·T0, energy 와 같은 희소 형태
  return w;
}

// ── 1. 비트 동일(관문) — 활성 순회 vs 조밀, 여러 스텝 ──
{
  const wd = sparseThermWorld(N * 0.14);                    // 조밀 경로
  const wa = sparseThermWorld(N * 0.14);                    // 활성 경로
  for (let t = 0; t < 10; t++) {
    Co.applyCooling(wd, 0.2, { coolRate: 0.06 });           // 조밀 전-격자
    const active = Sp.activeBlockOrigins(wa.fields.therm, N, BS);
    Co.applyCooling(wa, 0.2, { coolRate: 0.06, active, blockSize: BS });  // 활성 블록만
  }
  const sameFp = wd.fingerprint('therm') === wa.fingerprint('therm');     // 필드는 per-cell → 비트 동일
  const radClose = Math.abs(wd.radiated - wa.radiated) <= 1e-12 * Math.abs(wd.radiated);  // 전역 합은 순서차 ULP
  check('비트 동일(관문) — 활성 순회 = 조밀 (therm 필드 비트 동일 · radiated 합산 순서차만 rel 1e-12, 10스텝)',
    sameFp && radClose, `therm fp 0x${wa.fingerprint('therm').toString(16)}(동일) · radiated Δ=${Math.abs(wd.radiated - wa.radiated).toExponential(1)}`);
}

// ── 2. 회귀 0 — opts.active 생략 → 기존 조밀 경로(손 계산과 일치) ──
{
  const w = sparseThermWorld(N * 0.14);
  const ref = Float64Array.from(w.fields.therm);
  const factor = 1 - 0.2 * 0.06;
  for (let i = 0; i < ref.length; i++) ref[i] *= factor;     // 손 계산 1스텝
  Co.applyCooling(w, 0.2, { coolRate: 0.06 });               // opts.active 없음 = 조밀
  let same = true; for (let i = 0; i < ref.length; i++) if (ref[i] !== w.fields.therm[i]) { same = false; break; }
  check('회귀 0 — opts.active 생략 → 기존 조밀 경로(손 계산 u·factor 와 byte 일치)', same, 'dense path 불변');
}

// ── 3. 실현 절감(실측) — 활성 방문 셀 수 = 활성블록·512 ≪ 조밀 N³ ──
{
  const w = sparseThermWorld(N * 0.14);
  const active = Sp.activeBlockOrigins(w.fields.therm, N, BS);
  const statsA = {}, statsD = {};
  const wa = sparseThermWorld(N * 0.14);
  Co.applyCooling(wa, 0.2, { coolRate: 0.06, active, blockSize: BS, stats: statsA });
  Co.applyCooling(w, 0.2, { coolRate: 0.06, stats: statsD });   // 조밀
  const expect = active.length * BS * BS * BS;
  const proportional = statsA.cellsVisited === expect;
  const cheaper = statsA.cellsVisited < statsD.cellsVisited;
  check('실현 절감(실측) — 활성 방문 셀 = 활성블록·512 ≪ 조밀 N³ (가짜 프록시 아닌 실제 방문 수)',
    proportional && cheaper,
    `활성 ${statsA.cellsVisited}셀 (${active.length}/${Math.ceil(N / BS) ** 3}블록) ≪ 조밀 ${statsD.cellsVisited}셀 = ${(100 * statsA.cellsVisited / statsD.cellsVisited).toFixed(1)}%`);
}

// ── 4. 점유 비례 작업량 — 작은 별 ≪ 큰 별 (조밀은 N³ 고정, 활성은 점유 비례) = 0016 의 *계산* 판 ──
{
  function work(r) {
    const w = sparseThermWorld(r);
    const active = Sp.activeBlockOrigins(w.fields.therm, N, BS);
    const s = {}; Co.applyCooling(w, 0.2, { coolRate: 0.06, active, blockSize: BS, stats: s });
    return s.cellsVisited;
  }
  const small = work(N * 0.08), big = work(N * 0.30);
  const dense = N * N * N;
  check('점유 비례 작업량 — 작은 별 ≪ 큰 별 (조밀 N³ 고정인데 활성은 점유 비례 = 실현 절감)',
    small < big && big < dense, `작은별 ${small}셀 ≪ 큰별 ${big}셀 (조밀은 둘 다 ${dense}셀 = 점유 무관)`);
}

// ── 5. 빈 블록 정확 건너뜀 — 활성 목록 빈 블록 제외 · 빈 블록 셀 불변 ──
{
  const w = sparseThermWorld(N * 0.10);
  const active = Sp.activeBlockOrigins(w.fields.therm, N, BS);
  const total = Math.ceil(N / BS) ** 3;
  const cornerEmpty = w.fields.therm[w.index(0, 0, 0)] === 0;   // 구석은 진공(0)
  Co.applyCooling(w, 0.2, { coolRate: 0.06, active, blockSize: BS });
  const cornerStill0 = w.fields.therm[w.index(0, 0, 0)] === 0;  // 안 방문 → 여전히 0
  check('빈 블록 정확 건너뜀 — 활성 목록이 빈 블록 제외 · 빈 블록 셀 불변(0 유지)',
    active.length < total && cornerEmpty && cornerStill0, `활성 ${active.length}/${total}블록 (빈 ${total - active.length}블록 제외)`);
}

// ── 6. 결정론 — 같은 입력 두 번 → 동일 결과 ──
{
  const a = sparseThermWorld(N * 0.14), b = sparseThermWorld(N * 0.14);
  for (let t = 0; t < 5; t++) {
    Co.applyCooling(a, 0.2, { coolRate: 0.06, active: Sp.activeBlockOrigins(a.fields.therm, N, BS), blockSize: BS });
    Co.applyCooling(b, 0.2, { coolRate: 0.06, active: Sp.activeBlockOrigins(b.fields.therm, N, BS), blockSize: BS });
  }
  check('결정론 — 같은 입력 두 번 활성 순회 → 동일 지문', a.fingerprint('therm') === b.fingerprint('therm'),
    `0x${a.fingerprint('therm').toString(16)}`);
}

// ── 벽시계(정보용·머신 의존·비단언) — 활성 vs 조밀 속도 ──
//   *정직*: 활성 집합을 매 step 다시 스캔하면 그 스캔이 O(N³)라 절감이 상쇄된다. 실현 절감은 활성 집합이
//   *유지*돼야 한다(스캔 1회 후 재사용). 냉각은 단조 축소(therm 만 줄어 새 블록 안 생김)라 *스캔 1회 재사용*이
//   정당하다 — 실제 엔진에선 희소 저장이 이 집합을 유지한다(다음 step). 둘 다(스캔 포함/제외) 출력한다.
let msDense = 0, msActiveReuse = 0, msActiveRescan = 0;
{
  const REP = 200;
  const wd = sparseThermWorld(N * 0.14);
  let t0 = process.hrtime.bigint();
  for (let t = 0; t < REP; t++) Co.applyCooling(wd, 0.2, { coolRate: 0.06 });
  msDense = Number(process.hrtime.bigint() - t0) / 1e6 / REP;
  // (a) 활성 집합 *유지*(스캔 1회 재사용) — 단조 축소라 정당.
  const wa = sparseThermWorld(N * 0.14);
  const active = Sp.activeBlockOrigins(wa.fields.therm, N, BS);
  t0 = process.hrtime.bigint();
  for (let t = 0; t < REP; t++) Co.applyCooling(wa, 0.2, { coolRate: 0.06, active, blockSize: BS });
  msActiveReuse = Number(process.hrtime.bigint() - t0) / 1e6 / REP;
  // (b) 활성 집합 *매번 재스캔*(O(N³) 스캔이 절감 상쇄 — 왜 희소 저장이 필요한지 보여줌).
  const wr = sparseThermWorld(N * 0.14);
  t0 = process.hrtime.bigint();
  for (let t = 0; t < REP; t++) Co.applyCooling(wr, 0.2, { coolRate: 0.06, active: Sp.activeBlockOrigins(wr.fields.therm, N, BS), blockSize: BS });
  msActiveRescan = Number(process.hrtime.bigint() - t0) / 1e6 / REP;
}

console.log('\n=== step_0018 수치 검증: S2 첫 실현 절감 — 법칙이 빈 블록을 실제로 건너뛴다(조밀과 비트 동일) ===');
console.log(`  [정보용·비단언] 벽시계 ms/cooling: 조밀 ${msDense.toFixed(3)} · 활성(집합 유지) ${msActiveReuse.toFixed(3)} · 활성(매번 재스캔) ${msActiveRescan.toFixed(3)}`);
console.log(`    → 집합 유지면 ${(msDense / msActiveReuse).toFixed(1)}× 빠름. 재스캔은 O(N³) 라 상쇄 = *희소 저장*(활성 집합 유지)이 필요한 이유(다음 step).`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

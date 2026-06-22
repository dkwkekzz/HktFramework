// step_0019/verify.js — S2 활성 집합을 *재스캔 없이 유지* → step_0018 의 O(N³) 재스캔 상쇄를 닫는다. 순수·독립·영구.
//
//   step_0018 의 정직한 한계: 법칙(cooling)이 빈 블록을 *건너뛰어* 작업량을 활성 비례로 줄였지만,
//   활성 블록을 *찾는* activeBlockOrigins 가 매 step 전-격자 O(N³) 를 재스캔해 그 절감을 도로 상쇄했다
//   (step_0018 verify 실측: 재스캔 0.554 ≥ 조밀 0.303). 실현 절감은 활성 집합이 *유지*돼야 한다.
//
//   이 step: 증분 ActiveSet(Sp.createActiveSet) — 한 번 빌드(O(N³))한 뒤 step 간 *재사용*하고 비워진
//   블록만 *활성 범위에서* 제거(prune, O(활성)). 전-격자 재스캔이 사라진다. 냉각은 단조 비-성장
//   (u·factor 는 0 셀을 비-영으로 못 만듦)이라 한 번 빌드한 집합이 모든 후속 step 의 유효한 cover.
//
//   검증 대상:
//     1. 교차 일치   — ActiveSet.origins() = activeBlockOrigins(step_0018) (같은 블록·같은 순서).
//     2. 비트 동일(관문) — 유지된 집합으로 S스텝 cooling = 조밀 S스텝 cooling (therm 비트 동일·radiated rel 1e-12).
//     3. 단조 불변성(reuse 안전) — cooling 은 새 비-영 셀을 안 만든다 → 한 번 빌드한 집합이 S스텝 후에도
//        모든 비-영 셀을 덮는다(missed=0). 이게 *재사용이 정당한 이유*.
//     4. 재스캔 제거(핵심 절감) — S스텝 동안 전-격자 스캔: 유지=1회 vs 재스캔(0018 방식)=S회. 작업량 동일.
//        실측 스캔 셀: 유지 ≪ 재스캔(≈S×) — step_0018 "재스캔이 절감 상쇄" 닫음.
//     5. 증분 축소(prune, 재스캔 없이) — factor=0(과냉각) 1스텝 → therm 전부 0 → prune 가 빈 블록 제거,
//        훑은 범위 = 활성 칸뿐(O(활성)) ≪ 전-격자 N³.
//     6. 회귀 0(가법성) — 새 API 추가가 기존(activeBlockOrigins·왕복 비트 동일) 동작을 안 건드린다.
//     7. 결정론      — origins() 순서 결정론(키 오름차순), 두 번 빌드 동일.
//   (벽시계 ms 는 머신 의존 → 정보용 출력만, 단언 안 함 — step_0015 정직성 정책.)
//
//   실행: node HTJ/steps/step_0019/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 64, BS = 8;

// 희소 therm 별 — seedBall(반지름 밖 정확히 0)로 energy 를 만들고 therm=energy·5 로 복사(국소·희소).
function sparseThermWorld(r) {
  const w = W.createWorld(N);
  W.seedBall(w, { r });
  const E = w.fields.energy, u = w.addField('therm', { type: Float64Array });
  for (let i = 0; i < E.length; i++) u[i] = E[i] * 5;
  return w;
}

// ── 1. 교차 일치 — ActiveSet.origins() = activeBlockOrigins(step_0018) ──
{
  const w = sparseThermWorld(N * 0.14);
  const ref = Sp.activeBlockOrigins(w.fields.therm, N, BS);              // step_0018 함수(닫음, 불변)
  const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.therm);
  const got = set.origins();
  let same = got.length === ref.length;
  for (let i = 0; same && i < got.length; i++)
    if (got[i][0] !== ref[i][0] || got[i][1] !== ref[i][1] || got[i][2] !== ref[i][2]) same = false;
  check('교차 일치 — ActiveSet.origins() = activeBlockOrigins (같은 블록·같은 키 오름차순)',
    same && got.length > 0, `${got.length}블록 일치(순서 포함)`);
}

// ── 2. 비트 동일(관문) — 유지된 집합으로 S스텝 cooling = 조밀 S스텝 ──
{
  const S = 12;
  const wd = sparseThermWorld(N * 0.14);                                 // 조밀 경로
  const wa = sparseThermWorld(N * 0.14);                                 // 유지 경로
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.therm);   // *한 번* 빌드
  const active = set.origins();                                          // 재사용(재스캔 없음)
  for (let t = 0; t < S; t++) {
    Co.applyCooling(wd, 0.2, { coolRate: 0.06 });                        // 조밀 전-격자
    Co.applyCooling(wa, 0.2, { coolRate: 0.06, active, blockSize: BS }); // 유지된 활성 집합
  }
  const sameFp = wd.fingerprint('therm') === wa.fingerprint('therm');
  const radClose = Math.abs(wd.radiated - wa.radiated) <= 1e-12 * Math.abs(wd.radiated);
  check('비트 동일(관문) — 유지된 집합 S스텝 cooling = 조밀 S스텝 (therm 비트 동일 · radiated rel 1e-12)',
    sameFp && radClose, `therm fp 0x${wa.fingerprint('therm').toString(16)}(동일) · radiated Δ=${Math.abs(wd.radiated - wa.radiated).toExponential(1)}`);
}

// ── 3. 단조 불변성(reuse 안전) — cooling 후 모든 비-영 셀이 빌드된 집합 안에 있다(missed=0) ──
{
  const S = 20;
  const w = sparseThermWorld(N * 0.14);
  const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.therm);
  const active = set.origins();
  for (let t = 0; t < S; t++) Co.applyCooling(w, 0.2, { coolRate: 0.06, active, blockSize: BS });
  // S스텝 후 비-영 셀이 빌드 당시 활성 블록 밖에 하나라도 있나?(있으면 reuse 가 틀린 것)
  const u = w.fields.therm; let missed = 0, nonzero = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (u[(z * N + y) * N + x] !== 0) { nonzero++; if (!set.has(x / BS | 0, y / BS | 0, z / BS | 0)) missed++; }
  }
  check('단조 불변성(reuse 안전) — cooling 은 새 비-영 셀을 안 만든다 → 빌드 집합이 S스텝 후에도 전부 덮음(missed=0)',
    missed === 0 && nonzero > 0, `비-영 ${nonzero}셀 전부 활성 집합 내부 · 집합 밖 비-영 ${missed}셀`);
}

// ── 4. 재스캔 제거(핵심 절감) — 전-격자 스캔: 유지=1회 vs 재스캔=S회, 작업량 동일 ──
{
  const S = 30;
  // (a) 유지 — 한 번 빌드(스캔 1회) 후 재사용. cooling 작업량 누적.
  const wa = sparseThermWorld(N * 0.14);
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.therm);
  const scanMaintained = set.lastScannedCells();                        // 빌드 1회가 훑은 셀(실측)
  const active = set.origins();
  let workMaintained = 0;
  for (let t = 0; t < S; t++) {
    const s = {}; Co.applyCooling(wa, 0.2, { coolRate: 0.06, active, blockSize: BS, stats: s });
    workMaintained += s.cellsVisited;
  }
  // (b) 재스캔(step_0018 방식) — 매 step 다시 빌드(전-격자 스캔). 같은 cooling 작업량.
  const wr = sparseThermWorld(N * 0.14);
  const rset = Sp.createActiveSet(N, BS);
  let scanRescan = 0, workRescan = 0;
  for (let t = 0; t < S; t++) {
    rset.rebuildFromField(wr.fields.therm); scanRescan += rset.lastScannedCells();   // 매 step O(N³) 스캔
    const s = {}; Co.applyCooling(wr, 0.2, { coolRate: 0.06, active: rset.origins(), blockSize: BS, stats: s });
    workRescan += s.cellsVisited;
  }
  const sameWork = workMaintained === workRescan;                       // 절감은 *스캔*에서, 작업량은 동일
  const scanCut = scanMaintained < scanRescan;                         // 유지가 재스캔보다 훨씬 적게 훑음
  const ratio = scanRescan / scanMaintained;
  check('재스캔 제거(핵심) — 전-격자 스캔 유지=1회 ≪ 재스캔=S회 (cooling 작업량은 동일) → step_0018 상쇄 닫음',
    sameWork && scanCut && ratio > 5,
    `스캔 셀: 유지 ${scanMaintained} (1회) ≪ 재스캔 ${scanRescan} (${S}회) = ${ratio.toFixed(1)}× 적게 · 작업량 동일 ${workMaintained}`);
}

// ── 5. 증분 축소(prune, 재스캔 없이) — 과냉각 1스텝 → therm 전부 0 → prune 가 O(활성)로 비움 ──
{
  const w = sparseThermWorld(N * 0.14);
  const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.therm);
  const before = set.size();
  // factor=0(dt·coolRate≥1) → u·0 = 모든 활성 셀 정확히 0(과냉각 클램프).
  Co.applyCooling(w, 1, { coolRate: 1, active: set.origins(), blockSize: BS });
  const removed = set.prune(w.fields.therm);                            // 활성 블록만 훑어 제거
  const pruneScan = set.lastScannedCells();
  const dense = N * N * N;
  check('증분 축소(prune) — 과냉각 1스텝 후 prune 가 빈 블록 제거 · 훑은 범위=활성 칸뿐(O(활성)≪N³)',
    set.size() === 0 && removed === before && before > 0 && pruneScan < dense,
    `${before}→0블록 (제거 ${removed}) · prune 스캔 ${pruneScan}셀 ≪ 전-격자 ${dense}셀`);
}

// ── 6. 회귀 0(가법성) — 새 API 가 기존 동작을 안 건드린다 ──
{
  const w = sparseThermWorld(N * 0.14);
  // (a) activeBlockOrigins(step_0018) 불변 — 위 §1 에서 교차 일치 확인됨, 여기선 왕복 비트 동일 가드.
  const dense = w.fields.therm;
  const sf = Sp.fromDense(N, dense, BS);
  const back = sf.toDense();
  let roundtrip = back.length === dense.length;
  for (let i = 0; roundtrip && i < dense.length; i++) if (back[i] !== dense[i]) roundtrip = false;
  // (b) referenceFingerprint = SparseField.fingerprint (step_0016 교차) 여전히 일치.
  const fpOk = Sp.referenceFingerprint(N, dense) === sf.fingerprint();
  check('회귀 0(가법성) — 새 API 추가가 기존 왕복 비트 동일·지문 교차(step_0016)를 안 건드림', roundtrip && fpOk,
    `왕복 byte 동일 · 지문 0x${sf.fingerprint().toString(16)} 교차 일치`);
}

// ── 7. 결정론 — origins() 순서 결정론(키 오름차순), 두 번 빌드 동일 ──
{
  const w = sparseThermWorld(N * 0.14);
  const a = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.therm).origins();
  const b = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.therm).origins();
  let same = a.length === b.length, ascending = true;
  for (let i = 0; same && i < a.length; i++) if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1] || a[i][2] !== b[i][2]) same = false;
  for (let i = 1; i < a.length; i++) {       // 키(z·nbx²+y·nbx+x) 오름차순 확인
    const nbx = Math.ceil(N / BS);
    const k0 = ((a[i - 1][2] / BS) * nbx + a[i - 1][1] / BS) * nbx + a[i - 1][0] / BS;
    const k1 = ((a[i][2] / BS) * nbx + a[i][1] / BS) * nbx + a[i][0] / BS;
    if (k1 <= k0) ascending = false;
  }
  check('결정론 — origins() 두 번 빌드 동일 · 키 오름차순', same && ascending && a.length > 0, `${a.length}블록 동일·오름차순`);
}

// ── 벽시계(정보용·머신 의존·비단언) — 유지 vs 재스캔 cooling ──
let msRescan = 0, msMaintained = 0, msDense = 0;
{
  const S = 200;
  const wd = sparseThermWorld(N * 0.14);
  let t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) Co.applyCooling(wd, 0.2, { coolRate: 0.06 });
  msDense = Number(process.hrtime.bigint() - t0) / 1e6 / S;
  // 유지(스캔 1회 후 재사용)
  const wa = sparseThermWorld(N * 0.14);
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.therm);
  const active = set.origins();
  t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) Co.applyCooling(wa, 0.2, { coolRate: 0.06, active, blockSize: BS });
  msMaintained = Number(process.hrtime.bigint() - t0) / 1e6 / S;
  // 재스캔(매 step 빌드 = step_0018 방식)
  const wr = sparseThermWorld(N * 0.14);
  const rset = Sp.createActiveSet(N, BS);
  t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) { rset.rebuildFromField(wr.fields.therm); Co.applyCooling(wr, 0.2, { coolRate: 0.06, active: rset.origins(), blockSize: BS }); }
  msRescan = Number(process.hrtime.bigint() - t0) / 1e6 / S;
}

console.log('\n=== step_0019 수치 검증: 활성 집합을 *재스캔 없이 유지* → step_0018 의 O(N³) 재스캔 상쇄 닫음 ===');
console.log(`  [정보용·비단언] 벽시계 ms/step: 조밀 ${msDense.toFixed(3)} · 유지 ${msMaintained.toFixed(3)} · 재스캔(0018) ${msRescan.toFixed(3)}`);
console.log(`    → 유지는 조밀 대비 ${(msDense / msMaintained).toFixed(1)}× 빠르고, 재스캔(0018)보다 ${(msRescan / msMaintained).toFixed(1)}× 빠름 (재스캔이 절감을 도로 먹던 걸 제거).`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

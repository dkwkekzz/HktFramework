// step_0020/verify.js — S2 *번지는* stencil 법칙(확산)을 활성 순회 + halo + 증분 활성화로 일반화. 순수·독립·영구.
//
//   step_0019 의 정직한 한계: ① stencil 법칙은 아직 활성 순회 미일반화 ② 유지 안전성이 *단조 비-성장*
//   법칙(cooling) 한정 — cooling 은 비-영 집합이 줄기만 해 한 번 빌드 후 고정이 안전했다. 그러나 확산은
//   *번진다*(0 셀이 비-영 이웃의 flux 를 받아 비-영이 됨) → 활성 블록만 돌면 경계 번짐을 놓쳐 조밀과 달라진다.
//   *번지는* 법칙에선 이 둘이 한 문제다: active∪**halo**(6-면 이웃 블록)를 돌고, 번져서 비-영이 된 halo
//   블록을 ActiveSet 에 *추가*(이웃 깨움=증분 활성화)한다. 전-격자 재스캔 없이 전선이 자라난다.
//
//   검증 대상:
//     1. 비트 동일(관문)  — S스텝 active∪halo 확산(+매 step 증분 활성화) = 조밀 S스텝 → energy 비트 동일.
//     2. halo 필요성     — halo *없이*(활성 블록만) 돌면 조밀과 *달라진다*(경계 번짐 누락) → 왜 halo 인가.
//     3. 증분 활성화     — 활성 블록이 번짐 따라 *자라며*(0019 cooling 비-성장과 대조) 조밀 지원과 정확히 일치.
//     4. 재스캔 없음(O(활성)) — halo·활성화가 훑는 셀이 전-격자 N³ ≪, step 마다 활성 비례(재스캔 아님).
//     5. 보존           — 확산은 에너지 보존 → 활성 경로 총에너지 = 초기(상대 오차 기계 정밀도).
//     6. 회귀 0          — opts.active 생략 → 기존 조밀 경로(손 계산 1스텝과 byte 일치).
//     7. 결정론          — 같은 입력 두 번 → 동일 지문.
//   (벽시계 ms 는 머신 의존 → 정보용 출력만, 단언 안 함 — step_0015 정직성 정책.)
//
//   실행: node HTJ/steps/step_0020/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-energy.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 64, BS = 8, ALPHA = 1 / 7;

// 희소 핫스팟 — 중앙 작은 정육면체에 에너지 집중(반지름 밖 정확히 0 = 희소). 번질 여백이 넓다.
function hotspotWorld(half) {
  const w = W.createWorld(N);
  En.seedHotSpot(w, { E0: 1000, half: half != null ? half : 3 });
  return w;
}

// 활성∪halo 확산 한 step + 증분 활성화(이웃 깨움). ActiveSet 를 유지하며 굴린다.
function diffuseActiveStep(w, set, stats) {
  const iter = set.originsWithHalo();                       // 활성 + 6-면 이웃 블록
  En.diffuseEnergy(w, ALPHA, 'energy', { active: iter, blockSize: BS, stats });
  const added = set.activateFrom(w.fields.energy, iter);    // 번져서 비-영이 된 halo 블록 깨움
  return added;
}

// ── 1. 비트 동일(관문) — S스텝 active∪halo(+증분 활성화) = 조밀 S스텝 ──
{
  const S = 15;
  const wd = hotspotWorld();                                // 조밀
  const wa = hotspotWorld();                                // 활성∪halo
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  for (let t = 0; t < S; t++) {
    En.diffuseEnergy(wd, ALPHA);                            // 조밀 전-격자
    diffuseActiveStep(wa, set);                             // 활성∪halo + 깨움
  }
  const same = wd.fingerprint('energy') === wa.fingerprint('energy');
  check('비트 동일(관문) — S스텝 active∪halo 확산(+증분 활성화) = 조밀 S스텝 (energy 비트 동일)',
    same, `energy fp 0x${wa.fingerprint('energy').toString(16)} (동일) · ${S}스텝`);
}

// ── 2. halo 필요성 — halo 없이(활성 블록만) 돌면 조밀과 달라진다 ──
{
  const S = 15;
  const wd = hotspotWorld();
  const wn = hotspotWorld();                                // halo 없는(활성 블록만) 경로
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wn.fields.energy);
  for (let t = 0; t < S; t++) {
    En.diffuseEnergy(wd, ALPHA);
    En.diffuseEnergy(wn, ALPHA, 'energy', { active: set.origins(), blockSize: BS });  // halo 없이!
    // (증분 활성화도 안 함 → 전선이 활성 블록에 갇힘)
  }
  const differs = wd.fingerprint('energy') !== wn.fingerprint('energy');
  // 차이는 경계 번짐 누락 → 활성 블록 밖으로 번진 에너지가 사라져 총량도 다르다.
  const massLost = Math.abs(wd.total('energy') - wn.total('energy')) > 1e-6;
  check('halo 필요성 — halo 없이 활성 블록만 돌면 조밀과 *달라진다*(경계 번짐 누락) → 왜 halo 인가',
    differs && massLost, `조밀 Σ=${wd.total('energy').toFixed(3)} ≠ halo없음 Σ=${wn.total('energy').toFixed(3)}`);
}

// ── 3. 증분 활성화 — 활성 블록이 번짐 따라 자라며 조밀 지원과 정확히 일치 ──
{
  const S = 25;
  const wa = hotspotWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  const before = set.size();
  let grew = false;
  for (let t = 0; t < S; t++) { const added = diffuseActiveStep(wa, set); if (added > 0) grew = true; }
  const after = set.size();
  // 활성 집합이 조밀 지원(비-영 블록)과 정확히 일치하나? — 집합 밖 비-영 셀 0개 + 집합 내 빈 블록 0개.
  const E = wa.fields.energy; let missed = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (E[(z * N + y) * N + x] !== 0 && !set.has(x / BS | 0, y / BS | 0, z / BS | 0)) missed++;
  const denseBlocks = Sp.activeBlockOrigins(E, N, BS).length;   // 조밀 지원 블록 수(ground truth)
  check('증분 활성화 — 활성 블록이 번짐 따라 자라며(0019 비-성장과 대조) 조밀 지원과 정확 일치(missed=0)',
    grew && after > before && missed === 0 && after === denseBlocks,
    `활성 ${before}→${after}블록(자라남) · 조밀 지원 ${denseBlocks}블록 일치 · 집합 밖 비-영 ${missed}셀`);
}

// ── 4. 재스캔 없음(O(활성)) — halo·활성화가 훑는 셀 ≪ 전-격자 N³, step 마다 활성 비례 ──
{
  const wa = hotspotWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  const dense = N * N * N;
  // 한 step 의 halo 순회 작업량 + 활성화 스캔이 전-격자보다 훨씬 적은가?
  const stats = {};
  const iter = set.originsWithHalo();
  En.diffuseEnergy(wa, ALPHA, 'energy', { active: iter, blockSize: BS, stats });
  set.activateFrom(wa.fields.energy, iter);
  const activateScan = set.lastScannedCells();                  // 활성화가 훑은 셀(후보 블록만)
  const haloCells = iter.length * BS * BS * BS;
  check('재스캔 없음(O(활성)) — halo 순회 + 활성화 스캔이 전-격자 N³ ≪ (step 마다 활성 비례, 재스캔 아님)',
    stats.cellsVisited < dense && activateScan < dense && haloCells < dense,
    `halo 방문 ${stats.cellsVisited}셀 · 활성화 스캔 ${activateScan}셀 ≪ 전-격자 ${dense}셀`);
}

// ── 5. 보존 — 확산은 에너지 보존(no-flux 경계) → 활성 경로 총에너지 = 초기 ──
{
  const S = 20;
  const wa = hotspotWorld();
  const E0 = wa.total('energy');
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  for (let t = 0; t < S; t++) diffuseActiveStep(wa, set);
  const E1 = wa.total('energy');
  const rel = Math.abs(E1 - E0) / E0;
  check('보존 — 활성∪halo 확산이 에너지 보존(no-flux 경계) → 총에너지 = 초기(상대 오차 ≤1e-12)',
    rel <= 1e-12, `Σ ${E0.toFixed(6)} → ${E1.toFixed(6)} · rel=${rel.toExponential(1)}`);
}

// ── 6. 회귀 0 — opts.active 생략 → 기존 조밀 경로(손 계산 1스텝과 byte 일치) ──
{
  const w = hotspotWorld();
  const E = w.fields.energy, ref = Float64Array.from(E), NN = N * N;
  // 손 계산 1스텝(조밀 공식 그대로).
  const out = new Float64Array(E.length);
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x, e = ref[i]; let flux = 0;
    if (x > 0) flux += ref[i - 1] - e; if (x < N - 1) flux += ref[i + 1] - e;
    if (y > 0) flux += ref[i - N] - e; if (y < N - 1) flux += ref[i + N] - e;
    if (z > 0) flux += ref[i - NN] - e; if (z < N - 1) flux += ref[i + NN] - e;
    out[i] = e + ALPHA * flux;
  }
  En.diffuseEnergy(w, ALPHA);                                   // opts.active 없음 = 조밀
  let same = true; for (let i = 0; i < out.length; i++) if (out[i] !== E[i]) { same = false; break; }
  check('회귀 0 — opts.active 생략 → 기존 조밀 경로(손 계산 1스텝과 byte 일치)', same, 'dense path 불변');
}

// ── 7. 결정론 — 같은 입력 두 번 → 동일 지문 ──
{
  const a = hotspotWorld(), b = hotspotWorld();
  const sa = Sp.createActiveSet(N, BS).rebuildFromField(a.fields.energy);
  const sb = Sp.createActiveSet(N, BS).rebuildFromField(b.fields.energy);
  for (let t = 0; t < 10; t++) { diffuseActiveStep(a, sa); diffuseActiveStep(b, sb); }
  check('결정론 — 같은 입력 두 번 active∪halo 확산 → 동일 지문', a.fingerprint('energy') === b.fingerprint('energy'),
    `0x${a.fingerprint('energy').toString(16)}`);
}

// ── 벽시계(정보용·머신 의존·비단언) — 활성∪halo vs 조밀 ──
let msDense = 0, msActive = 0;
{
  const S = 100;
  const wd = hotspotWorld();
  let t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) En.diffuseEnergy(wd, ALPHA);
  msDense = Number(process.hrtime.bigint() - t0) / 1e6 / S;
  const wa = hotspotWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) diffuseActiveStep(wa, set);
  msActive = Number(process.hrtime.bigint() - t0) / 1e6 / S;
}

console.log('\n=== step_0020 수치 검증: *번지는* stencil 법칙(확산)을 활성 순회 + halo + 증분 활성화로 일반화 ===');
console.log(`  [정보용·비단언] 벽시계 ms/step: 조밀 ${msDense.toFixed(3)} · 활성∪halo ${msActive.toFixed(3)} → ${(msDense / msActive).toFixed(1)}× (작은 핫스팟, 번질수록 합류).`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

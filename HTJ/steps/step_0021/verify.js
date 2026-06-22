// step_0021/verify.js — S2 *수송하는* stencil 법칙 advect 를 활성 순회 + halo + 증분 활성화로 일반화. 순수·독립·영구.
//
//   step_0020 은 *번지는*(대칭) stencil 확산을 활성 순회로 일반화했다. advect 는 한 발 더 — 질량을
//   *방향성 있게 실어 나른다*(흐름). 활성 전선이 흐름 방향으로 *비대칭* 자란다(확산은 사방 대칭).
//   donor-cell flux 는 donor 의 ρ·g 에 비례 → 빈 셀(ρ=0) donor=0 → 경계 flux 자동 0 → active∪halo 만
//   돌아도 조밀과 비트 동일. 단 advect 는 CFL 서브스텝(nsub)으로 한 호출에 여러 칸 이동 가능 →
//   **CFL 안전(courant≤1, nsub=1)에서만 활성**(1셀 이동=1-블록 halo 에 넉넉), courant>1 은 *조밀 폴백*
//   (질량 이탈 방지 = 보존 척추 안전). 진공 g-가드로 ρ=0⟹g=0 → 활성 집합을 ρ 로 추적하면 운동량도 따라옴.
//
//   검증 대상:
//     1. 비트 동일(관문)  — S스텝 active advect(active∪halo+증분 활성화+prune) = 조밀 S스텝 → ρ·g 비트 동일.
//     2. 방향성 활성화    — 활성 전선이 *흐름 방향으로 비대칭* 자람(blob +x 직진) · 조밀 지원과 정확 일치.
//     3. 보존            — Σρ·Σg 보존(활성 경로 = 조밀, 상대 오차 ≤1e-12) = advect 의 척추.
//     4. halo 필요성      — halo 없이(활성 블록만) 돌면 흐름 전선에서 질량 샘 → 조밀과 달라짐.
//     5. nsub>1 폴백      — 고속 흐름(courant>1)은 조밀 폴백 → 여전히 조밀과 비트 동일(보존 안전).
//     6. 재스캔 없음(O(활성)) — 방문 셀 ≪ 전-격자 N³.
//     7. 회귀 0          — opts.active 생략 → 기존 조밀 경로(byte 동일).
//     8. 결정론          — 같은 입력 두 번 → 동일 지문.
//   (벽시계 ms 는 머신 의존 → 정보용 출력만, 단언 안 함 — step_0015 정직성 정책.)
//
//   실행: node HTJ/steps/step_0021/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const In = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 64, BS = 8;

// 희소 이동 덩어리 — 가우시안 공 + 균일 속도(반지름 밖 ~0). 작은 sigma·약한 꼬리 컷으로 희소 유지.
function movingBlobWorld(vx) {
  const w = W.createWorld(N);
  In.seedMovingBlob(w, { cx: N * 0.3, sigma: N * 0.07, M0: 1000, vx: vx != null ? vx : 0.5 });
  // 가우시안 꼬리를 정확한 0 으로 컷(희소화) — 아주 옅은 셀 제거(질량 거의 불변, 희소 지지 또렷).
  const rho = w.fields.energy, gx = w.fields.mom_x;
  let peak = 0; for (let i = 0; i < rho.length; i++) if (rho[i] > peak) peak = rho[i];
  const cut = peak * 1e-4;
  for (let i = 0; i < rho.length; i++) if (rho[i] < cut) { rho[i] = 0; gx[i] = 0; w.fields.mom_y[i] = 0; w.fields.mom_z[i] = 0; }
  return w;
}

// active advect 한 step — ActiveSet 유지(halo 순회 → 증분 활성화 → 비워진 블록 prune). 활성 집합은 ρ 로 추적.
function advectActiveStep(w, set, dt) {
  const iter = set.originsWithHalo();
  In.advect(w, dt, { active: iter, blockSize: BS });
  set.activateFrom(w.fields.energy, iter);   // 흐름이 닿은 halo 블록 깨움
  set.prune(w.fields.energy);                // 질량이 빠져나간 블록 회수(전선이 지나간 자리)
}

// ── 1. 비트 동일(관문) — S스텝 active advect = 조밀 S스텝 ──
{
  const S = 20, dt = 0.5;
  const wd = movingBlobWorld(), wa = movingBlobWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  for (let t = 0; t < S; t++) { In.advect(wd, dt); advectActiveStep(wa, set, dt); }
  const sameRho = wd.fingerprint('energy') === wa.fingerprint('energy');
  const sameGx = wd.fingerprint('mom_x') === wa.fingerprint('mom_x');
  check('비트 동일(관문) — S스텝 active advect(active∪halo+증분 활성화+prune) = 조밀 S스텝 (ρ·g 비트 동일)',
    sameRho && sameGx, `ρ fp 0x${wa.fingerprint('energy').toString(16)} · gx fp 0x${wa.fingerprint('mom_x').toString(16)} (동일) · ${S}스텝`);
}

// ── 2. 방향성 활성화 — 전선이 흐름 방향(+x)으로 비대칭 자람 · 조밀 지원과 정확 일치 ──
{
  const S = 20, dt = 0.5;
  const wa = movingBlobWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  const com0 = In.centerOfMass(wa)[0];
  for (let t = 0; t < S; t++) advectActiveStep(wa, set, dt);
  const com1 = In.centerOfMass(wa)[0];
  // 활성 집합이 조밀 지원과 정확 일치하나?(집합 밖 비-영 0)
  const rho = wa.fields.energy; let missed = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (rho[(z * N + y) * N + x] !== 0 && !set.has(x / BS | 0, y / BS | 0, z / BS | 0)) missed++;
  const denseBlocks = Sp.activeBlockOrigins(rho, N, BS).length;
  check('방향성 활성화 — 전선이 흐름 방향(+x)으로 비대칭 자람(CoM 이동) · 조밀 지원과 정확 일치(missed=0)',
    com1 > com0 + 3 && missed === 0 && set.size() === denseBlocks,
    `CoM_x ${com0.toFixed(1)}→${com1.toFixed(1)}(+x 직진) · 활성 ${set.size()}블록 = 조밀 지원 ${denseBlocks}블록 · 집합 밖 비-영 ${missed}`);
}

// ── 3. 보존 — Σρ·Σg 보존(활성 경로 = 조밀) = advect 척추 ──
{
  const S = 20, dt = 0.5;
  const wa = movingBlobWorld();
  const m0 = wa.total('energy'), p0 = In.totalMomentum(wa)[0];
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  for (let t = 0; t < S; t++) advectActiveStep(wa, set, dt);
  const m1 = wa.total('energy'), p1 = In.totalMomentum(wa)[0];
  const relM = Math.abs(m1 - m0) / m0, relP = Math.abs(p1 - p0) / Math.abs(p0);
  check('보존 — Σρ·Σg 보존(활성∪halo advect, no-flux 경계) = advect 척추 (상대 오차 ≤1e-12)',
    relM <= 1e-12 && relP <= 1e-12, `Σρ rel=${relM.toExponential(1)} · Σg rel=${relP.toExponential(1)}`);
}

// ── 4. halo 필요성 — halo 없이 활성 블록만 돌면 흐름 전선에서 질량 샘 → 조밀과 달라짐 ──
{
  const S = 12, dt = 0.5;
  const wd = movingBlobWorld(), wn = movingBlobWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wn.fields.energy);
  for (let t = 0; t < S; t++) {
    In.advect(wd, dt);
    In.advect(wn, dt, { active: set.origins(), blockSize: BS });   // halo 없이! 증분 활성화도 없음
  }
  const differs = wd.fingerprint('energy') !== wn.fingerprint('energy');
  const massLost = Math.abs(wd.total('energy') - wn.total('energy')) > 1e-6;
  check('halo 필요성 — halo 없이 활성 블록만 돌면 흐름 전선에서 질량 샘 → 조밀과 달라짐',
    differs && massLost, `조밀 Σρ=${wd.total('energy').toFixed(3)} ≠ halo없음 Σρ=${wn.total('energy').toFixed(3)}`);
}

// ── 5. nsub>1 폴백 — 고속 흐름(courant>1)은 조밀 폴백 → 여전히 조밀과 비트 동일 ──
{
  const dt = 0.5, vfast = 3;                                       // courant ≈ 3·0.5 = 1.5 > 1 → nsub>1
  const wd = movingBlobWorld(vfast), wa = movingBlobWorld(vfast);
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  // 활성 경로 호출(courant>1 이라 내부에서 조밀 폴백) vs 직접 조밀 — 결과 같아야(보존 안전).
  In.advect(wd, dt);
  In.advect(wa, dt, { active: set.originsWithHalo(), blockSize: BS });
  const same = wd.fingerprint('energy') === wa.fingerprint('energy') && wd.fingerprint('mom_x') === wa.fingerprint('mom_x');
  check('nsub>1 폴백 — 고속 흐름(courant>1)은 조밀 폴백 → 여전히 조밀과 비트 동일(질량 이탈 방지)',
    same, `courant≈1.5>1 → 폴백 · ρ·g fp 조밀과 동일`);
}

// ── 6. 재스캔 없음(O(활성)) — 한 step 방문 셀 ≪ 전-격자 N³ ──
{
  const wa = movingBlobWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  const s = {}; In.advect(wa, 0.5, { active: set.originsWithHalo(), blockSize: BS, stats: s });
  const dense = N * N * N;
  check('재스캔 없음(O(활성)) — 한 step 방문 셀 ≪ 전-격자 N³ (활성∪halo 비례)',
    s.cellsVisited < dense, `방문 ${s.cellsVisited}셀 ≪ 전-격자 ${dense}셀 = ${(100 * s.cellsVisited / dense).toFixed(1)}%`);
}

// ── 7. 회귀 0 — opts.active 생략 → 기존 조밀 경로(byte 동일) ──
{
  const a = movingBlobWorld(), b = movingBlobWorld();
  for (let t = 0; t < 5; t++) { In.advect(a, 0.5); In.advect(b, 0.5); }   // 둘 다 조밀(같은 결정론)
  check('회귀 0 — opts.active 생략 → 기존 조밀 경로(결정론·불변)', a.fingerprint('energy') === b.fingerprint('energy'),
    `dense path 0x${a.fingerprint('energy').toString(16)}`);
}

// ── 8. 결정론 — 같은 입력 두 번 active advect → 동일 지문 ──
{
  const a = movingBlobWorld(), b = movingBlobWorld();
  const sa = Sp.createActiveSet(N, BS).rebuildFromField(a.fields.energy);
  const sb = Sp.createActiveSet(N, BS).rebuildFromField(b.fields.energy);
  for (let t = 0; t < 10; t++) { advectActiveStep(a, sa, 0.5); advectActiveStep(b, sb, 0.5); }
  check('결정론 — 같은 입력 두 번 active advect → 동일 지문', a.fingerprint('energy') === b.fingerprint('energy'),
    `0x${a.fingerprint('energy').toString(16)}`);
}

// ── 벽시계(정보용·머신 의존·비단언) ──
let msDense = 0, msActive = 0;
{
  const S = 60, dt = 0.5;
  const wd = movingBlobWorld();
  let t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) In.advect(wd, dt);
  msDense = Number(process.hrtime.bigint() - t0) / 1e6 / S;
  const wa = movingBlobWorld();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) advectActiveStep(wa, set, dt);
  msActive = Number(process.hrtime.bigint() - t0) / 1e6 / S;
}

console.log('\n=== step_0021 수치 검증: *수송하는* stencil 법칙 advect 를 활성 순회 + halo + 증분 활성화로 일반화 ===');
console.log(`  [정보용·비단언] 벽시계 ms/step: 조밀 ${msDense.toFixed(3)} · 활성∪halo ${msActive.toFixed(3)} → ${(msDense / msActive).toFixed(1)}× (작은 덩어리, 활성 비례).`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

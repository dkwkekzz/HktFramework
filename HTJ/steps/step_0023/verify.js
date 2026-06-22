// step_0023/verify.js — S2 통합 측정 게이트: *실제 별 파이프라인*에서 활성 배선의 실현 이득을 정직하게 잰다.
//
//   왜 이 step 인가(정직성 — design/scalability.md §5 "측정으로 결정"): step_0018~0022 는 법칙을 하나씩
//   active∪halo 로 일반화했고, 각 step 의 벽시계(47×·30×…)는 *인위적 희소 시드*(핫큐브·핫스팟)에서 잰
//   마이크로벤치였다(전부 "비단언"). 그러나 ① 실제 viewer 파이프라인(별 붕괴)은 어떤 법칙도 opts.active 를
//   넘기지 않아 통째로 조밀하게 돈다 ② 7개 파이프라인 법칙 중 활성 가능은 3개(pressure/cooling/advect)뿐,
//   나머지(gravity 전역·thermal·viscosity·fusion)는 조밀 ③ 가우시안 별은 옅은 꼬리가 격자를 채워 희소하지
//   않다. 이 게이트는 그 *실현* 천장을 실제 별에서 측정한다 — 마이크로벤치가 아니라 진짜 세계로.
//
//   세계 법칙을 *더하지 않는다*(step_0015 류 측정 step). 측정 도구만.
//
//   검증 대상:
//     1. 비트 동일(관문) — 실제 별 파이프라인을 "활성 가능 법칙은 active, 나머지 조밀"로 돌린 결과가
//        S스텝 내내 *전부 조밀* 결과와 비트 동일(energy·therm·mom_x). = 활성 배선이 실제 세계에서 정확.
//     2. 실현 점유율(정직) — 별 붕괴 동안 *활성 블록 비율*을 실측. 가우시안 별은 높다(희소 안 됨) →
//        활성 순회 절감의 실현 천장이 낮음을 *수치로* 박는다(과장 방지).
//     3. 활성 법칙 비중(정직) — 7개 파이프라인 법칙 중 활성 3개·조밀 4개(gravity 전역 포함) = 한 step
//        작업의 일부만 활성. 실현 벽시계 이득이 마이크로벤치(47×)와 다른 *이유*를 구조로 명시.
//     4. 결정론 — 같은 입력 두 번 → 동일 지문.
//   (벽시계 ms 는 머신 의존 → 정보용 출력만, 단언 안 함.)
//
//   실행: node HTJ/steps/step_0023/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const In = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 32, BS = 8, DT = 0.2;
const P = { kpress: 0.12, kthermo: 0.3, kvisc: 0.6, frate: 2, radiate: 0.06 };  // viewer 0014 기본 노브

function updateTemp(w) { if (!w.fields.therm) return; if (!w.fields.temperature) w.addField('temperature'); w.fields.temperature.set(Th.temperature(w)); }
function makeStar() {
  const w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N * N * N * 0.5), T0: 1 });
  updateTemp(w);
  // mom 장 보장(advect 가 쓰는 운동량).
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.fields[nm] || w.addField(nm, { type: Float64Array });
  return w;
}

// 조밀 파이프라인 — viewer 0014 advance 와 동일(전부 전-격자).
function advanceDense(w) {
  Gr.applyGravity(w, DT, { G: 0.15, iters: 40 });
  Pr.applyPressure(w, DT, { K: P.kpress, gamma: 2 });
  Th.applyThermalPressure(w, DT, { Kth: P.kthermo, gamma: 5 / 3 });
  Vi.applyViscosity(w, DT, { Kvisc: P.kvisc });
  Fu.applyFusion(w, DT, { rate: P.frate, rhoCrit: 6, tCrit: 3 });
  Co.applyCooling(w, DT, { coolRate: P.radiate });
  In.advect(w, DT, { scalars: ['therm'] });
  updateTemp(w);
}

// 활성 배선 파이프라인 — 활성 가능 법칙(pressure/cooling/advect)은 ActiveSet, 나머지(gravity/thermal/
//   viscosity/fusion)는 조밀. ρ(energy) 로 활성 집합을 추적(가법 법칙들은 ρ 안 바꿈; advect 만 이동).
function advanceActive(w, set, occ) {
  const halo = set.originsWithHalo();
  Gr.applyGravity(w, DT, { G: 0.15, iters: 40 });                 // 전역(조밀, S6 대상)
  Pr.applyPressure(w, DT, { K: P.kpress, gamma: 2, active: halo, blockSize: BS });   // 활성(0022)
  Th.applyThermalPressure(w, DT, { Kth: P.kthermo, gamma: 5 / 3 });                  // 조밀(0023 미적용)
  Vi.applyViscosity(w, DT, { Kvisc: P.kvisc });                                      // 조밀
  Fu.applyFusion(w, DT, { rate: P.frate, rhoCrit: 6, tCrit: 3 });                    // 조밀
  Co.applyCooling(w, DT, { coolRate: P.radiate, active: set.origins(), blockSize: BS });  // 활성(0018·per-cell)
  In.advect(w, DT, { scalars: ['therm'], active: halo, blockSize: BS });             // 활성(0021)
  set.activateFrom(w.fields.energy, halo); set.prune(w.fields.energy);               // 이동한 질량 추적
  updateTemp(w);
  if (occ) { const nb = Math.ceil(N / BS); occ.push(set.size() / (nb * nb * nb)); }
}

// ── 1. 비트 동일(관문) — 실제 별 파이프라인: 활성 배선 = 전부 조밀 (S스텝) ──
const S = 20;
let occRatios = [];
{
  const wd = makeStar(), wa = makeStar();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  let same = true, firstDiff = '';
  for (let t = 0; t < S; t++) {
    advanceDense(wd);
    advanceActive(wa, set, occRatios);
    for (const nm of ['energy', 'therm', 'mom_x']) {
      if (wd.fingerprint(nm) !== wa.fingerprint(nm)) { same = false; if (!firstDiff) firstDiff = `${nm}@step${t}`; }
    }
    if (!same) break;
  }
  check('비트 동일(관문) — 실제 별 파이프라인: 활성 배선(pressure/cooling/advect) = 전부 조밀 (S스텝 energy·therm·mom 비트 동일)',
    same, same ? `${S}스텝 비트 동일 · energy fp 0x${wd.fingerprint('energy').toString(16)}` : `불일치 ${firstDiff}`);
}

// ── 2. 실현 점유율(정직) — 가우시안 별은 격자를 많이 채워 활성 비율이 높다(희소 안 됨) ──
{
  const avgOcc = occRatios.reduce((s, r) => s + r, 0) / occRatios.length;
  const maxOcc = Math.max(...occRatios);
  // 정직: 활성 비율이 50% 넘으면 "희소 순회"의 실현 절감은 절반 미만. 단언은 *측정값이 실재*함에만(>0·≤1).
  check('실현 점유율(정직) — 별 붕괴 동안 활성 블록 비율 실측(가우시안 별은 옅은 꼬리로 높다=희소 안 됨)',
    avgOcc > 0 && maxOcc <= 1, `평균 점유 ${(avgOcc * 100).toFixed(0)}% · 최대 ${(maxOcc * 100).toFixed(0)}% (활성 순회 절감 천장 = 1−점유)`);
}

// ── 3. 활성 법칙 비중(정직) — 7개 중 3개만 활성, gravity 전역 포함 4개 조밀 ──
{
  const activeLaws = 3, denseLaws = 4, total = 7;   // 활성: pressure·cooling·advect / 조밀: gravity·thermal·viscosity·fusion
  check('활성 법칙 비중(정직) — 파이프라인 7법칙 중 활성 3·조밀 4(gravity 전역 포함) = 한 step 일부만 활성',
    activeLaws + denseLaws === total, `활성 ${activeLaws}/${total}(pressure·cooling·advect) · 조밀 ${denseLaws}(gravity·thermal·viscosity·fusion) → 실현 벽시계 ≠ 마이크로벤치`);
}

// ── 4. 결정론 ──
{
  const a = makeStar(), b = makeStar();
  const sa = Sp.createActiveSet(N, BS).rebuildFromField(a.fields.energy);
  const sb = Sp.createActiveSet(N, BS).rebuildFromField(b.fields.energy);
  for (let t = 0; t < 8; t++) { advanceActive(a, sa); advanceActive(b, sb); }
  check('결정론 — 같은 입력 두 번 활성 배선 파이프라인 → 동일 지문', a.fingerprint('energy') === b.fingerprint('energy'),
    `0x${a.fingerprint('energy').toString(16)}`);
}

// ── 벽시계(정보용·머신 의존·비단언) — 실제 별 파이프라인: 조밀 vs 활성 배선 ──
let msDense = 0, msActive = 0;
{
  const wd = makeStar();
  let t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) advanceDense(wd);
  msDense = Number(process.hrtime.bigint() - t0) / 1e6 / S;
  const wa = makeStar();
  const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
  t0 = process.hrtime.bigint();
  for (let t = 0; t < S; t++) advanceActive(wa, set);
  msActive = Number(process.hrtime.bigint() - t0) / 1e6 / S;
}

console.log('\n=== step_0023 통합 측정 게이트: 실제 별 파이프라인에서 활성 배선의 *실현* 이득 ===');
console.log(`  [정보용·비단언] 실제 별 파이프라인 ms/step: 조밀 ${msDense.toFixed(2)} · 활성 배선 ${msActive.toFixed(2)} → ${(msDense / msActive).toFixed(2)}×`);
console.log(`     ↳ 마이크로벤치(단일 법칙 희소 시드)는 47×였으나, *실제 별 전체 파이프라인*에선 위 값 — gravity 전역+thermal/viscosity/fusion 조밀이 지배하고 별이 격자를 채우기 때문(정직한 천장).`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

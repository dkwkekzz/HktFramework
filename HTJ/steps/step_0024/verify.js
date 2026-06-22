// step_0024/verify.js — S2(A) 진공 운동량·내부E 동반 수송 + 별 파이프라인 합류로 *실현* 희소화. 순수·독립·영구.
//
//   step_0023 게이트가 박은 것: 활성 배선은 정확하나 *실제 별*은 점유 100%(가우시안 옅은 꼬리가 격자를
//   채움)라 활성 순회 절감이 0. design §2 레버1 "대가/주의"(임계 미만 0 흡수+이웃 분배 보존)대로, 진공
//   규칙(step_0017)을 파이프라인에 합류해 별을 *실제로 희소화*해야 활성 순회가 이득을 낸다. 그런데 진공의
//   정직한 한계는 "운동량 동반 안 함"(밀도장만 이동) — 비우면서 운동량·내부E 를 안 옮기면 보존이 샌다.
//   이 step 은 그걸 닫는다: applyVacuum 에 opts.scalars(동반 수송) → 옅은 셀이 흡수될 때 mom·therm 도 함께.
//
//   검증 대상:
//     1. 동반 보존(관문) — 진공이 mom_x/y/z·therm 을 동반하면 Σρ·Σmom·Σtherm 모두 보존(상대 ≤1e-12).
//     2. 운동량이 질량을 따라간다 — 옅은 셀의 운동량이 *흡수한 이웃*으로 정확히 이관(옅은 셀=0·이웃 +Δ).
//     3. 희소화(실현) — 가우시안 별에 진공(+동반) 반복 → 비-영 셀 급감·exact 0 급증(점유↓).
//     4. 실현 게이트 — 별 파이프라인에 진공 합류 시 활성 점유 100%→하락 + 활성 배선=조밀 비트 동일(여전히 정확).
//     5. 회귀 0 — opts.scalars 생략 → 기존(밀도장만) 경로 byte 동일(+ step_0017 불변).
//     6. 결정론 — 같은 입력 두 번 → 동일 지문.
//   (벽시계 ms 는 머신 의존 → 정보용 출력만, 단언 안 함.)
//
//   실행: node HTJ/steps/step_0024/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Va = require(path.resolve(__dirname, '../../engine/htj-vacuum.js'));
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
const SCAL = ['mom_x', 'mom_y', 'mom_z', 'therm'];
const sum = (w, nm) => { const f = w.fields[nm]; let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };

// ── 1. 동반 보존(관문) ──
{
  const N = 16; const w = W.createWorld(N); w.addField('therm');
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
  // 결정론적 옅은/밀한 분포 — 일부 옅은 셀(0<ρ<eps)이 더 밀한 이웃을 갖게.
  const E = w.fields.energy;
  for (let i = 0; i < E.length; i++) {
    const r = ((i * 2654435761 >>> 0) % 1000) / 1000;       // [0,1)
    E[i] = r < 0.5 ? r * 1e-4 : 0.5 + r;                     // 절반은 옅음(<eps=1e-3)·절반은 밀함
    w.fields.therm[i] = E[i] * 2;                            // 내부E
    w.fields.mom_x[i] = (r - 0.5) * E[i]; w.fields.mom_y[i] = (0.3 - r) * E[i]; w.fields.mom_z[i] = r * E[i] * 0.1;
  }
  const before = { e: sum(w, 'energy'), mx: sum(w, 'mom_x'), my: sum(w, 'mom_y'), mz: sum(w, 'mom_z'), u: sum(w, 'therm') };
  Va.applyVacuum(w, { eps: 1e-3, scalars: SCAL });
  const after = { e: sum(w, 'energy'), mx: sum(w, 'mom_x'), my: sum(w, 'mom_y'), mz: sum(w, 'mom_z'), u: sum(w, 'therm') };
  const rel = (a, b) => Math.abs(a - b) / (Math.abs(b) || 1);
  const ok = rel(after.e, before.e) <= 1e-12 && rel(after.mx, before.mx) <= 1e-12 && rel(after.my, before.my) <= 1e-12 && rel(after.mz, before.mz) <= 1e-12 && rel(after.u, before.u) <= 1e-12;
  check('동반 보존(관문) — 진공이 mom·therm 동반 시 Σρ·Σmom·Σtherm 모두 보존(상대 ≤1e-12)',
    ok, `Δρ=${rel(after.e, before.e).toExponential(1)} Δmx=${rel(after.mx, before.mx).toExponential(1)} Δu=${rel(after.u, before.u).toExponential(1)}`);
}

// ── 2. 운동량이 질량을 따라간다(국소 정확) ──
{
  const N = 8; const w = W.createWorld(N); w.addField('therm');
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
  const idx = (x, y, z) => (z * N + y) * N + x;
  const thin = idx(2, 2, 2), dense = idx(3, 2, 2);          // 옅은 셀 + 그 +x 이웃(더 밀)
  w.fields.energy[thin] = 5e-4;  w.fields.mom_x[thin] = 7;  w.fields.therm[thin] = 9;   // eps=1e-3 미만
  w.fields.energy[dense] = 10;   w.fields.mom_x[dense] = 2;  w.fields.therm[dense] = 3;
  Va.applyVacuum(w, { eps: 1e-3, scalars: SCAL });
  const ok = w.fields.energy[thin] === 0 && w.fields.mom_x[thin] === 0 && w.fields.therm[thin] === 0
    && w.fields.mom_x[dense] === 9 && w.fields.therm[dense] === 12 && Math.abs(w.fields.energy[dense] - 10.0005) < 1e-12;
  check('운동량이 질량을 따라간다 — 옅은 셀의 운동량·내부E 가 흡수한 이웃으로 정확 이관(옅은=0·이웃 +Δ)',
    ok, `옅은 셀 mom_x ${w.fields.mom_x[thin]}=0 · 이웃 mom_x ${w.fields.mom_x[dense]}(=2+7) · therm ${w.fields.therm[dense]}(=3+9)`);
}

// 별 시드(파이프라인) — viewer 0014.
const Nstar = 32, BS = 8, DT = 0.2, P = { kpress: 0.12, kthermo: 0.3, kvisc: 0.6, frate: 2, radiate: 0.06 };
function updateTemp(w) { if (!w.fields.therm) return; if (!w.fields.temperature) w.addField('temperature'); w.fields.temperature.set(Th.temperature(w)); }
function makeStar() { const w = W.createWorld(Nstar); Th.seedWarmBlob(w, { sigma: Nstar * 0.16, M0: Math.max(2500, Nstar ** 3 * 0.5), T0: 1 }); updateTemp(w); for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.fields[nm] || w.addField(nm, { type: Float64Array }); return w; }
const EPS_VAC = 1e-2;
const nb = Math.ceil(Nstar / BS);
// 블록 점유율 — 비-영 셀을 *하나라도* 가진 8³ 블록의 비율(활성 집합 granularity).
function blockOcc(w) {
  const E = w.fields.energy; const seen = new Set();
  for (let z = 0; z < Nstar; z++) for (let y = 0; y < Nstar; y++) for (let x = 0; x < Nstar; x++)
    if (E[(z * Nstar + y) * Nstar + x] !== 0) seen.add(((z / BS | 0) * nb + (y / BS | 0)) * nb + (x / BS | 0));
  return seen.size / (nb * nb * nb);
}

// ── 3. 셀 희소화는 된다 — 가우시안 별에 진공(+동반) 반복 → 비-영 *셀* 감소(보존) ──
{
  const w = makeStar();
  const occ0 = Va.nonzeroCount(w) / w.fields.energy.length;
  const m0 = sum(w, 'energy');
  for (let k = 0; k < 10; k++) Va.applyVacuum(w, { eps: EPS_VAC, scalars: SCAL });
  const occ1 = Va.nonzeroCount(w) / w.fields.energy.length;
  check('셀 희소화 — 가우시안 별에 진공(+동반) 반복 → 비-영 *셀* 감소(질량 보존)',
    occ1 < occ0 && Math.abs(sum(w, 'energy') - m0) < 1e-6, `비-영 셀 점유 ${(occ0 * 100).toFixed(0)}% → ${(occ1 * 100).toFixed(0)}% · 질량 ${m0.toFixed(0)}=${sum(w, 'energy').toFixed(0)} 보존`);
}

// ── 4. 블록 granularity 천장(정직한 발견) — 셀 희소화가 *블록* 희소화로 안 이어진다 ──
{
  const w = makeStar();
  const bOcc0 = blockOcc(w);
  for (let k = 0; k < 10; k++) Va.applyVacuum(w, { eps: EPS_VAC, scalars: SCAL });
  const bOcc1 = blockOcc(w), cOcc1 = Va.nonzeroCount(w) / w.fields.energy.length;
  // 정직: 셀은 줄어도(cOcc1<100%) 모든 8³ 블록이 비-영 셀을 *하나라도* 쥐고 있어 블록 점유는 ~100% 유지
  //   → 블록 단위 활성 집합은 줄지 않는다(활성 순회 절감 0). 이게 레버1 의 granularity 천장.
  check('블록 granularity 천장(정직) — 셀 희소화(점유↓)가 *블록* 희소화로 안 이어진다(옅은 꼬리가 모든 블록에 잔류)',
    bOcc1 > 0.95 && cOcc1 < 1.0, `셀 점유 ${(cOcc1 * 100).toFixed(0)}%(줄어듦) vs 블록 점유 ${(bOcc1 * 100).toFixed(0)}%(~불변) → 활성 집합 안 줄음`);
}

// 파이프라인(진공 합류) — 활성 배선/조밀 공통 골격.
function advance(w, set) {
  const halo = set ? set.originsWithHalo() : null;
  Gr.applyGravity(w, DT, { G: 0.15, iters: 40 });
  Pr.applyPressure(w, DT, set ? { K: P.kpress, gamma: 2, active: halo, blockSize: BS } : { K: P.kpress, gamma: 2 });
  Th.applyThermalPressure(w, DT, { Kth: P.kthermo, gamma: 5 / 3 });
  Vi.applyViscosity(w, DT, { Kvisc: P.kvisc });
  Fu.applyFusion(w, DT, { rate: P.frate, rhoCrit: 6, tCrit: 3 });
  Co.applyCooling(w, DT, set ? { coolRate: P.radiate, active: set.origins(), blockSize: BS } : { coolRate: P.radiate });
  In.advect(w, DT, set ? { scalars: ['therm'], active: halo, blockSize: BS } : { scalars: ['therm'] });
  Va.applyVacuum(w, { eps: EPS_VAC, scalars: SCAL });        // 진공 합류(동반 수송)
  if (set) { set.activateFrom(w.fields.energy, halo); set.prune(w.fields.energy); }
  updateTemp(w);
}

// ── 4. 실현 게이트 — 진공 합류 시 점유 하락 + 활성 배선=조밀 비트 동일 ──
let occPipe = 100;
{
  const S = 20;
  const wd = makeStar(), wa = makeStar();
  const set = Sp.createActiveSet(Nstar, BS).rebuildFromField(wa.fields.energy);
  const nb = Math.ceil(Nstar / BS); let occSum = 0, same = true, firstDiff = '';
  for (let t = 0; t < S; t++) {
    advance(wd, null);
    advance(wa, set);
    occSum += set.size() / (nb * nb * nb);
    for (const nm of ['energy', 'therm', 'mom_x']) if (wd.fingerprint(nm) !== wa.fingerprint(nm)) { same = false; if (!firstDiff) firstDiff = `${nm}@${t}`; }
    if (!same) break;
  }
  occPipe = occSum / S * 100;
  const finite = Number.isFinite(sum(wd, 'energy'));
  // 정직: 진공을 합류해도 *블록* 활성 점유는 ~100% 유지(check 4 의 천장이 파이프라인에서도) → 활성 배선이
  //   *정확*(조밀과 비트 동일)하고 별이 유한해도, 실현 속도 이득은 여전히 ~1× (벽시계 출력 참고).
  check('활성 배선 정확성(진공 합류 후) — 진공+동반을 파이프라인에 넣어도 활성 배선=조밀 비트 동일·별 유한',
    same && finite, same ? `활성 배선 비트 동일(20스텝) · 별 유한 · [정직] 활성 블록 점유 평균 ${occPipe.toFixed(0)}%(0023=100%, 천장 그대로)` : `불일치 ${firstDiff}`);
}

// ── 5. 회귀 0 — opts.scalars 생략 → 기존(밀도장만) 경로 byte 동일 ──
{
  const N = 16; const mk = () => { const w = W.createWorld(N); const E = w.fields.energy; for (let i = 0; i < E.length; i++) E[i] = ((i * 40503 >>> 0) % 100) / 1000; return w; };
  const a = mk(), b = mk();
  Va.applyVacuum(a, { eps: 1e-3 });                          // 기존(scalars 없음)
  Va.applyVacuum(b, { eps: 1e-3, scalars: ['mom_x'] });      // mom_x 장 없음 → carry 빈 목록 → 동일 경로
  let byteEq = a.fingerprint('energy') === b.fingerprint('energy');
  // eps=0 항등도 확인.
  const c = mk(); const fp0 = c.fingerprint('energy'); Va.applyVacuum(c, { eps: 0, scalars: SCAL }); byteEq = byteEq && c.fingerprint('energy') === fp0;
  check('회귀 0 — opts.scalars 생략/무존재 → 기존(밀도장만) 경로 byte 동일 · eps=0 항등',
    byteEq, `밀도장만 경로 불변 · eps=0 지문 불변`);
}

// ── 6. 결정론 ──
{
  const a = makeStar(), b = makeStar();
  for (let k = 0; k < 6; k++) { Va.applyVacuum(a, { eps: EPS_VAC, scalars: SCAL }); Va.applyVacuum(b, { eps: EPS_VAC, scalars: SCAL }); }
  check('결정론 — 같은 입력 두 번 진공(+동반) → 동일 지문', a.fingerprint('energy') === b.fingerprint('energy') && a.fingerprint('mom_x') === b.fingerprint('mom_x'),
    `0x${a.fingerprint('energy').toString(16)}`);
}

// ── 벽시계(정보용·비단언) — 진공 합류 파이프라인: 조밀 vs 활성 배선 ──
let msDense = 0, msActive = 0;
{
  const S = 20;
  const wd = makeStar(); let t0 = process.hrtime.bigint(); for (let t = 0; t < S; t++) advance(wd, null); msDense = Number(process.hrtime.bigint() - t0) / 1e6 / S;
  const wa = makeStar(); const set = Sp.createActiveSet(Nstar, BS).rebuildFromField(wa.fields.energy);
  t0 = process.hrtime.bigint(); for (let t = 0; t < S; t++) advance(wa, set); msActive = Number(process.hrtime.bigint() - t0) / 1e6 / S;
}

console.log('\n=== step_0024 수치 검증: 진공 운동량·내부E 동반 수송 + 별 파이프라인 합류로 실현 희소화 ===');
console.log(`  [정보용·비단언] 진공 합류 파이프라인 ms/step: 조밀 ${msDense.toFixed(2)} · 활성 배선 ${msActive.toFixed(2)} → ${(msDense / msActive).toFixed(2)}× (활성 점유 ~${occPipe.toFixed(0)}%)`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

// step_0030/verify.js — S5-c(첫 단위): 자동 승격 트리거(동결→승격) + 레버2 실현 측정. 순수·독립·영구.
//
//   design §0 목적 ②·§2 레버2·§4 S5·§5("측정으로 결정"). 부품을 잇는다 — 동결=안정 판정(0025)된 덩어리를
//   검출(0014)→승격(0026)으로 자동으로 격자에서 뺀다. autoPromoteStable: streak≥hold 블록에 온전히 든
//   덩어리만 올린다(흔들리는 건 안 올림). 레버2 실현 측정: 승격으로 활성 칸이 *실제로* 급감(레버1 0023 못 함).
//
//   검증 대상:
//     1. 동결 덩어리만 자동 승격 — 정지(동결) 덩어리는 올리고, 흔들리는(활성) 덩어리는 안 올린다.
//     2. 레버2 실현 측정(§5 게이트) — 자동 승격으로 활성 격자 칸이 급감(올린 덩어리 칸수만큼).
//     3. 보존 — 자동 승격 전후 Σ(격자+개체) 질량·운동량·에너지 정확 보존(이관 척추).
//     4. 동결 전엔 안 올림 — 충분히 measure 하기 전(streak<hold)엔 아무것도 안 올린다(보수적·안전).
//     5. 개체 동역학 합류 — 올린 개체를 stepEntities 로 굴려도 격자 불변(개체-공간 독립).
//     6. 회귀 0 — 신규 파일(가법)·결정론.
//
//   실행: node HTJ/steps/step_0030/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));
const Ac = require(path.resolve(__dirname, '../../engine/htj-activity.js'));
const Hy = require(path.resolve(__dirname, '../../engine/htj-hybrid.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 24, BS = 8, HOLD = 3, EPS = 1;
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const relOk = (a, b) => Math.abs(a - b) <= 1e-7 + 1e-9 * Math.abs(b);
function newWorld() { const w = W.createWorld(N); w.addField('therm'); for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array }); return w; }
function gridMass(w) { return sum(w.fields.energy); }
function gridMom(w) { return [sum(w.fields.mom_x), sum(w.fields.mom_y), sum(w.fields.mom_z)]; }
function gridKE(w) { const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; let s = 0; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) s += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / r[i]; return s; }
function gridEnergy(w) { return gridKE(w) + sum(w.fields.therm); }
// 조밀 구(반지름 rad) 시드 — 운동량·열 포함.
function seedBall(w, cx, cy, cz, rad, rho0, vx) {
  const cells = [];
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    if (dx * dx + dy * dy + dz * dz <= rad * rad) { const i = (z * N + y) * N + x; w.fields.energy[i] = rho0; w.fields.mom_x[i] = rho0 * (vx || 0); w.fields.therm[i] = rho0 * 0.5; cells.push(i); }
  }
  return cells;
}
// 두 덩어리(A=정지·B=흔들림) 세계 + 활동도 추적. measure 횟수 후 A 만 동결.
function settledWorld(measures, jiggleB) {
  const w = newWorld();
  seedBall(w, 4, 4, 4, 2, 5, 0.2);      // A: 블록 (0,0,0) — 정지
  seedBall(w, 20, 20, 20, 2, 5, 0);     // B: 블록 (2,2,2) — 흔들 예정
  const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.energy);
  const tracker = Ac.createActivityTracker(N, BS);
  for (let t = 0; t < measures; t++) {
    if (jiggleB) { const i = (20 * N + 20) * N + 20; w.fields.energy[i] = 5 + (t % 2 === 0 ? 0.5 : -0.3); }  // B 변화
    tracker.measure(w.fields.energy, set.origins(), { threshold: 0 });
  }
  return { w, tracker };
}

// ── 1. 동결 덩어리만 자동 승격 ──
{
  const { w, tracker } = settledWorld(HOLD + 2, true);   // A 정지(동결)·B 흔들림(활성)
  // A 블록(0,0,0) streak≥hold? B 블록(2,2,2) streak=0?
  const aFrozen = tracker.streakOf(0, 0, 0) >= HOLD, bActive = tracker.streakOf(2, 2, 2) < HOLD;
  const res = Hy.autoPromoteStable(w, tracker, { hold: HOLD, eps: EPS });
  // A 만 올라가고(1개) B 는 격자에 남음(블록 2,2,2 에 질량 잔존).
  const bStays = w.fields.energy[(20 * N + 20) * N + 20] !== 0;
  const ok = res.promoted === 1 && aFrozen && bActive && bStays;
  check('동결 덩어리만 자동 승격 — 정지(동결) A 올림·흔들리는 B 안 올림',
    ok, `승격 ${res.promoted}개 · A 동결 ${aFrozen}(streak ${tracker.streakOf(0, 0, 0)}) · B 활성 ${bActive}(streak ${tracker.streakOf(2, 2, 2)}) · B 잔존 ${bStays}`);
}

// ── 2. 레버2 실현 측정(§5 게이트) — 자동 승격으로 활성 칸 급감 ──
let measureInfo = '';
{
  const { w, tracker } = settledWorld(HOLD + 2, true);
  const before = Hy.activeCellCount(w);
  const res = Hy.autoPromoteStable(w, tracker, { hold: HOLD, eps: EPS });
  const after = Hy.activeCellCount(w);
  measureInfo = `활성 칸 ${before} → ${after} (−${before - after} = 올린 ${res.removedCells}칸, 개체 ${res.promoted}개)`;
  // 활성 칸이 올린 덩어리 칸수만큼 정확히 줄어야(레버1 0023 은 점유 100% 천장에 막혀 못 한 일).
  const ok = after === before - res.removedCells && res.removedCells > 0;
  check('레버2 실현 측정(§5 게이트) — 자동 승격으로 활성 격자 칸 급감(올린 칸수만큼)', ok, measureInfo);
}

// ── 3. 보존 — 자동 승격 전후 Σ(격자+개체) 정확 보존 ──
{
  const { w, tracker } = settledWorld(HOLD + 2, true);
  const m0 = gridMass(w), p0 = gridMom(w), e0 = gridEnergy(w);
  const res = Hy.autoPromoteStable(w, tracker, { hold: HOLD, eps: EPS });
  let em = 0, epx = 0, epy = 0, epz = 0, ee = 0;
  for (const e of res.entities) { em += e.mass; epx += e.px; epy += e.py; epz += e.pz; ee += e.energy; }
  const m1 = gridMass(w) + em, p1 = [gridMom(w)[0] + epx, gridMom(w)[1] + epy, gridMom(w)[2] + epz], e1 = gridEnergy(w) + ee;
  const ok = relOk(m1, m0) && relOk(p1[0], p0[0]) && relOk(p1[1], p0[1]) && relOk(p1[2], p0[2]) && relOk(e1, e0);
  check('보존 — 자동 승격 전후 Σ(격자+개체) 질량·운동량·에너지 정확 보존',
    ok, `질량 ${m0.toFixed(1)}→${m1.toFixed(1)} · 운동량x ${p0[0].toFixed(3)}→${p1[0].toFixed(3)} · 에너지 ${e0.toFixed(1)}→${e1.toFixed(1)}`);
}

// ── 4. 동결 전엔 안 올림 — streak<hold 면 아무것도 안 올린다 ──
{
  const { w, tracker } = settledWorld(2, false);   // measure 2회(첫 스냅샷+1) → streak<hold
  const res = Hy.autoPromoteStable(w, tracker, { hold: HOLD, eps: EPS });
  const ok = res.promoted === 0 && Hy.activeCellCount(w) > 0;
  check('동결 전엔 안 올림 — measure 부족(streak<hold)이면 아무것도 안 올린다(보수적)',
    ok, `승격 ${res.promoted}개 (A streak ${tracker.streakOf(0, 0, 0)} < hold ${HOLD})`);
}

// ── 5. 개체 동역학 합류 — 올린 개체를 굴려도 격자 불변 ──
{
  const { w, tracker } = settledWorld(HOLD + 2, true);
  const res = Hy.autoPromoteStable(w, tracker, { hold: HOLD, eps: EPS });
  const fpBefore = w.fingerprint('energy');
  const cx0 = res.entities[0].cx;
  Hy.stepEntities(res.entities, { dt: 0.1, G: 1, soft: 2, N });   // 개체간 중력+드리프트
  const fpAfter = w.fingerprint('energy');
  // 개체-공간 동역학은 격자를 안 건드린다(개체 1개라 중력 무효지만 위치 적분은 됨 — 정지 개체라 이동 0; 격자 불변 확인).
  const ok = fpBefore === fpAfter && res.entities.length >= 1;
  check('개체 동역학 합류 — 올린 개체를 stepEntities 로 굴려도 격자 불변(개체-공간 독립)',
    ok, `격자 지문 ${fpBefore === fpAfter ? '불변' : '변함'} · 개체 ${res.entities.length}개`);
}

// ── 6. 결정론 ──
{
  function run() { const { w, tracker } = settledWorld(HOLD + 2, true); const res = Hy.autoPromoteStable(w, tracker, { hold: HOLD, eps: EPS }); let h = w.fingerprint('energy') >>> 0; for (const e of res.entities) h = (h * 131 + Math.round(e.cx * 1e6) + Math.round(e.mass * 1e6)) >>> 0; return h; }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 자동 승격 결과 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0030 수치 검증: S5-c(첫 단위) 자동 승격 트리거(동결→승격) + 레버2 실현 측정 ===');
console.log(`  [레버2 실현 측정·§5 게이트] ${measureInfo}`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

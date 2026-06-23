// step_0055/verify.js — SW5 격자 은퇴 자동 이주 트리거: 조건 충족 격자 영역 → SPH 입자 *이동*. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — "격자 유체를 구체로 이주 → 격자 은퇴". 0051 fluidToParticles 는 격자장을
//   *읽어 복사*만 했다(격자·입자 중복). 이 step 은 그 *이동* 판 = autoPromoteStable(동결 덩어리만 선택 승격)의
//   유체 판: 조건(region) 충족 셀만 SPH 입자로 옮기고 *격자에서 비운다*(rho·운동량·내부E=0) → 격자가 실제 은퇴
//   (활성 셀↓). 이동이라 (남은 격자 + 입자) 총량 = 원래 총량(복사처럼 배가되지 않음).
//   적정 검증: ① 선택성(region 안 셀만 이주·밖 셀은 격자 잔류) ② 이동 보존(Σ입자 = 비운 셀·전역 총량 불변)
//   ③ 격자 은퇴(이주 영역 셀 진공화·활성 셀↓) ④ 항등/안전(region 불충족·진공이면 회귀 0) ⑤ 결정론.
//   실행: node HTJ/steps/step_0055/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) + 1e-9 * Math.abs(b);
const fSum = (w, nm) => { const a = w.fields[nm]; if (!a) return 0; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };

// 가우시안 블롭을 자기중력으로 몇 스텝 굴려 *운동량·내부E 있는* 격자 상태를 만든다(0051 verify 와 동일 세계).
function collapsedWorld(N, steps) {
  const w = W.createWorld(N);
  const rho = w.fields.energy, u = w.addField('therm');
  w.addField('mom_x'); w.addField('mom_y'); w.addField('mom_z');
  const c = (N - 1) / 2, sig = N * 0.16;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2, i = (z * N + y) * N + x;
    const r = 2.0 * Math.exp(-d2 / (2 * sig * sig)); rho[i] = r; u[i] = r * 0.3;
  }
  for (let t = 0; t < steps; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.25, iters: 40 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  return w;
}

// ── 1. 선택성 — region 안 셀만 이주·region 밖 점유 셀은 격자에 남는다 ──
{
  const N = 6, w = W.createWorld(N); const rho = w.fields.energy, u = w.addField('therm');
  w.addField('mom_x'); w.addField('mom_y'); w.addField('mom_z');
  // 모든 셀을 채운다(균일 ρ=1) → region 이 자르는 것만 옮겨야.
  for (let i = 0; i < rho.length; i++) { rho[i] = 1; u[i] = 0.5; }
  const occBefore = w.count('energy', 0);
  // region = x<3 절반만.
  const res = SPH.migrateRegionToSPH(w, { region: (x) => x < 3 });
  const occAfter = w.count('energy', 0);
  const expectMigrated = 3 * N * N;                          // x∈{0,1,2} 절반
  // 이주 입자는 전부 x<3·격자 잔류 셀은 전부 x≥3.
  const partAllInRegion = res.particles.every(p => p.cx < 3);
  let latAllOutRegion = true;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (rho[(z * N + y) * N + x] > 0 && x < 3) latAllOutRegion = false;
  check('선택성 — region 안 셀만 이주·밖 셀 격자 잔류',
    res.migratedCells === expectMigrated && partAllInRegion && latAllOutRegion && occAfter === occBefore - expectMigrated,
    `이주 ${res.migratedCells}=${expectMigrated} · 입자 모두 x<3 ${partAllInRegion} · 잔류 모두 x≥3 ${latAllOutRegion} · 활성 ${occBefore}→${occAfter}`);
}

// ── 2. 이동 보존 — Σ입자 = 비운 셀 합·(남은 격자 + 입자) 전역 총량 = 원래 총량(복사 아닌 이동) ──
{
  const w = collapsedWorld(18, 6);
  const M0 = fSum(w, 'energy'), Px0 = fSum(w, 'mom_x'), Py0 = fSum(w, 'mom_y'), Pz0 = fSum(w, 'mom_z'), U0 = fSum(w, 'therm'), KE0 = Gr.kineticEnergy(w);
  const c = (w.N - 1) / 2;
  // region = 중심 코어(반지름 5) 만 이주 — 일부는 격자에 남는다.
  const res = SPH.migrateRegionToSPH(w, { region: (x, y, z) => Math.hypot(x - c, y - c, z - c) < 5 });
  const pM = res.particles.reduce((s, p) => s + p.mass, 0), pPx = res.particles.reduce((s, p) => s + p.px, 0), pPy = res.particles.reduce((s, p) => s + p.py, 0), pPz = res.particles.reduce((s, p) => s + p.pz, 0);
  const pU = res.particles.reduce((s, p) => s + p.internalE, 0), pKE = res.particles.reduce((s, p) => s + p.KEcm, 0);
  // 비운 셀 합 = 이주 입자 합(removedMass 확인).
  const removedOk = relOk(pM, res.removedMass);
  // 전역 총량 불변: (남은 격자) + (입자) = 원래.
  const M1 = fSum(w, 'energy') + pM, Px1 = fSum(w, 'mom_x') + pPx, Py1 = fSum(w, 'mom_y') + pPy, Pz1 = fSum(w, 'mom_z') + pPz, U1 = fSum(w, 'therm') + pU, KE1 = Gr.kineticEnergy(w) + pKE;
  const globalOk = relOk(M1, M0) && relOk(Px1, Px0) && relOk(Py1, Py0) && relOk(Pz1, Pz0) && relOk(U1, U0) && relOk(KE1, KE0);
  // 일부만 이주(전부 아님) 했는지 — 남은 격자 질량 > 0.
  const partial = fSum(w, 'energy') > 1e-9 && pM > 1e-9;
  check('이동 보존 — Σ입자=비운 셀·(남은 격자+입자) 총량 불변(복사 아닌 이동)',
    removedOk && globalOk && partial,
    `질량 Δ${Math.abs(M1 - M0).toExponential(1)} · 운동량 Δ${Math.abs(Px1 - Px0).toExponential(1)} · 내부E Δ${Math.abs(U1 - U0).toExponential(1)} · KE Δ${Math.abs(KE1 - KE0).toExponential(1)} · 부분이주 ${partial}`);
}

// ── 3. 격자 은퇴 — 이주한 셀은 진공화(rho·운동량·내부E=0)·활성 셀이 이주분만큼 감소 ──
{
  const w = collapsedWorld(18, 6);
  const occBefore = w.count('energy', 0);
  const res = SPH.migrateRegionToSPH(w);                     // region 없음 = 전체 점유 이주(전부 은퇴)
  const occAfter = w.count('energy', 0);
  // 이주 입자 자리의 격자가 전부 0(진공)인지.
  let allCleared = true;
  for (const p of res.particles) {
    const i = (p.cz * w.N + p.cy) * w.N + p.cx;
    if (w.fields.energy[i] !== 0 || w.fields.mom_x[i] !== 0 || w.fields.therm[i] !== 0) { allCleared = false; break; }
  }
  check('격자 은퇴 — 이주 셀 진공화(rho·운동량·내부E=0)·활성 셀↓',
    allCleared && occAfter === occBefore - res.migratedCells && occAfter === 0,
    `활성 ${occBefore}→${occAfter} (이주 ${res.migratedCells}) · 이주 셀 모두 진공 ${allCleared}`);
}

// ── 4. 항등/안전 — region 이 아무 셀도 안 고르면 입자 0·격자 불변(회귀 0)·n<2 등 무탈 ──
{
  const w = collapsedWorld(14, 4);
  const fp0 = w.fingerprint('energy');
  const res = SPH.migrateRegionToSPH(w, { region: () => false });   // 아무 셀도 선택 안 함
  const fp1 = w.fingerprint('energy');
  // threshold 가 max 보다 크면(전부 진공 취급) → 입자 0.
  const w2 = collapsedWorld(14, 4);
  const res2 = SPH.migrateRegionToSPH(w2, { threshold: 1e9 });
  check('항등/안전 — region 불충족·threshold 초과 → 입자 0·격자 불변(회귀 0)',
    res.migratedCells === 0 && res.particles.length === 0 && fp0 === fp1 && res2.migratedCells === 0,
    `region=false 입자 ${res.migratedCells}·지문 불변 ${fp0 === fp1} · threshold↑ 입자 ${res2.migratedCells}`);
}

// ── 5. 결정론 — 같은 세계·같은 region → 같은 입자(질량·운동량·내부E 지문) ──
{
  function fnv(res) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(x, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of res.particles) { push(p.cx); push(p.cy); push(p.cz); push(p.mass); push(p.px); push(p.internalE); }
    return h >>> 0;
  }
  const c = 8.5;
  const reg = (x, y, z) => Math.hypot(x - c, y - c, z - c) < 5;
  const a = fnv(SPH.migrateRegionToSPH(collapsedWorld(18, 6), { region: reg }));
  const b = fnv(SPH.migrateRegionToSPH(collapsedWorld(18, 6), { region: reg }));
  check('결정론 — 같은 세계·region → 같은 입자 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 자동 이주 트리거: 조건 충족 격자 영역을 SPH 입자로 *이동*(격자 비움)·전역 총량 정확 보존·격자 실제 은퇴' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

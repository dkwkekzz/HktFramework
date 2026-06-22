// step_0026/verify.js — S5-a: 승격/역승격 이관(격자↔개체, 질량·운동량·에너지 정확 보존). 순수·독립·영구.
//
//   design §4 S5 의 관문: "승격↔강등서 질량·운동량·에너지 정확 이관(보존)·승격 후 격자 활성 칸 급감".
//   promote(world, cells): 덩어리 셀을 개체로 환원하고 격자에서 0 으로 비운다. demote: 개체를 균일 구로 복원.
//   에너지: 강체화 시 내부 운동E 가 열로 전환(internalE=U+internalKE) → 총E=KE_cm+internalE 정확 보존.
//
//   검증 대상:
//     1. 승격 환원 정확 — 개체 질량=Σρ_clump·운동량=Σg·총E=Σ(½|g|²/ρ+u)·CoM 정확.
//     2. 승격 보존(관문) — Σ(격자)+개체 = 승격 전 격자 (질량·운동량·에너지 상대 ≤1e-12).
//     3. 승격 후 격자 비움 + 활성 칸 급감 — 승격 셀 전부 0·비-영 셀 수 급감.
//     4. 역승격 보존 — demote 후 격자 = 원래 (질량·운동량·에너지 상대 ≤1e-12).
//     5. 각운동량 descriptor 정확 — 알려진 회전장 → 개체 L = 해석값.
//     6. 회귀 0 — detectClumps collectCells off → 환원량 불변 + promote/demote 신규 모듈.
//     7. 결정론.
//
//   실행: node HTJ/steps/step_0026/verify.js
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
const Cl = require(path.resolve(__dirname, '../../engine/htj-cluster.js'));
const Pm = require(path.resolve(__dirname, '../../engine/htj-promote.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 24, DT = 0.2, EPSr = 1e-12;
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
function gridMass(w) { return sum(w.fields.energy); }
function gridMom(w) { return [sum(w.fields.mom_x), sum(w.fields.mom_y), sum(w.fields.mom_z)]; }
function gridKE(w) { const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; let s = 0; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) s += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / r[i]; return s; }
function gridU(w) { return w.fields.therm ? sum(w.fields.therm) : 0; }
function gridEnergy(w) { return gridKE(w) + gridU(w); }
function nonzero(w) { const r = w.fields.energy; let c = 0; for (let i = 0; i < r.length; i++) if (r[i] !== 0) c++; return c; }
const relOk = (a, b) => Math.abs(a - b) <= 1e-9 + 1e-12 * Math.abs(b);

// 붕괴한 별(운동량·열 있는 실제 덩어리) — step_0014 파이프라인 몇 스텝.
function makeStar(steps) {
  const w = W.createWorld(N); w.addField('therm');
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N ** 3 * 0.5), T0: 1 });
  const p = { kpress: 0.12, kthermo: 0.3, kvisc: 0.6, frate: 2, radiate: 0.06 };
  for (let t = 0; t < steps; t++) {
    Gr.applyGravity(w, DT, { G: 0.15, iters: 40 });
    Pr.applyPressure(w, DT, { K: p.kpress, gamma: 2 });
    Th.applyThermalPressure(w, DT, { Kth: p.kthermo, gamma: 5 / 3 });
    Vi.applyViscosity(w, DT, { Kvisc: p.kvisc });
    Fu.applyFusion(w, DT, { rate: p.frate, rhoCrit: 6, tCrit: 3 });
    Co.applyCooling(w, DT, { coolRate: p.radiate });
    In.advect(w, DT, { scalars: ['therm'] });
  }
  return w;
}
function biggestClumpCells(w) {
  const mean = gridMass(w) / w.fields.energy.length, eps = Math.max(mean * 1.5, 1e-9);
  const clumps = Cl.detectClumps(w, { eps, minCells: 2, collectCells: true });
  return clumps.length ? clumps[0].cellList : [];
}

// ── 1. 승격 환원 정확 ──
{
  const w = makeStar(14);
  const cells = biggestClumpCells(w);
  // 독립 계산(개체와 대조).
  let m = 0, px = 0, ke = 0, uu = 0;
  for (const i of cells) { const r = w.fields.energy[i], a = w.fields.mom_x[i], b = w.fields.mom_y[i], c = w.fields.mom_z[i]; m += r; px += a; if (r > 1e-12) ke += 0.5 * (a * a + b * b + c * c) / r; uu += w.fields.therm[i]; }
  const e = Pm.promote(w, cells);
  const ok = relOk(e.mass, m) && relOk(e.px, px) && relOk(e.energy, ke + uu) && cells.length === e.cells;
  check('승격 환원 정확 — 개체 질량=Σρ·운동량=Σg·총E=Σ(½|g|²/ρ+u)',
    ok, `질량 ${e.mass.toFixed(2)}=${m.toFixed(2)} · 총E ${e.energy.toFixed(2)}=${(ke + uu).toFixed(2)} · 셀 ${e.cells}`);
}

// ── 2. 승격 보존(관문) + 3. 격자 비움/활성 급감 ──
let nzBefore = 0, nzAfter = 0;
{
  const w = makeStar(14);
  const m0 = gridMass(w), p0 = gridMom(w), e0 = gridEnergy(w);
  nzBefore = nonzero(w);
  const cells = biggestClumpCells(w);
  const ent = Pm.promote(w, cells);
  nzAfter = nonzero(w);
  // 격자 + 개체 = 승격 전.
  const m1 = gridMass(w) + ent.mass;
  const p1 = [gridMom(w)[0] + ent.px, gridMom(w)[1] + ent.py, gridMom(w)[2] + ent.pz];
  const e1 = gridEnergy(w) + ent.energy;
  const consv = relOk(m1, m0) && relOk(p1[0], p0[0]) && relOk(p1[1], p0[1]) && relOk(p1[2], p0[2]) && relOk(e1, e0);
  check('승격 보존(관문) — Σ(격자)+개체 = 승격 전 (질량·운동량·에너지 상대 ≤1e-12)',
    consv, `Δ질량 ${Math.abs(m1 - m0).toExponential(1)} · Δ에너지 ${Math.abs(e1 - e0).toExponential(1)}`);

  // 승격 셀 전부 0?
  let emptied = true; for (const i of cells) if (w.fields.energy[i] !== 0 || w.fields.mom_x[i] !== 0 || (w.fields.therm && w.fields.therm[i] !== 0)) { emptied = false; break; }
  check('승격 후 격자 비움 + 활성 칸 급감 — 승격 셀 전부 0 · 비-영 셀 수 급감',
    emptied && nzAfter < nzBefore, `비-영 셀 ${nzBefore} → ${nzAfter} (개체 ${cells.length}셀 빠짐)`);
}

// ── 4. 역승격 보존 — promote→demote 왕복 후 격자 = 원래 ──
{
  const w = makeStar(14);
  const m0 = gridMass(w), p0 = gridMom(w), e0 = gridEnergy(w);
  const cells = biggestClumpCells(w);
  const ent = Pm.promote(w, cells);
  Pm.demote(w, ent);                                   // 격자로 되돌림
  const m1 = gridMass(w), p1 = gridMom(w), e1 = gridEnergy(w);
  const ok = relOk(m1, m0) && relOk(p1[0], p0[0]) && relOk(p1[1], p0[1]) && relOk(p1[2], p0[2]) && relOk(e1, e0);
  check('역승격 보존 — promote→demote 왕복 후 격자 = 원래 (질량·운동량·에너지 상대 ≤1e-12)',
    ok, `질량 ${m0.toFixed(2)}→${m1.toFixed(2)} · 운동량x ${p0[0].toFixed(3)}→${p1[0].toFixed(3)} · 에너지 ${e0.toFixed(1)}→${e1.toFixed(1)}`);
}

// ── 5. 각운동량 descriptor 정확 — 알려진 회전장 → 개체 L = 해석값 ──
{
  const w = W.createWorld(N); w.addField('therm');
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
  const idx = (x, y, z) => (z * N + y) * N + x;
  const c = 12, m = 4, p = 3, d = 2;
  // CoM=(12,12,12) 둘레 z축 회전: (+d,0) 셀 g=(0,+p,0), (−d,0) 셀 g=(0,−p,0). L_z = 2·d·p.
  const i1 = idx(c + d, c, c), i2 = idx(c - d, c, c);
  w.fields.energy[i1] = m; w.fields.mom_y[i1] = p;
  w.fields.energy[i2] = m; w.fields.mom_y[i2] = -p;
  const e = Pm.promote(w, [i1, i2]);
  const Lz_expect = 2 * d * p;                          // = 12
  const ok = Math.abs(e.Lz - Lz_expect) < 1e-12 && Math.abs(e.px) < 1e-12 && Math.abs(e.py) < 1e-12 && Math.abs(e.cx - c) < 1e-12;
  check('각운동량 descriptor 정확 — 알려진 z축 회전장 → 개체 Lz = 2·d·p',
    ok, `Lz ${e.Lz.toFixed(3)}=${Lz_expect} · P≈0 · CoM_x ${e.cx.toFixed(1)}=${c}`);
}

// ── 6. 회귀 0 — collectCells off → 환원량 불변(가법) ──
{
  const w1 = makeStar(10), w2 = makeStar(10);
  const mean = gridMass(w1) / w1.fields.energy.length, eps = Math.max(mean * 1.5, 1e-9);
  const a = Cl.detectClumps(w1, { eps, minCells: 2 });                       // collectCells 없음
  const b = Cl.detectClumps(w2, { eps, minCells: 2, collectCells: true });   // 있음
  const same = a.length === b.length && a.every((c, k) => Math.abs(c.mass - b[k].mass) < 1e-12 && c.cells === b[k].cells) && a[0].cellList === undefined && Array.isArray(b[0].cellList);
  check('회귀 0 — detectClumps collectCells off=환원량 불변(가법)·on 만 cellList 첨부',
    same, `덩어리 ${a.length}개 환원량 동일 · cellList off=undefined/on=배열`);
}

// ── 7. 결정론 ──
{
  function run() { const w = makeStar(12); const cells = biggestClumpCells(w); const e = Pm.promote(w, cells); Pm.demote(w, e); return w.fingerprint('energy') ^ w.fingerprint('mom_x'); }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 승격/강등 결과 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0026 수치 검증: S5-a 승격/역승격 이관(격자↔개체, 질량·운동량·에너지 정확 보존) ===');
console.log(`  [정보용] 승격으로 비-영 셀 ${nzBefore} → ${nzAfter} (격자에서 별 본체가 빠짐 = 활성 칸 급감)`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

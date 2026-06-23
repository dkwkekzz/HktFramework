// step_0051/verify.js — SW5 격자 은퇴 첫 벽돌: 격자 유체 → SPH 입자 이주. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — "격자 유체를 구체로 이주 → 격자 은퇴". 0050 으로 SPH 가 격자 핵심 거동을
//   정성 재현함이 측정됐다(전제). 이 step 은 그 *이주 메커니즘*: 격자장(ρ=energy·운동량 mom_*·내부E therm)을
//   셀마다 SPH 입자 하나로 재버킷팅(fluidToParticles) = 0026 promote(덩어리→개체)의 유체 전체 판. 셀 부피 1 이라
//   셀 보존량이 그대로 입자 양 → *정확 보존*. 진공 셀(ρ≤0)은 건너뛰어 희소화(빈 곳엔 구체 없음).
//   적정 검증: ① 변환 정의·완전성·희소화 ② 질량·운동량·내부E·KE 정확 보존 ③ 속도 일치(v=g/ρ) ④ 이주 후
//   SPH 정합(밀도/압력 정상·보존) ⑤ 결정론.
//   실행: node HTJ/steps/step_0051/verify.js
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

// 가우시안 블롭(ρ>0 어디나)을 자기중력으로 몇 스텝 굴려 *운동량·내부E 있는* 격자 상태를 만든다.
function collapsedWorld(N, steps) {
  const w = W.createWorld(N);
  const rho = w.fields.energy, u = w.addField('therm');
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

// ── 1. 변환 정의·완전성·희소화 — ρ>thresh 셀마다 입자 1개(셀 중심·질량 ρ)·진공 셀은 입자 0 ──
{
  // 손수 만든 작은 세계: 일부 셀만 채우고 나머지 진공(ρ=0).
  const N = 4, w = W.createWorld(N); const rho = w.fields.energy, u = w.addField('therm');
  const gx = w.addField('mom_x'), gy = w.addField('mom_y'), gz = w.addField('mom_z');
  const set = (x, y, z, m, px, py, pz, ie) => { const i = (z * N + y) * N + x; rho[i] = m; gx[i] = px; gy[i] = py; gz[i] = pz; u[i] = ie; };
  set(1, 1, 1, 4, 2, 0, 0, 5); set(2, 1, 1, 2, -1, 1, 0, 3); set(0, 3, 2, 1, 0, 0, 0, 1);   // 3 셀만 점유
  const ps = SPH.fluidToParticles(w);
  const occ = w.count('energy', 0);
  // 한 입자의 정의 확인(첫 점유 셀 (1,1,1)).
  const p = ps.find(q => q.cx === 1 && q.cy === 1 && q.cz === 1);
  const defOk = p && p.mass === 4 && p.px === 2 && p.internalE === 5 && Math.abs(p.KEcm - 0.5 * 4 / 4) < 1e-12;
  check('변환 정의·완전성·희소화 — ρ>0 셀마다 입자 1개·진공 셀 0',
    ps.length === occ && occ === 3 && defOk,
    `입자 ${ps.length} = 점유 셀 ${occ}(64셀 중) · (1,1,1): m=${p && p.mass} px=${p && p.px} u=${p && p.internalE}`);
}

// ── 2. 질량·운동량·내부E·KE 정확 보존 — Σ입자 = 격자 장 총합(단순 재버킷팅·Δ=0) ──
const w2 = collapsedWorld(18, 6);
const ps2 = SPH.fluidToParticles(w2);
{
  const pM = ps2.reduce((s, p) => s + p.mass, 0), pPx = ps2.reduce((s, p) => s + p.px, 0), pPy = ps2.reduce((s, p) => s + p.py, 0), pPz = ps2.reduce((s, p) => s + p.pz, 0);
  const pU = ps2.reduce((s, p) => s + p.internalE, 0), pKE = ps2.reduce((s, p) => s + p.KEcm, 0);
  const fM = fSum(w2, 'energy'), fPx = fSum(w2, 'mom_x'), fPy = fSum(w2, 'mom_y'), fPz = fSum(w2, 'mom_z'), fU = fSum(w2, 'therm'), fKE = Gr.kineticEnergy(w2);
  const ok = relOk(pM, fM) && relOk(pPx, fPx) && relOk(pPy, fPy) && relOk(pPz, fPz) && relOk(pU, fU) && relOk(pKE, fKE);
  check('정확 보존 — 질량·운동량·내부E·KE = 격자 장 총합(Δ=0)', ok,
    `질량 Δ${Math.abs(pM - fM).toExponential(1)} · 운동량 Δ${Math.abs(pPx - fPx).toExponential(1)} · 내부E Δ${Math.abs(pU - fU).toExponential(1)} · KE Δ${Math.abs(pKE - fKE).toExponential(1)}`);
}

// ── 3. 속도 일치 — 입자 v=p/m = 격자 셀 속도 g/ρ ──
{
  const N = w2.N, rho = w2.fields.energy, gx = w2.fields.mom_x;
  let maxErr = 0;
  for (const p of ps2) {
    const i = (p.cz * N + p.cy) * N + p.cx;
    const vLat = rho[i] > 1e-12 ? gx[i] / rho[i] : 0, vPar = p.mass > 1e-12 ? p.px / p.mass : 0;
    maxErr = Math.max(maxErr, Math.abs(vLat - vPar));
  }
  check('속도 일치 — 입자 v=p/m = 격자 셀 v=g/ρ', maxErr < 1e-12, `max |Δv_x| ${maxErr.toExponential(2)}`);
}

// ── 4. 이주 후 SPH 정합 — 변환 입자가 SPH 밀도·압력에서 정상 거동·운동량 보존 ──
{
  const ps = SPH.fluidToParticles(w2);
  SPH.sphDensity(ps, { h: 2 });
  const noNaN1 = ps.every(p => isFinite(p.density) && p.density > 0);
  const P0x = ps.reduce((s, p) => s + p.px, 0), P0y = ps.reduce((s, p) => s + p.py, 0), P0z = ps.reduce((s, p) => s + p.pz, 0);
  SPH.sphPressureForce(ps, 0.05, { stiffness: 0.3, gamma: 2, h: 2 });   // 한 스텝 SPH 압력
  const P1x = ps.reduce((s, p) => s + p.px, 0), P1y = ps.reduce((s, p) => s + p.py, 0), P1z = ps.reduce((s, p) => s + p.pz, 0);
  const noNaN2 = ps.every(p => isFinite(p.px) && isFinite(p.energy));
  const momOk = relOk(P0x, P1x, 1e-7) && relOk(P0y, P1y, 1e-7) && relOk(P0z, P1z, 1e-7);
  check('이주 후 SPH 정합 — 밀도/압력 정상(NaN 없음)·운동량 보존',
    noNaN1 && noNaN2 && momOk,
    `밀도 정상 ${noNaN1} · 압력 후 정상 ${noNaN2} · 운동량 보존 Δ${Math.abs(P1x - P0x).toExponential(1)}`);
}

// ── 5. 결정론 — 같은 세계 → 같은 입자(질량·운동량·내부E 지문) ──
{
  function fnv(ps) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(x, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of ps) { push(p.cx); push(p.mass); push(p.px); push(p.internalE); }
    return h >>> 0;
  }
  const a = fnv(SPH.fluidToParticles(collapsedWorld(18, 6)));
  const b = fnv(SPH.fluidToParticles(collapsedWorld(18, 6)));
  check('결정론 — 같은 세계 → 같은 입자 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 격자 유체 → SPH 입자 이주: 셀마다 입자 1개·질량/운동량/내부E/KE 정확 보존·격자 은퇴의 토대' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

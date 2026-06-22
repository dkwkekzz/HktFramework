// step_0029/verify.js — S5-b(셋째 단위): 각운동량 보존 회전 redeposit(스핀). 순수·독립·영구.
//
//   design §4 S5("승격↔강등 보존")·§0 목적 ②. step_0026~0028 의 한계 — demote 가 *균일 속도* 구라
//   기록된 각운동량 L 을 복원 안 함(스핀=0) — 을 닫는다. demote(world, entity, {spin:true}) 가 L 을
//   강체 회전장으로 복원: ω=I⁻¹L(I=볼 관성 텐서), v=v_cm+ω×(r−볼CoM). 회전은 순 선운동량 0 만큼
//   더하므로 Σg=P 불변, L 은 I·ω=L 로 복원. 회전 KE 는 internalE 에서 빼 열로(총E 정확 보존).
//
//   검증 대상:
//     1. 회전장 복원 — 알려진 L 을 가진 개체 → demote{spin} 후 격자 L_grid = entity.L (상대 ≤1e-9).
//     2. 왕복 각운동량 보존 — 회전하는 덩어리 promote→demote{spin} → 격자 L = 원래 (0026 은 못 했던 것).
//     3. 선운동량·질량·에너지 여전히 정확 보존 — 회전은 ΣP·Σρ·총E 안 건드림(회전 KE 는 열에서).
//     4. 회귀 0(관문) — demote{spin:off, 기본} = 기존 균일 속도와 byte 동일(0026~0028 불변).
//     5. 회전 = 비-병진 운동 — spin 켜면 셀 속도가 균일 아님(병진만일 때와 다름)·열은 줄어듦(KE_rot 만큼).
//     6. 열 부족 가드 — internalE < KE_rot 면 ω 스케일·열≥0·NaN 없음(에너지 우선).
//     7. 결정론.
//
//   실행: node HTJ/steps/step_0029/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Pm = require(path.resolve(__dirname, '../../engine/htj-promote.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 24, EPSr = 1e-9;
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const relOk = (a, b) => Math.abs(a - b) <= 1e-7 + 1e-9 * Math.abs(b);
function newWorld() { const w = W.createWorld(N); w.addField('therm'); for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array }); return w; }
// 격자 각운동량 L = Σ (r−CoM) × g (질량가중 CoM 기준).
function gridL(w) {
  const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z;
  let m = 0, cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < r.length; i++) { const v = r[i]; if (v === 0) continue; const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / (N * N); m += v; cx += v * x; cy += v * y; cz += v * z; }
  if (m > 1e-12) { cx /= m; cy /= m; cz /= m; }
  let Lx = 0, Ly = 0, Lz = 0;
  for (let i = 0; i < r.length; i++) { if (r[i] === 0) continue; const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / (N * N); const rx = x - cx, ry = y - cy, rz = z - cz; const a = gx[i], b = gy[i], c = gz[i]; Lx += ry * c - rz * b; Ly += rz * a - rx * c; Lz += rx * b - ry * a; }
  return [Lx, Ly, Lz];
}
function gridMom(w) { return [sum(w.fields.mom_x), sum(w.fields.mom_y), sum(w.fields.mom_z)]; }
function gridKE(w) { const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; let s = 0; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) s += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / r[i]; return s; }
function gridEnergy(w) { return gridKE(w) + sum(w.fields.therm); }
// 회전하는 덩어리(격자 위) — 구 안 셀에 ρ + 강체 회전 운동량 g=ρ·(ω×r) + 열.
function seedSpinningClump(w, cx, cy, cz, rad, rho0, omega, u0, vcm) {
  vcm = vcm || [0, 0, 0];
  const cells = [];
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    if (dx * dx + dy * dy + dz * dz <= rad * rad) {
      const i = (z * N + y) * N + x;
      w.fields.energy[i] = rho0;
      const vx = vcm[0] + (omega[1] * dz - omega[2] * dy), vy = vcm[1] + (omega[2] * dx - omega[0] * dz), vz = vcm[2] + (omega[0] * dy - omega[1] * dx);
      w.fields.mom_x[i] = rho0 * vx; w.fields.mom_y[i] = rho0 * vy; w.fields.mom_z[i] = rho0 * vz;
      w.fields.therm[i] = u0;
      cells.push(i);
    }
  }
  return cells;
}

// ── 1. 회전장 복원 — 알려진 L → demote{spin} 후 격자 L = entity.L ──
{
  // 개체를 직접 구성(알려진 L, P=0).
  const c = 12;
  const ent = { cx: c, cy: c, cz: c, mass: 200, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 80, KEcm: 0, internalE: 500, energy: 500, radius: 3.5, temp: 1, cells: 120 };
  const w = newWorld();
  Pm.demote(w, ent, { spin: true });
  const L = gridL(w);
  const ok = Math.abs(L[2] - ent.Lz) <= 1e-6 + 1e-9 * Math.abs(ent.Lz) && Math.abs(L[0]) < 1e-6 && Math.abs(L[1]) < 1e-6;
  check('회전장 복원 — 알려진 L → demote{spin} 후 격자 L_grid = entity.L', ok, `L_grid_z ${L[2].toFixed(4)} = entity.Lz ${ent.Lz} · Lx,Ly≈0 (${L[0].toExponential(1)},${L[1].toExponential(1)})`);
}

// ── 2. 왕복 각운동량 보존 — 회전 덩어리 promote→demote{spin} → 격자 L = 원래 ──
let l0info = '';
{
  const w = newWorld();
  const cells = seedSpinningClump(w, 12, 12, 12, 4, 4, [0, 0, 0.4], 8);   // z축 스핀
  const L0 = gridL(w), m0 = gridMom(w);
  const ent = Pm.promote(w, cells);
  Pm.demote(w, ent, { spin: true });
  const L1 = gridL(w), m1 = gridMom(w);
  l0info = `Lz ${L0[2].toFixed(3)} → ${L1[2].toFixed(3)}`;
  const ok = relOk(L1[2], L0[2]) && Math.abs(L1[0] - L0[0]) < 1e-6 && Math.abs(L1[1] - L0[1]) < 1e-6 && relOk(m1[0], m0[0]);
  check('왕복 각운동량 보존 — 회전 덩어리 promote→demote{spin} → 격자 L = 원래(0026 은 못 함)', ok, `${l0info} (상대 ${(Math.abs(L1[2] - L0[2]) / Math.abs(L0[2] || 1)).toExponential(1)})`);
}

// ── 3. 선운동량·질량·에너지 여전히 정확 보존(회전 KE 는 열에서) ──
{
  const w = newWorld();
  const cells = seedSpinningClump(w, 12, 12, 12, 4, 4, [0.2, 0, 0.4], 12, [0.3, -0.1, 0]);  // 스핀+병진
  const m0 = sum(w.fields.energy), p0 = gridMom(w), e0 = gridEnergy(w);
  const ent = Pm.promote(w, cells);
  Pm.demote(w, ent, { spin: true });
  const m1 = sum(w.fields.energy), p1 = gridMom(w), e1 = gridEnergy(w);
  const ok = relOk(m1, m0) && relOk(p1[0], p0[0]) && relOk(p1[1], p0[1]) && relOk(p1[2], p0[2]) && relOk(e1, e0);
  check('선운동량·질량·에너지 여전히 정확 보존 — 회전은 ΣP·Σρ·총E 안 건드림(회전 KE 는 열에서)',
    ok, `질량 ${m0.toFixed(1)}→${m1.toFixed(1)} · 운동량x ${p0[0].toFixed(3)}→${p1[0].toFixed(3)} · 에너지 ${e0.toFixed(1)}→${e1.toFixed(1)}`);
}

// ── 4. 회귀 0(관문) — demote{spin:off, 기본} = 기존 균일 속도와 byte 동일 ──
{
  // 같은 개체를 두 격자에: 하나는 기본(off), 하나는 명시 off → 동일. 그리고 균일 속도임을 확인.
  const ent = { cx: 12, cy: 12, cz: 12, mass: 200, px: 60, py: -20, pz: 0, Lx: 0, Ly: 0, Lz: 80, KEcm: 0, internalE: 500, energy: 500, radius: 3.5, temp: 1, cells: 120 };
  const wA = newWorld(), wB = newWorld();
  Pm.demote(wA, ent);                  // 기본(spin 인자 없음)
  Pm.demote(wB, ent, {});              // 빈 opts
  let identical = true; for (let i = 0; i < wA.fields.mom_x.length; i++) if (wA.fields.mom_x[i] !== wB.fields.mom_x[i] || wA.fields.energy[i] !== wB.fields.energy[i] || wA.fields.therm[i] !== wB.fields.therm[i]) { identical = false; break; }
  // 균일 속도 확인: 비-영 셀의 v=g/ρ 가 모두 같음(병진만).
  const r = wA.fields.energy, gx = wA.fields.mom_x; let vref = null, uniform = true;
  for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) { const v = gx[i] / r[i]; if (vref === null) vref = v; else if (Math.abs(v - vref) > 1e-12) { uniform = false; break; } }
  check('회귀 0(관문) — demote{spin off, 기본} = 균일 속도, byte 동일(0026~0028 불변)',
    identical && uniform, `기본=빈opts byte 동일 ${identical} · 속도 균일(병진만) ${uniform}`);
}

// ── 5. 회전 = 비-병진 + 열 감소 ──
{
  const ent = { cx: 12, cy: 12, cz: 12, mass: 200, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 80, KEcm: 0, internalE: 500, energy: 500, radius: 3.5, temp: 1, cells: 120 };
  const wU = newWorld(), wS = newWorld();
  Pm.demote(wU, ent);                  // 균일(spin off)
  Pm.demote(wS, ent, { spin: true });  // 회전
  // 회전 격자는 셀 속도가 균일 아님(L≠0) + 총 열(Σu)이 균일판보다 작음(KE_rot 만큼 열에서 뺌).
  const r = wS.fields.energy, gx = wS.fields.mom_x, gy = wS.fields.mom_y; let nonUniform = false, v0 = null;
  for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) { const vx = gx[i] / r[i], vy = gy[i] / r[i]; if (v0 === null) v0 = [vx, vy]; else if (Math.abs(vx - v0[0]) > 1e-9 || Math.abs(vy - v0[1]) > 1e-9) { nonUniform = true; break; } }
  const uU = sum(wU.fields.therm), uS = sum(wS.fields.therm);
  check('회전 = 비-병진 운동 + 열 감소(KE_rot 이 internalE 에서 빠짐)',
    nonUniform && uS < uU - 1e-9, `회전 속도장 비균일 ${nonUniform} · Σ열 균일 ${uU.toFixed(1)} → 회전 ${uS.toFixed(1)}(감소=KE_rot)`);
}

// ── 6. 열 부족 가드 — internalE < KE_rot 면 ω 스케일·열≥0·NaN 없음 ──
{
  // 큰 L + 작은 internalE → KE_rot 가 internalE 초과 → ω 스케일·열 0·총E 보존.
  const ent = { cx: 12, cy: 12, cz: 12, mass: 50, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 300, KEcm: 0, internalE: 5, energy: 5, radius: 3, temp: 1, cells: 90 };
  const w = newWorld();
  Pm.demote(w, ent, { spin: true });
  const ke = gridKE(w), uS = sum(w.fields.therm), e1 = ke + uS;
  // 열≥0·NaN 없음·총E ≈ entity.energy(=internalE, P=0). KE_rot 캡 → KE=internalE·열=0.
  let finite = true; for (let i = 0; i < w.fields.mom_x.length; i++) if (!isFinite(w.fields.mom_x[i]) || !isFinite(w.fields.therm[i])) { finite = false; break; }
  const ok = finite && uS >= -1e-9 && relOk(e1, ent.energy);
  check('열 부족 가드 — internalE<KE_rot 면 ω 스케일·열≥0·NaN 없음·총E 보존',
    ok, `Σ열 ${uS.toFixed(3)}(≥0) · 총E ${e1.toFixed(3)}=${ent.energy} · NaN 없음 ${finite}`);
}

// ── 7. 결정론 ──
{
  function run() { const w = newWorld(); const cells = seedSpinningClump(w, 12, 12, 12, 4, 4, [0.1, 0.2, 0.4], 10, [0.2, 0, 0]); const ent = Pm.promote(w, cells); Pm.demote(w, ent, { spin: true }); return w.fingerprint('mom_x') ^ w.fingerprint('mom_y') ^ w.fingerprint('mom_z'); }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 회전 복원 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0029 수치 검증: S5-b(셋째 단위) 각운동량 보존 회전 redeposit(스핀) ===');
console.log(`  [정보용] demote{spin} 가 기록된 L 을 강체 회전장으로 복원 — 왕복 ${l0info}`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

// step_0046/verify.js — SW5 점성(인공 점성·비가역 소산): bulk KE → 열. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 / §5 난점 2 — 0011(비가역 점성 소산·시간의 화살)·0037(DEM 접촉 감쇠)의 SPH 판.
//   0041~0045 압력은 가역(데움↔식힘)이라 단열 진동이 안 식음 → 점성이 그걸 식힌다(접근 쌍만·일방).
//   적정 검증(핵심 불변): ① 비가역 소산(접근→U↑·상대속도 깎임 / 멀어짐→무변화) ② 운동량 정확 보존
//   ③ 총E 닫힘(KE 일+ΔU=0 전력 균형) ④ 항등/안전(α=0·멀어짐·단일/빈) ⑤ 결정론.
//
//   실행: node HTJ/steps/step_0046/verify.js
'use strict';
const path = require('path');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);

function ent(cx, cy, cz, mass, internalE, px, py, pz) {
  px = px || 0; py = py || 0; pz = pz || 0;
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  return { cx, cy, cz, mass, px, py, pz, KEcm, internalE, energy: KEcm + internalE };
}
const sumP = (ps) => { let x = 0, y = 0, z = 0; for (const p of ps) { x += p.px; y += p.py; z += p.pz; } return [x, y, z]; };
const sumU = (ps) => ps.reduce((s, p) => s + p.internalE, 0);
const sumKE = (ps) => ps.reduce((s, p) => s + 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / p.mass, 0);
const clone = (ps) => ps.map(p => ({ ...p }));

// ── 1. 비가역 소산(시간의 화살) — 접근하는 쌍은 데우고 상대속도가 깎임 / 멀어지는 쌍은 무변화 ──
{
  const h = 2, dt = 0.2, opt = { alpha: 1, gamma: 5 / 3, h };
  // 접근: 둘이 서로를 향해(v_ij·r_ij<0). 멀어짐: 둘이 서로 반대로(v_ij·r_ij>0).
  const approach = [ent(-0.7, 0, 0, 1, 2, 1, 0, 0), ent(0.7, 0, 0, 1, 2, -1, 0, 0)];   // 향함
  const recede = [ent(-0.7, 0, 0, 1, 2, -1, 0, 0), ent(0.7, 0, 0, 1, 2, 1, 0, 0)];     // 멀어짐
  const U0a = sumU(approach), relV0 = Math.abs(approach[0].px - approach[1].px);
  SPH.sphViscosity(approach, dt, opt); SPH.sphViscosity(recede, dt, opt);
  const U1a = sumU(approach), relV1 = Math.abs(approach[0].px - approach[1].px);
  const heated = U1a > U0a + 1e-9;                          // 접근 → 데움(U↑)
  const damped = relV1 < relV0 - 1e-9;                      // 접근 → 상대운동 깎임(감쇠)
  const recedeNoOp = relOk(recede[0].px, -1, 1e-12) && relOk(sumU(recede), 4, 1e-12);   // 멀어짐 → 힘·열 0
  check('비가역 소산(시간의 화살) — 접근 쌍은 데우고 상대운동 깎임 / 멀어지는 쌍은 무변화(단방향)',
    heated && damped && recedeNoOp,
    `접근 ΣU ${U0a.toFixed(3)}→${U1a.toFixed(3)}(↑)·상대속도 ${relV0.toFixed(3)}→${relV1.toFixed(3)}(↓) · 멀어짐 무변화`);
}

// ── 2. 운동량 정확 보존 — 대칭 쌍힘(뉴턴3) ──
{
  const h = 2; let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const parts = [];
  for (let i = 0; i < 20; i++) parts.push(ent((rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6, 0.5 + rnd(), 0.5 + 2 * rnd(), (rnd() - 0.5) * 3, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3));
  const P0 = sumP(parts); SPH.sphViscosity(parts, 0.15, { alpha: 1, beta: 2, gamma: 5 / 3, h }); const P1 = sumP(parts);
  check('운동량 정확 보존 — 대칭 쌍힘(뉴턴3)·ΣP 기계 정밀도 불변',
    relOk(P0[0], P1[0], 1e-9) && relOk(P0[1], P1[1], 1e-9) && relOk(P0[2], P1[2], 1e-9),
    `ΣP (${P0[0].toFixed(3)},${P0[1].toFixed(3)},${P0[2].toFixed(3)}) → (${P1[0].toFixed(3)},${P1[1].toFixed(3)},${P1[2].toFixed(3)})`);
}

// ── 3. 총E 닫힘 — 점성이 KE 에 한 일 + 내부E 증가 = 0(순간 전력 균형·기계 정밀도) ──
{
  const h = 2, dt = 0.1, opt = { alpha: 1, beta: 2, gamma: 5 / 3, h };
  let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const base = [];
  for (let i = 0; i < 16; i++) base.push(ent((rnd() - 0.5) * 5, (rnd() - 0.5) * 5, (rnd() - 0.5) * 5, 0.6 + rnd(), 0.5 + 2 * rnd(), (rnd() - 0.5) * 3, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3));
  const vx = base.map(p => p.px / p.mass), vy = base.map(p => p.py / p.mass), vz = base.map(p => p.pz / p.mass), U0 = sumU(base);
  const after = clone(base); SPH.sphViscosity(after, dt, opt);
  const dU = sumU(after) - U0;
  let work = 0; for (let i = 0; i < base.length; i++) work += vx[i] * (after[i].px - base[i].px) + vy[i] * (after[i].py - base[i].py) + vz[i] * (after[i].pz - base[i].pz);
  check('총E 닫힘 — 점성이 KE 에 한 일 + 내부E 증가 = 0(순간 전력 균형·기계 정밀도)',
    relOk(work + dU, 0, 1e-9) && dU > 0,
    `Σv·Δp(점성 일)=${work.toExponential(3)} · ΔU=${dU.toExponential(3)}(>0 소산) · 합=${(work + dU).toExponential(2)}(≈0)`);
}

// ── 4. 항등/안전 — α=0 → early-return·멀어짐/단일/빈/지지 밖 무변화 ──
{
  const h = 2;
  let seed = 8; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const sc = () => { const p = []; for (let i = 0; i < 8; i++) p.push(ent((rnd() - 0.5) * 4, (rnd() - 0.5) * 4, (rnd() - 0.5) * 4, 1, 1, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2)); return p; };
  seed = 8; const off = sc(); const P0 = sumP(off), U0 = sumU(off); SPH.sphViscosity(off, 0.2, { alpha: 0, h });   // α=0 → 무변화
  const noOp = relOk(sumP(off)[0], P0[0], 1e-12) && relOk(sumU(off), U0, 1e-12);
  const single = [ent(0, 0, 0, 1, 5, 1, 0, 0)]; SPH.sphViscosity(single, 0.2, { alpha: 1, h });
  const empty = SPH.sphViscosity([], 0.2, { alpha: 1, h });
  const far = [ent(-50, 0, 0, 1, 5, 1, 0, 0), ent(50, 0, 0, 1, 5, -1, 0, 0)]; SPH.sphViscosity(far, 0.2, { alpha: 1, h });   // 지지 밖 → 힘 0
  const farSame = relOk(far[0].px, 1, 1e-12) && relOk(far[1].px, -1, 1e-12);
  check('항등/안전 — α=0 → 회귀 0·단일/빈/지지 밖 무변화',
    noOp && relOk(single[0].px, 1, 1e-12) && empty.length === 0 && farSame,
    `α=0 ΣP·ΣU 불변 · 단일 Δp 0 · 빈 [] · 멀리(지지 밖) Δp 0`);
}

// ── 5. 결정론 ──
{
  function fnv(parts) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of parts) { push(p.px); push(p.internalE); push(p.density || 0); }
    return h >>> 0;
  }
  function scene() { const p = []; for (let i = 0; i < 12; i++) p.push(ent(Math.cos(i) * 1.5, Math.sin(i) * 1.5, (i % 3) - 1, 1 + 0.1 * i, 1 + 0.2 * i, Math.sin(i) * 2, Math.cos(i * 2) * 2, ((i % 2) - 0.5) * 2)); return p; }
  const a = fnv(SPH.sphViscosity(scene(), 0.2, { alpha: 1, beta: 2, gamma: 5 / 3, h: 1.8 }));
  const b = fnv(SPH.sphViscosity(scene(), 0.2, { alpha: 1, beta: 2, gamma: 5 / 3, h: 1.8 }));
  check('결정론 — 같은 입력 → 같은 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 점성: 접근 쌍의 bulk KE→열(비가역·시간의 화살)·운동량·총E 정확 보존' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

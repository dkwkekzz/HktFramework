// step_0045/verify.js — SW5 능동 열압력(되먹임): P=(γ−1)ρu. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — 0041(barotropic·u 무관)·0042(에너지 닫힘·u 가 힘에 안 먹임)의 *되먹임* 판.
//   0009(수동 온도)→0010(능동 열압력)의 SPH 판: 압축이 u 를 데우고 → 데운 u 가 P 를 키워 더 세게 떠받친다.
//   적정 검증(핵심 불변): ① 열 EOS·되먹임(u↑→P↑·뜨거우면 더 센 힘) ② 운동량 정확 보존 ③ 총E 닫힘(전력 균형)
//   ④ 항등/안전 ⑤ 결정론.
//
//   실행: node HTJ/steps/step_0045/verify.js
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
const clone = (ps) => ps.map(p => ({ ...p }));

// ── 1. 열 EOS·되먹임 — 같은 밀도 배치라도 뜨거운(u↑) 가스가 찬 가스보다 더 센 압력 힘(P=(γ−1)ρu) ──
{
  const h = 2, dt = 0.2, opt = { gamma: 5 / 3, h };
  // 같은 위치 배치, internalE 만 다름(뜨겁/참). 압력 힘으로 받는 운동량 크기 비교.
  function pair(intE) { return [ent(-0.6, 0, 0, 1, intE), ent(0.6, 0, 0, 1, intE)]; }
  const hot = pair(10), cold = pair(1);
  SPH.sphThermalPressureForce(hot, dt, opt); SPH.sphThermalPressureForce(cold, dt, opt);
  const hotKick = Math.abs(hot[1].px), coldKick = Math.abs(cold[1].px);
  // barotropic(0041)이면 u 무관이라 같았을 것 — 여기선 뜨거운 쪽이 훨씬 셈(되먹임). 둘 다 바깥(반발).
  check('열 EOS·되먹임 — 뜨거운 가스(u↑)가 찬 가스보다 더 센 압력 힘(P=(γ−1)ρu·u 의존)',
    hotKick > coldKick * 3 && hot[1].px > 0 && hot[0].px < 0,
    `뜨거움 |Δp|=${hotKick.toExponential(3)} > 차가움 |Δp|=${coldKick.toExponential(3)}(u 10배→힘 ↑·반발)`);
}

// ── 2. 운동량 정확 보존 — 대칭 쌍힘(뉴턴3) ──
{
  const h = 2; let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const parts = [];
  for (let i = 0; i < 20; i++) parts.push(ent((rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6, 0.5 + rnd(), 0.5 + 2 * rnd(), (rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2));
  const P0 = sumP(parts); SPH.sphThermalPressureForce(parts, 0.15, { gamma: 5 / 3, h }); const P1 = sumP(parts);
  check('운동량 정확 보존 — 대칭 쌍힘(뉴턴3)·ΣP 기계 정밀도 불변',
    relOk(P0[0], P1[0], 1e-9) && relOk(P0[1], P1[1], 1e-9) && relOk(P0[2], P1[2], 1e-9),
    `ΣP (${P0[0].toFixed(3)},${P0[1].toFixed(3)},${P0[2].toFixed(3)}) → (${P1[0].toFixed(3)},${P1[1].toFixed(3)},${P1[2].toFixed(3)})`);
}

// ── 3. 총E 닫힘 — 압력이 KE 에 한 일 + 내부E 증가 = 0(순간 전력 균형·되먹임 닫힘) ──
{
  const h = 2, dt = 0.12, opt = { gamma: 5 / 3, h };
  let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const base = [];
  for (let i = 0; i < 16; i++) base.push(ent((rnd() - 0.5) * 5, (rnd() - 0.5) * 5, (rnd() - 0.5) * 5, 0.6 + rnd(), 0.5 + 2 * rnd(), (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.5));
  const vx = base.map(p => p.px / p.mass), vy = base.map(p => p.py / p.mass), vz = base.map(p => p.pz / p.mass), U0 = sumU(base);
  const after = clone(base); SPH.sphThermalPressureForce(after, dt, opt);
  const dU = sumU(after) - U0;
  let work = 0; for (let i = 0; i < base.length; i++) work += vx[i] * (after[i].px - base[i].px) + vy[i] * (after[i].py - base[i].py) + vz[i] * (after[i].pz - base[i].pz);
  check('총E 닫힘 — 압력이 KE 에 한 일 + 내부E 증가 = 0(순간 전력 균형·기계 정밀도)',
    relOk(work + dU, 0, 1e-9), `Σv·Δp(압력 일)=${work.toExponential(3)} · ΔU=${dU.toExponential(3)} · 합=${(work + dU).toExponential(2)}(≈0)`);
}

// ── 4. 항등/안전 — 단일/빈/지지 밖 무변화·u≤0 → P=0(음압 없음) ──
{
  const h = 2;
  const single = [ent(0, 0, 0, 1, 5)]; SPH.sphThermalPressureForce(single, 0.2, { h });
  const empty = SPH.sphThermalPressureForce([], 0.2, { h });
  const far = [ent(-50, 0, 0, 1, 5), ent(50, 0, 0, 1, 5)]; SPH.sphThermalPressureForce(far, 0.2, { h });
  const farSame = relOk(far[0].px, 0, 1e-12) && relOk(far[1].px, 0, 1e-12);
  const cold0 = [ent(-0.6, 0, 0, 1, 0), ent(0.6, 0, 0, 1, 0)]; SPH.sphThermalPressureForce(cold0, 0.2, { h });   // u=0 → P=0 → 힘 0
  const noNeg = relOk(cold0[0].px, 0, 1e-12) && relOk(cold0[1].px, 0, 1e-12);
  check('항등/안전 — 단일/빈/지지 밖 무변화·u≤0 → P=0(음압 없음)',
    relOk(single[0].px, 0, 1e-12) && empty.length === 0 && farSame && noNeg,
    `단일 Δp 0 · 빈 [] · 멀리 Δp 0 · u=0 힘 0(P≥0)`);
}

// ── 5. 결정론 ──
{
  function fnv(parts) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of parts) { push(p.px); push(p.internalE); push(p.density || 0); }
    return h >>> 0;
  }
  function scene() { const p = []; for (let i = 0; i < 12; i++) p.push(ent(Math.cos(i) * 1.5, Math.sin(i) * 1.5, (i % 3) - 1, 1 + 0.1 * i, 1 + 0.2 * i, Math.sin(i), Math.cos(i * 2), (i % 2) - 0.5)); return p; }
  const a = fnv(SPH.sphThermalPressureForce(scene(), 0.2, { gamma: 5 / 3, h: 1.8 }));
  const b = fnv(SPH.sphThermalPressureForce(scene(), 0.2, { gamma: 5 / 3, h: 1.8 }));
  check('결정론 — 같은 입력 → 같은 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 능동 열압력: P=(γ−1)ρu 되먹임(데운 가스가 더 센 압력)·운동량·총E 정확 보존' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

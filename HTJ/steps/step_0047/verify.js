// step_0047/verify.js — SW5 이웃 탐색 가속(공간 격자 셀 리스트). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 / §7 — SPH 합은 지지반경 2h 안 이웃만 기여(먼 쌍 W=0·∇W=0). 셀 크기=2h 격자로
//   27 이웃 셀만 훑어 O(N²)→O(N)(0032 Barnes-Hut 의 SPH·근거리 판). 물리 불변 — 같은 쌍 같은 순서 → brute 와 비트 동일.
//   적정 검증(핵심 불변): ① brute 와 정확 일치(밀도·압력·점성·열압력 비트 동일) ② 비용 O(N²)→O(N)(쌍 검사 수)
//   ③ 보존 불변(가속 경로 운동량·총E) ④ 항등/안전(grid 없으면 brute=기본·빈/단일) ⑤ 결정론.
//
//   실행: node HTJ/steps/step_0047/verify.js
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
const clone = (ps) => ps.map(p => ({ ...p }));
const sumP = (ps) => { let x = 0, y = 0, z = 0; for (const p of ps) { x += p.px; y += p.py; z += p.pz; } return [x, y, z]; };
const sumU = (ps) => ps.reduce((s, p) => s + p.internalE, 0);
// 무작위 가스 떼(겹치는 지지·밀도 변화) — 가속이 의미 있으려면 이웃이 실제로 많아야.
function cloud(n, seed, span) {
  span = span || 8; let s = seed; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const ps = [];
  for (let i = 0; i < n; i++) ps.push(ent((rnd() - 0.5) * span, (rnd() - 0.5) * span, (rnd() - 0.5) * span,
    0.5 + rnd(), 0.4 + 2 * rnd(), (rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2));
  return ps;
}
// 두 입자열이 비트 동일한지(px·py·pz·internalE·density) — 가속=brute 의 핵심 주장.
function bitEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].px !== b[i].px || a[i].py !== b[i].py || a[i].pz !== b[i].pz) return false;
    if ((a[i].internalE || 0) !== (b[i].internalE || 0)) return false;
    if ((a[i].density || 0) !== (b[i].density || 0)) return false;
  }
  return true;
}

// ── 1. brute 와 정확 일치(비트 동일) — 밀도·압력·점성·열압력 네 함수 모두 ──
{
  const h = 1.6;
  // 밀도: density 필드 비트 동일.
  const dB = cloud(50, 3), dG = clone(dB);
  SPH.sphDensity(dB, { h }); SPH.sphDensity(dG, { h, accelerate: true });
  let denOk = true; for (let i = 0; i < dB.length; i++) if (dB[i].density !== dG[i].density) denOk = false;
  // 압력·점성·열압력: 힘(px…)·internalE·density 비트 동일.
  const mk = () => cloud(50, 7);
  const pB = mk(), pG = clone(pB); SPH.sphPressureForce(pB, 0.1, { stiffness: 0.5, gamma: 2, h }); SPH.sphPressureForce(pG, 0.1, { stiffness: 0.5, gamma: 2, h, accelerate: true });
  const vB = mk(), vG = clone(vB); SPH.sphViscosity(vB, 0.1, { alpha: 1, beta: 2, gamma: 5 / 3, h }); SPH.sphViscosity(vG, 0.1, { alpha: 1, beta: 2, gamma: 5 / 3, h, accelerate: true });
  const tB = mk(), tG = clone(tB); SPH.sphThermalPressureForce(tB, 0.1, { gamma: 5 / 3, h }); SPH.sphThermalPressureForce(tG, 0.1, { gamma: 5 / 3, h, accelerate: true });
  check('brute 와 정확 일치(비트 동일) — 밀도·압력·점성·열압력 가속 경로 = brute',
    denOk && bitEqual(pB, pG) && bitEqual(vB, vG) && bitEqual(tB, tG),
    `밀도 ${denOk ? '=' : '≠'} · 압력 ${bitEqual(pB, pG) ? '=' : '≠'} · 점성 ${bitEqual(vB, vG) ? '=' : '≠'} · 열압력 ${bitEqual(tB, tG) ? '=' : '≠'}`);
}

// ── 2. 비용 O(N²)→O(N) — N 늘릴 때 쌍 검사 수: brute=N(N−1)/2(∝N²)·grid≈c·N(균일 밀도) ──
{
  const h = 1.0, spacing = 1.3;       // 셀 크기 2h=2.0 · 격자 간격 1.3 → 셀당 입자 수 일정(균일 밀도)
  function lattice(side) { const ps = []; for (let x = 0; x < side; x++) for (let y = 0; y < side; y++) for (let z = 0; z < side; z++) ps.push(ent(x * spacing, y * spacing, z * spacing, 1, 1)); return ps; }
  function gridPairs(ps) { const g = SPH.sphNeighborGrid(ps, { h }); let c = 0; for (let i = 0; i < ps.length; i++) { const nb = SPH.sphNeighbors(g, ps, i); for (let t = 0; t < nb.length; t++) if (nb[t] > i) c++; } return c; }
  const s1 = lattice(4), s2 = lattice(8);   // N=64 vs 512 (×8)
  const N1 = s1.length, N2 = s2.length;
  const g1 = gridPairs(s1), g2 = gridPairs(s2);
  const b1 = N1 * (N1 - 1) / 2, b2 = N2 * (N2 - 1) / 2;
  const gridRatio = g2 / g1, bruteRatio = b2 / b1, Nratio = N2 / N1;   // N×8
  // grid 는 ~선형(비율 ≈ N비 8)·brute 는 ~제곱(비율 ≈ 64). grid 가 brute 보다 훨씬 완만 + grid 쌍 ≪ brute 쌍.
  check('비용 O(N²)→O(N) — 쌍 검사 수: grid 선형·brute 제곱',
    gridRatio < Nratio * 1.5 && gridRatio < bruteRatio * 0.25 && g2 < b2 * 0.3,
    `N ${N1}→${N2}(×${Nratio}) · grid 쌍 ${g1}→${g2}(×${gridRatio.toFixed(1)}≈선형) · brute 쌍 ${b1}→${b2}(×${bruteRatio.toFixed(0)}≈제곱)`);
}

// ── 3. 보존 불변(가속 경로) — 운동량·총E 가 가속해도 보존(brute 와 같이) ──
{
  const h = 1.6, dt = 0.08;
  const ps = cloud(60, 13);
  const P0 = sumP(ps);
  const vx = ps.map(p => p.px / p.mass), vy = ps.map(p => p.py / p.mass), vz = ps.map(p => p.pz / p.mass), U0 = sumU(ps);
  const before = clone(ps);
  SPH.sphViscosity(ps, dt, { alpha: 1, beta: 2, gamma: 5 / 3, h, accelerate: true });
  const P1 = sumP(ps);
  let work = 0; for (let i = 0; i < ps.length; i++) work += vx[i] * (ps[i].px - before[i].px) + vy[i] * (ps[i].py - before[i].py) + vz[i] * (ps[i].pz - before[i].pz);
  const dU = sumU(ps) - U0;
  check('보존 불변(가속 경로) — 운동량 정확·총E 닫힘(KE 일+ΔU=0)',
    relOk(P0[0], P1[0], 1e-9) && relOk(P0[1], P1[1], 1e-9) && relOk(P0[2], P1[2], 1e-9) && relOk(work + dU, 0, 1e-9),
    `ΣP 불변 (${P0[0].toFixed(2)},${P0[1].toFixed(2)},${P0[2].toFixed(2)})→(${P1[0].toFixed(2)},${P1[1].toFixed(2)},${P1[2].toFixed(2)}) · KE 일+ΔU=${(work + dU).toExponential(2)}`);
}

// ── 4. 항등/안전 — grid 미지정 → brute(기본)·빈/단일 무탈·prebuilt grid 재사용 = accelerate 와 동일 ──
{
  const h = 1.6;
  const def = cloud(20, 21), brt = clone(def);
  SPH.sphDensity(def, { h });                      // 기본(grid 미지정) = brute
  SPH.sphDensity(brt, { h });
  let same = true; for (let i = 0; i < def.length; i++) if (def[i].density !== brt[i].density) same = false;
  const empty = SPH.sphDensity([], { h, accelerate: true });
  const single = [ent(0, 0, 0, 1, 5)]; SPH.sphDensity(single, { h, accelerate: true });
  const singleOk = single[0].density === single[0].mass * SPH.kernelW(0, h);   // 자기 기여만
  // prebuilt grid 객체 직접 넘기기 = accelerate:true 와 동일.
  const pa = cloud(40, 33), pb = clone(pa);
  const g = SPH.sphNeighborGrid(pa, { h });
  SPH.sphPressureForce(pa, 0.1, { stiffness: 0.5, h, grid: g });
  SPH.sphPressureForce(pb, 0.1, { stiffness: 0.5, h, accelerate: true });
  let preOk = true; for (let i = 0; i < pa.length; i++) if (pa[i].px !== pb[i].px) preOk = false;
  check('항등/안전 — grid 미지정→brute·빈/단일 무탈·prebuilt grid=accelerate',
    same && empty.length === 0 && singleOk && preOk,
    `기본=brute ${same ? '=' : '≠'} · 빈 [] · 단일 자기기여 ${singleOk} · prebuilt=accelerate ${preOk}`);
}

// ── 5. 결정론 — 가속 경로도 같은 입력 → 같은 지문 ──
{
  function fnv(parts) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of parts) { push(p.px); push(p.internalE); push(p.density || 0); }
    return h >>> 0;
  }
  const a = fnv(SPH.sphViscosity(cloud(30, 99), 0.1, { alpha: 1, beta: 2, gamma: 5 / 3, h: 1.7, accelerate: true }));
  const b = fnv(SPH.sphViscosity(cloud(30, 99), 0.1, { alpha: 1, beta: 2, gamma: 5 / 3, h: 1.7, accelerate: true }));
  check('결정론 — 가속 경로 같은 입력 → 같은 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 이웃 탐색 가속: 셀 리스트로 O(N²)→O(N)·brute 와 비트 동일·보존 불변' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

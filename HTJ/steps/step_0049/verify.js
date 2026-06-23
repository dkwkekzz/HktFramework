// step_0049/verify.js — SW5 열전도(thermal conduction). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — "구체 떼가 가스처럼 거동(압력·확산)". 0046 점성이 bulk 운동을 식혔다면,
//   이건 *온도 차*를 식힌다 = 0002 확산(열역학 제2법칙)의 SPH 판. 라플라시안 SPH 근사(Brookshaw):
//     du_i/dt = Σ_j m_j(κ_i+κ_j)/(ρ_iρ_j)(u_i−u_j)(r_ij·∇_iW)/(r²+ε). 대칭 쌍 계수 → 총 내부E 정확 보존·열 hot→cold.
//   적정 검증: ① 새 거동=열 확산(평형화) ② 총 내부E 정확 보존 ③ 단방향=온도 분산 단조↓(엔트로피↑) ④ 운동/KE 불변
//   ⑤ 항등/안전(균일 u 무변화·κ=0→회귀0·빈/단일) ⑥ 결정론.
//   실행: node HTJ/steps/step_0049/verify.js
'use strict';
const path = require('path');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) + 1e-9 * Math.abs(b);

// u = 비내부E(internalE/질량). px,py,pz 주면 KE 도 실림.
function ent(cx, cy, cz, mass, u, px, py, pz) {
  px = px || 0; py = py || 0; pz = pz || 0;
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  return { cx, cy, cz, mass, px, py, pz, KEcm, internalE: u * mass, energy: KEcm + u * mass };
}
const clone = (ps) => ps.map(p => ({ ...p }));
const sumU = (ps) => ps.reduce((s, p) => s + p.internalE, 0);
const uOf = (p) => p.internalE / p.mass;
const variance = (ps) => { const m = ps.reduce((s, p) => s + uOf(p), 0) / ps.length; return ps.reduce((s, p) => s + (uOf(p) - m) ** 2, 0) / ps.length; };
function rndGen(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
// 무작위 온도 가스 떼(겹치는 지지) — u 를 0~10 사이 무작위로.
function hotCloud(n, seed, span) {
  const rnd = rndGen(seed), ps = [];
  for (let i = 0; i < n; i++) ps.push(ent((rnd() - 0.5) * (span || 5), (rnd() - 0.5) * (span || 5), (rnd() - 0.5) * (span || 5),
    0.5 + rnd(), rnd() * 10, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2));
  return ps;
}
const KAPPA = 0.5, H = 1.6;

// ── 1. 새 거동 — 열 확산(평형화) — 뜨거운+차가운 → 평균으로 수렴 ──
{
  const ps = [ent(0, 0, 0, 1, 10), ent(1, 0, 0, 1, 0)];   // u: 10 옆 0
  const mean0 = sumU(ps) / ps.length;                      // 보존되므로 평균=5
  for (let t = 0; t < 200; t++) SPH.sphThermalConduction(ps, 0.05, { kappa: KAPPA, h: H });
  const converged = relOk(uOf(ps[0]), 5, 1e-3) && relOk(uOf(ps[1]), 5, 1e-3) && uOf(ps[0]) < 10 && uOf(ps[1]) > 0;
  check('새 거동 — 열 확산(뜨거운+차가운 → 평형)', converged, `u 10,0 → ${uOf(ps[0]).toFixed(3)},${uOf(ps[1]).toFixed(3)}(평균 ${mean0})`);
}

// ── 2. 총 내부E 정확 보존 — 대칭 쌍 교환 Σ=0 (재분배만) ──
{
  const ps = hotCloud(40, 7);
  const U0 = sumU(ps);
  for (let t = 0; t < 30; t++) SPH.sphThermalConduction(ps, 0.04, { kappa: KAPPA, h: H });
  const U1 = sumU(ps);
  check('총 내부E 정확 보존 — 대칭 교환 Σ=0', relOk(U0, U1, 1e-9), `ΣU ${U0.toFixed(6)} → ${U1.toFixed(6)} · Δ ${Math.abs(U1 - U0).toExponential(2)}`);
}

// ── 3. 단방향(엔트로피↑) — 온도 분산 단조 감소(섞임만·안 풀림) ──
{
  const ps = hotCloud(40, 13);
  let prev = variance(ps), mono = true, maxRise = 0;
  for (let t = 0; t < 60; t++) {
    SPH.sphThermalConduction(ps, 0.03, { kappa: KAPPA, h: H });
    const v = variance(ps);
    if (v > prev + 1e-12) { mono = false; maxRise = Math.max(maxRise, v - prev); }
    prev = v;
  }
  check('단방향(엔트로피↑) — 온도 분산 단조 감소', mono && prev < variance(hotCloud(40, 13)) * 0.5,
    `분산 ${variance(hotCloud(40, 13)).toFixed(3)} → ${prev.toFixed(3)} · 단조 ${mono}`);
}

// ── 4. 운동/KE 불변 — 전도는 운동량·KE 안 건드리고 internalE 만 재분배 ──
{
  const ps = hotCloud(30, 21), before = clone(ps);
  for (let t = 0; t < 20; t++) SPH.sphThermalConduction(ps, 0.04, { kappa: KAPPA, h: H });
  let pOk = true, keOk = true;
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].px !== before[i].px || ps[i].py !== before[i].py || ps[i].pz !== before[i].pz) pOk = false;
    if (ps[i].KEcm !== before[i].KEcm) keOk = false;
  }
  // 총E=Σ(KE+u): KE 불변·U 보존 → 총E 보존
  const totE0 = before.reduce((s, p) => s + p.energy, 0), totE1 = ps.reduce((s, p) => s + p.energy, 0);
  check('운동/KE 불변 — internalE 만 재분배 · 총E 보존', pOk && keOk && relOk(totE0, totE1, 1e-9),
    `운동량 불변 ${pOk} · KE 불변 ${keOk} · 총E ${totE0.toFixed(4)}→${totE1.toFixed(4)}`);
}

// ── 5. 항등/안전 — 균일 u → 무변화 · κ=0 → 회귀0 · 빈/단일 무탈 ──
{
  const uni = [ent(0, 0, 0, 1, 5), ent(1, 0, 0, 1.2, 5), ent(0.5, 0.7, 0, 0.8, 5)];   // 균일 u=5(질량 달라도)
  const b0 = uni.map(p => p.internalE);
  SPH.sphThermalConduction(uni, 0.1, { kappa: KAPPA, h: H });
  const uniformNoOp = uni.every((p, i) => Math.abs(p.internalE - b0[i]) < 1e-12);   // 기울기 0 → 흐름 0
  const off = hotCloud(20, 33), b1 = off.map(p => p.internalE);
  SPH.sphThermalConduction(off, 0.1, { kappa: 0, h: H });                            // κ=0 → 무변화
  const kappaZero = off.every((p, i) => p.internalE === b1[i]);
  const empty = SPH.sphThermalConduction([], 0.1, { kappa: KAPPA });
  const single = [ent(0, 0, 0, 1, 5)]; SPH.sphThermalConduction(single, 0.1, { kappa: KAPPA, h: H });
  const singleOk = single[0].internalE === 5;                                        // 이웃 없음 → 무변화
  check('항등/안전 — 균일 u 무변화 · κ=0 회귀0 · 빈/단일',
    uniformNoOp && kappaZero && empty.length === 0 && singleOk,
    `균일 무변화 ${uniformNoOp} · κ=0 회귀 ${kappaZero} · 빈 [] · 단일 ${singleOk}`);
}

// ── 6. 결정론 — 같은 입력 → 같은 지문 ──
{
  function fnv(ps) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of ps) push(p.internalE);
    return h >>> 0;
  }
  const run = (seed) => { const ps = hotCloud(30, seed); for (let t = 0; t < 10; t++) SPH.sphThermalConduction(ps, 0.04, { kappa: KAPPA, h: H }); return fnv(ps); };
  const a = run(99), b = run(99);
  check('결정론 — 같은 입력 → 같은 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 열전도: 온도 차를 평형화(0002 확산의 SPH 판)·총 내부E 정확 보존·엔트로피↑ 단방향' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

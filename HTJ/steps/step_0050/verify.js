// step_0050/verify.js — 격자 ↔ 구체(SPH) 정성 일치(SW5 verify gate·격자 은퇴의 전제). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — "구체 떼가 가스처럼 거동·보존·*격자 결과와 정성 일치*". SPH 가 이제 압력(0041)·
//   에너지 닫힘(0042)·능동 열압력(0045)·점성(0046)·확산(0049)을 갖췄다. 이 step 은 *새 법칙이 아니라* 두 substrate
//   (격자 유체 0002~0013 ↔ 구체 SPH 0040~0049)를 **같은 물리 시나리오**(자기중력 가스 붕괴)로 돌려, 둘이 *같은
//   창발 시그니처*(붕괴=중심 밀도↑ + 코어 압축 가열=중심 온도↑)를 내는지 본다 = 격자 은퇴(SW5 최후)의 전제.
//   조립/관찰 step(새 engine 법칙 0·구조적 회귀 0) — verify 는 *교차 substrate 일치 + 각자 보존*만.
//   적정 검증: ① 격자 붕괴+가열+보존 ② SPH 붕괴+가열+보존 ③ 정성 일치(두 substrate 같은 시그니처) ④ 결정론.
//   실행: node HTJ/steps/step_0050/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-6 * Math.abs(b);

// ── 격자 유체 자기중력 붕괴(0007 중력 + 0010 열압력 + 0006 이류) ──
function latticeCollapse(N, steps) {
  const w = W.createWorld(N);
  const rho = w.fields.energy, u = w.addField('therm');
  const c = (N - 1) / 2, sig = N * 0.16, ci = (c | 0);
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2, i = (z * N + y) * N + x;
    const r = 2.0 * Math.exp(-d2 / (2 * sig * sig)) + 0.02;   // 중앙 피크 가우시안 밀도
    rho[i] = r; u[i] = r * 0.3;                               // 균일 온도 T0=0.3 (u=ρT)
  }
  const ctr = (ci * N + ci) * N + ci;
  const rhoC = () => rho[ctr], tempC = () => rho[ctr] > 1e-9 ? u[ctr] / rho[ctr] : 0;
  const netP = () => { const gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; if (!gx) return 0; let x = 0, y = 0, z = 0; for (let i = 0; i < gx.length; i++) { x += gx[i]; y += gy[i]; z += gz[i]; } return Math.hypot(x, y, z); };
  const series = [];
  const M0 = w.total('energy');
  for (let t = 0; t < steps; t++) {
    series.push([rhoC(), tempC()]);
    Gr.applyGravity(w, 0.2, { G: 0.25, iters: 40 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  series.push([rhoC(), tempC()]);
  return { series, M0, M1: w.total('energy'), netP: netP(), fp: w.fingerprint('energy') };
}

// ── 구체 SPH 자기중력 붕괴(0028 중력 + 0045 능동 열압력) ──
function sphCollapse(NP, steps) {
  let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ps = [];
  for (let i = 0; i < NP; i++) {
    const r = 2 + rnd() * 8, th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1);
    const ux = Math.sin(ph) * Math.cos(th), uy = Math.sin(ph) * Math.sin(th), uz = Math.cos(ph), m = 1, vin = -0.4;
    ps.push({ cx: r * ux, cy: r * uy, cz: r * uz, mass: m, px: m * vin * ux, py: m * vin * uy, pz: m * vin * uz, KEcm: 0.5 * m * vin * vin, internalE: 0.08, energy: 0.08 + 0.5 * m * vin * vin });
  }
  const com = () => { let x = 0, y = 0, z = 0; for (const p of ps) { x += p.cx; y += p.cy; z += p.cz; } return [x / ps.length, y / ps.length, z / ps.length]; };
  const rhoMax = () => { SPH.sphDensity(ps, { h: 2.8 }); let mx = 0; for (const p of ps) if (p.density > mx) mx = p.density; return mx; };
  const coreU = () => { const [cx, cy, cz] = com(); const ds = ps.map(p => Math.hypot(p.cx - cx, p.cy - cy, p.cz - cz)).sort((a, b) => a - b); const R = ds[Math.floor(ds.length * 0.3)]; let s = 0, n = 0; for (const p of ps) { if (Math.hypot(p.cx - cx, p.cy - cy, p.cz - cz) <= R) { s += p.internalE / p.mass; n++; } } return n ? s / n : 0; };
  const netP = () => { let x = 0, y = 0, z = 0; for (const p of ps) { x += p.px; y += p.py; z += p.pz; } return Math.hypot(x, y, z); };
  const totE = () => ps.reduce((s, p) => s + p.energy, 0), mass = () => ps.reduce((s, p) => s + p.mass, 0);
  const series = [];
  const M0 = mass(), P0 = netP(), E0 = totE();
  for (let t = 0; t < steps; t++) {
    series.push([rhoMax(), coreU()]);
    En.applyEntityGravity(ps, 0.08, { G: 0.8, soft: 2 });
    SPH.sphThermalPressureForce(ps, 0.08, { gamma: 5 / 3, h: 2.8 });
    En.stepEntities(ps, 0.08, { N: 200 });
  }
  series.push([rhoMax(), coreU()]);
  let fp = 0x811c9dc5 >>> 0; const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { fp ^= b[k]; fp = Math.imul(fp, 0x01000193) >>> 0; } };
  for (const p of ps) { push(p.cx); push(p.internalE); }
  return { series, M0, M1: mass(), P0, P1: netP(), E0, E1: totE(), fp: fp >>> 0 };
}

const rose = (s, f) => s[s.length - 1][f] / (s[0][f] + 1e-12);   // 마지막/처음 비(붕괴·가열 배율)

// ── 1. 격자 붕괴+가열+보존 — 중심 밀도↑ · 중심 온도↑ · 질량 보존 · 순 운동량 보존(~0) ──
const L = latticeCollapse(24, 24);
{
  const rhoUp = rose(L.series, 0), tempUp = rose(L.series, 1);
  check('격자 붕괴+가열+보존 — 중심ρ↑·중심T↑·질량/운동량 보존',
    rhoUp > 5 && tempUp > 2 && relOk(L.M0, L.M1, 1e-9) && L.netP < 1e-6,
    `중심ρ ×${rhoUp.toFixed(1)} · 중심T ×${tempUp.toFixed(1)} · 질량 ${L.M0.toFixed(2)}→${L.M1.toFixed(2)} · |ΣP| ${L.netP.toExponential(1)}`);
}

// ── 2. SPH 붕괴+가열+보존 — 최대 밀도↑ · 코어 온도↑ · 질량·순 운동량 정확 보존 ──
//   (총E=KE+u 는 중력이 PE→KE 로 일을 해 *증가*가 맞다 — 중력 PE 미포함. 각 연산자 에너지 닫힘은
//    부품 verify 0041/0042/0045 가 이미 보증·조립 step 은 파이프라인 질량·운동량만.)
const S = sphCollapse(120, 40);
{
  const rhoUp = rose(S.series, 0), coreUp = rose(S.series, 1);
  check('SPH 붕괴+가열+보존 — 최대ρ↑·코어u↑·질량/운동량 보존',
    rhoUp > 1.5 && coreUp > 1.5 && relOk(S.M0, S.M1, 1e-9) && relOk(S.P0, S.P1, 1e-6),
    `최대ρ ×${rhoUp.toFixed(2)} · 코어u ×${coreUp.toFixed(2)} · 질량 ${S.M0}→${S.M1} · |ΣP| ${S.P0.toFixed(3)}→${S.P1.toFixed(3)}(보존)`);
}

// ── 3. 정성 일치(헤드라인) — 두 substrate 가 *같은 창발 시그니처*: 붕괴(ρ_c↑) + 코어 가열(T_c↑) ──
{
  const latColl = rose(L.series, 0) > 1.5, latHeat = rose(L.series, 1) > 1.2;
  const sphColl = rose(S.series, 0) > 1.5, sphHeat = rose(S.series, 1) > 1.2;
  // 같은 입력(자기중력 가스)→ 같은 출력(붕괴+가열). 표현(격자/구체)이 달라도 *창발 물리가 일치*.
  check('정성 일치 — 격자·SPH 둘 다 붕괴+코어 가열(SW5 gate)',
    latColl && latHeat && sphColl && sphHeat,
    `격자[붕괴 ${latColl}·가열 ${latHeat}] · SPH[붕괴 ${sphColl}·가열 ${sphHeat}]`);
}

// ── 4. 결정론 — 두 substrate 모두 같은 입력 → 같은 지문 ──
{
  const L2 = latticeCollapse(24, 24), S2 = sphCollapse(120, 40);
  check('결정론 — 격자·SPH 같은 입력 → 같은 지문',
    L.fp === L2.fp && S.fp === S2.fp,
    `격자 0x${L.fp.toString(16)} · SPH 0x${S.fp.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — 격자↔구체 정성 일치: 자기중력 가스가 두 substrate 모두 붕괴+코어 가열(격자 은퇴의 전제·SW5 gate)' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

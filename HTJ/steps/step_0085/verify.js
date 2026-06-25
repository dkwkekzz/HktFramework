// step_0085/verify.js — (조립) 격자 장면을 SPH 로: 자기중력 붕괴가 *격자 질량 0* 으로 입자만으로 일어난다.
//   조립 step → engine 변경 0(기존 법칙: sphPressureForce 0041 + sphViscosity 0046 + applyParticleMeshGravity 0078/0084(TSC) + stepEntities 0027).
//   부품 보존·물리는 각 step verify 가 보증 → 여기선 *합쳐서 생긴 창발*만: 0007 이 격자 ρ 의 Poisson 으로 하던
//   자기중력 붕괴를, 격자를 *비운 채* 입자(SPH)만으로 재현한다(격자 은퇴 정당화). 순수·독립·영구.
//   실행: node HTJ/steps/step_0085/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Grav = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const N = 20, CTR = (N - 1) / 2, G = 10, STIFF = 6, DT = 0.016, NP = 150, R0 = 4;
const popt = { stiffness: STIFF, h: 2.6, gamma: 1.5 }, vopt = { alpha: 0.8, beta: 1.2, h: 2.6, gamma: 1.5 };
function emptyWorld() { const w = W.createWorld(N); if (!w.fields.energy) w.addField('energy'); for (const f of ['mom_x', 'mom_y', 'mom_z']) if (!w.fields[f]) w.addField(f); return w; }
function mk(cx, cy, cz) { return { cx, cy, cz, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 }; }
function build() {
  const P = []; let seed = 9; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < NP; i++) { let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1); P.push(mk(CTR + x * R0, CTR + y * R0, CTR + z * R0)); }
  return P;
}
function rms(P) { let cx = 0, cy = 0, cz = 0; for (const p of P) { cx += p.cx; cy += p.cy; cz += p.cz; } cx /= P.length; cy /= P.length; cz /= P.length; let s = 0; for (const p of P) s += (p.cx - cx) ** 2 + (p.cy - cy) ** 2 + (p.cz - cz) ** 2; return Math.sqrt(s / P.length); }
function run(steps, pressure) {
  const w = emptyWorld(), P = build(); const r0 = rms(P); let mn = r0;
  for (let s = 0; s < steps; s++) {
    if (pressure) { Sph.sphPressureForce(P, DT, popt); Sph.sphViscosity(P, DT, vopt); }
    Grav.applyParticleMeshGravity(w, P, DT, { G, iters: 80, tsc: true });
    En.stepEntities(P, DT);
    const r = rms(P); if (r < mn) mn = r;
  }
  let gridSum = 0; const e = w.fields.energy; for (let i = 0; i < e.length; i++) gridSum += Math.abs(e[i]);
  const heat = P.reduce((a, p) => a + (p.internalE || 0), 0);
  return { r0, mn, gridSum, heat, mass: P.reduce((a, p) => a + p.mass, 0), px: P.reduce((a, p) => a + p.px, 0), py: P.reduce((a, p) => a + p.py, 0), pz: P.reduce((a, p) => a + p.pz, 0) };
}

const on = run(220, true);

// ① 자기중력 붕괴(격자 없이) — 입자 블롭이 스스로 끌려 RMS 반경이 크게 준다(min < 0.5×r0).
ok(on.mn < on.r0 * 0.5, `자기중력 붕괴(입자만) — RMS 반경 ${on.r0.toFixed(2)} → 최소 ${on.mn.toFixed(2)}(< 0.5×r0·격자 없이 모인다)`);

// ② 격자 질량 0 — PM 중력이 입자만으로 옛 격자(0007 ρ Poisson) 자기중력을 대신한다(은퇴).
ok(on.gridSum < 1e-9, `격자 질량 0 — Σ|격자 장| = ${on.gridSum.toExponential(1)}(PM 중력이 입자만으로·격자 은퇴 정당화)`);

// ③ 붕괴가 열로 — 압력/점성이 낙하 KE 를 internalE 로(별 형성·비가역 가열). 압력 OFF → 0.
(() => {
  const off = run(220, false);
  ok(on.heat > 1 && off.heat < 1e-9, `붕괴 가열 — Σ internalE: 압력ON ${on.heat.toFixed(1)} > 0 · OFF ${off.heat.toFixed(1)}(낙하 KE→열·비가역)`);
})();

// ④ 보존 — 입자 질량 일정 + 정지 시작 → 순 운동량 0.
show(L.conserved('입자 질량(붕괴 220 step)', NP, on.mass));
ok(Math.abs(on.px) < 1e-9 && Math.abs(on.py) < 1e-9 && Math.abs(on.pz) < 1e-9,
  `순 운동량 보존 — 정지 시작 → Σp = (${on.px.toExponential(2)}, ${on.py.toExponential(2)}, ${on.pz.toExponential(2)}) ≈ 0`);

// ⑤ 결정론 — 같은 입력 → 같은 붕괴.
show(L.deterministic('같은 법칙 → 같은 붕괴', () => {
  const w = emptyWorld(), P = build();
  for (let s = 0; s < 40; s++) { Sph.sphPressureForce(P, DT, popt); Sph.sphViscosity(P, DT, vopt); Grav.applyParticleMeshGravity(w, P, DT, { G, iters: 60, tsc: true }); En.stepEntities(P, DT); }
  return P.map(p => [p.cx.toFixed(5), p.cz.toFixed(5), p.internalE.toFixed(4)]);
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

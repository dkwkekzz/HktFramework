// step_0087/verify.js — (조립) 비리얼 평형 별 코어: 압력이 중력 붕괴를 *유한 코어*에서 멈춘다.
//   조립 step → engine 변경 0. 0085 는 격자 ρ Poisson 자기중력을 입자만으로 *붕괴*시켰다(RMS 3.03→0.12·점으로).
//   이 step 은 그 위에 *되먹임 압력*(0045 sphThermalPressureForce)+*점성 감쇠*(0046)를 얹어 — 붕괴가 가스를 데우고,
//   데운 가스의 압력이 *떠받쳐* 붕괴를 유한 반경에서 멈춘다. 비리얼 근처(U0≈½|W0|)에서 시작해 점성이 잔여
//   bulk 운동을 깎으면 **비리얼 평형**에 정착: 2(K_bulk + U) + W ≈ 0 (γ=5/3 단원자 → Q=2(K+U)/|W|→1).
//   힘=중력(0028 applyEntityGravity 쌍힘)·PE=같은 법칙(0028 pairPotentialEnergy) → 비리얼 수지가 *정확히* 닫힌다.
//   부품 보존은 각 step verify 가 보증 → 여기선 *합쳐서 생긴 창발*(유한 코어·비리얼·압력 지지)+운동량 보존만.
//   순수·독립·영구. 실행: node HTJ/steps/step_0087/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// ── 무대(결정론 시드)·법칙 조립 ─────────────────────────────────────────────
const CFG = { u0: 7, NP: 120, R0: 5, G: 1, soft: 0.8, h: 2.2, gamma: 5 / 3, alpha: 1.0, beta: 2.0, dt: 0.002, seed0: 7 };
const STEPS = 2500, AVG = 500;       // 마지막 AVG step 평균(잔여 진동 평활)
function build() {
  let seed = CFG.seed0; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const P = [];
  for (let i = 0; i < CFG.NP; i++) { let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
    P.push({ cx: x * CFG.R0, cy: y * CFG.R0, cz: z * CFG.R0, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: CFG.u0, KEcm: 0, energy: CFG.u0, radius: 1 }); }
  return P;
}
function rmsOf(P) { let mx = 0, my = 0, mz = 0; for (const p of P) { mx += p.cx; my += p.cy; mz += p.cz; } mx /= P.length; my /= P.length; mz /= P.length;
  let s = 0; for (const p of P) { const dx = p.cx - mx, dy = p.cy - my, dz = p.cz - mz; s += dx * dx + dy * dy + dz * dz; } return Math.sqrt(s / P.length); }
function enOf(P) { let K = 0, U = 0; for (const p of P) { K += 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / p.mass; U += p.internalE; }
  const W = En.pairPotentialEnergy(P, { G: CFG.G, soft: CFG.soft }); return { K, U, W, Q: (2 * (K + U)) / Math.abs(W) }; }
// 한 step = 중력(0028) + [되먹임 압력(0045)] + 점성(0046) + 자유 운동(0027).
function step(P, pressure) {
  En.applyEntityGravity(P, CFG.dt, { G: CFG.G, soft: CFG.soft });
  if (pressure) Sph.sphThermalPressureForce(P, CFG.dt, { gamma: CFG.gamma, h: CFG.h });
  Sph.sphViscosity(P, CFG.dt, { alpha: CFG.alpha, beta: CFG.beta, gamma: CFG.gamma, h: CFG.h });
  En.stepEntities(P, CFG.dt);
}

// 압력 ON 본 실행 — 마지막 AVG step 평균 Q·rms·K·U + 최종 운동량.
const P = build(); const e0 = enOf(P);
let qS = 0, rS = 0, kS = 0, uS = 0, cnt = 0;
for (let s = 0; s < STEPS; s++) { step(P, true); if (s >= STEPS - AVG) { const v = enOf(P); qS += v.Q; rS += rmsOf(P); kS += v.K; uS += v.U; cnt++; } }
const Qavg = qS / cnt, Ravg = rS / cnt, Kavg = kS / cnt, Uavg = uS / cnt;
let mpx = 0, mpy = 0, mpz = 0; for (const p of P) { mpx += p.px; mpy += p.py; mpz += p.pz; }
// 압력 OFF 대조 — 같은 시드, 압력만 끔 → 점으로 붕괴.
const Poff = build(); for (let s = 0; s < STEPS; s++) step(Poff, false); const Roff = rmsOf(Poff);

// ① 압력이 붕괴를 멈춘다 — 유한 코어(핵심): ON 은 유계 반경에 정착, OFF 는 점으로 붕괴. R_on/R_off ≫ 1.
ok(Ravg > 1 && Ravg < CFG.R0 * 2 && Roff < 0.2 && Ravg / Roff > 10,
  `유한 코어 — 압력 ON ⟨rms⟩=${Ravg.toFixed(3)}(유계·정착) vs OFF rms=${Roff.toFixed(3)}(점 붕괴)·비 ${(Ravg / Roff).toFixed(0)}×(압력이 붕괴 멈춤)`);
// ② 비리얼 평형(핵심): Q = 2(K_bulk+U)/|W| → 1 (γ=5/3 단원자·softened 중력 ~7% 편차).
ok(Qavg > 0.85 && Qavg < 1.25,
  `비리얼 평형 — ⟨Q⟩=2(K+U)/|W|=${Qavg.toFixed(3)} ≈ 1 (init ${e0.Q.toFixed(3)}→정착·2(K+U)+W≈0·별 코어)`);
// ③ 압력 지지(motion 아님) — bulk 운동E 가 점성으로 깎여 내부E≫bulk KE.
ok(Kavg / Uavg < 0.1,
  `압력 지지 — ⟨K_bulk⟩/⟨U⟩=${(Kavg / Uavg).toFixed(4)} ≪ 1(점성이 infall 깎음·코어는 *압력*이 떠받침·⟨K⟩=${Kavg.toFixed(1)} ⟨U⟩=${Uavg.toFixed(1)})`);
// ④ 운동량 보존 — 정지 시작 + 모든 힘 쌍힘(중력·압력·점성 equal-opposite) → Σp ≈ 0.
ok(Math.abs(mpx) < 1e-9 && Math.abs(mpy) < 1e-9 && Math.abs(mpz) < 1e-9,
  `운동량 보존 — 정지 시작 → Σp=(${mpx.toExponential(2)}, ${mpy.toExponential(2)}, ${mpz.toExponential(2)}) ≈ 0`);
// ⑤ 결정론 — 같은 입력 → 같은 평형(공용 가드).
show(L.deterministic('같은 입력 → 같은 비리얼 평형', () => {
  const Q = build(); for (let s = 0; s < 150; s++) step(Q, true);
  return Q.map(p => [p.cx.toFixed(5), p.px.toFixed(6), (p.internalE || 0).toFixed(4)]);
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

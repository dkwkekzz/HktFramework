// step_0088/verify.js — (조립) 정상상태 별: 가열(점화)↔냉각(복사) 균형으로 *지속하며 빛나는* 별.
//   조립 step → engine 변경 0. 0087 은 유한 코어 비리얼 평형(압력이 붕괴 멈춤)이나 *단열*(열의 출입 없음)이었다.
//   진짜 별은 *빛난다* — 내부에서 열을 만들고(점화 0053 sphIgnition·연료→열) 표면에서 잃는다(복사 0052
//   sphRadiativeCooling·열→빛). 이 step 은 그 둘을 0087 코어에 얹어 **에너지 정상상태**를 보인다: 가열률이
//   냉각률과 균형을 이뤄 내부E 가 *plateau*(붕괴도 폭주도 아님)·광도 L 이 *정상*·연료가 단조 소진(유한 수명).
//   부품 보존은 각 step verify 가 보증 → 여기선 *합쳐서 생긴 정상상태·광도·균형·전체 에너지 장부 닫힘*만.
//   순수·독립·영구. 실행: node HTJ/steps/step_0088/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const C = { u0: 7, NP: 120, R0: 5, G: 1, soft: 0.8, h: 2.2, gamma: 5 / 3, alpha: 1.0, beta: 2.0, dt: 0.002,
            fuel0: 20, ignRate: 3.5, uCrit: 3, coolRate: 0.5, floor: 1, seed0: 7 };
const STEPS = 2400, W0 = 600, W1 = 2100;     // 정상상태 측정창(점화 지속 구간)
function build() {
  let s = C.seed0; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const P = []; for (let i = 0; i < C.NP; i++) { let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
    P.push({ cx: x * C.R0, cy: y * C.R0, cz: z * C.R0, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: C.u0, KEcm: 0, energy: C.u0, radius: 1, fuel: C.fuel0, radiated: 0 }); }
  return P;
}
function sums(P) { let K = 0, U = 0, F = 0, R = 0; for (const p of P) { K += 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / p.mass; U += p.internalE; F += p.fuel; R += p.radiated; }
  const Wg = En.pairPotentialEnergy(P, { G: C.G, soft: C.soft }); return { K, U, F, R, Wg, budget: K + U + Wg + F + R }; }
function rms(P) { let mx = 0, my = 0, mz = 0; for (const p of P) { mx += p.cx; my += p.cy; mz += p.cz; } mx /= P.length; my /= P.length; mz /= P.length;
  let s = 0; for (const p of P) s += (p.cx - mx) ** 2 + (p.cy - my) ** 2 + (p.cz - mz) ** 2; return Math.sqrt(s / P.length); }
function step(P) {
  En.applyEntityGravity(P, C.dt, { G: C.G, soft: C.soft });
  Sph.sphThermalPressureForce(P, C.dt, { gamma: C.gamma, h: C.h });
  Sph.sphViscosity(P, C.dt, { alpha: C.alpha, beta: C.beta, gamma: C.gamma, h: C.h });
  Sph.sphIgnition(P, C.dt, { rate: C.ignRate, uCrit: C.uCrit });
  Sph.sphRadiativeCooling(P, C.dt, { coolRate: C.coolRate, floor: C.floor });
  En.stepEntities(P, C.dt);
}

const P = build(); const b0 = sums(P);
let Umin = Infinity, Umax = -Infinity, radW = 0, burnW = 0, fuelStart = 0, fuelEnd = 0, fuelMono = true, prevF = b0.F, rmsW = 0, cntW = 0;
for (let s = 0; s < STEPS; s++) {
  const before = sums(P); step(P); const after = sums(P);
  if (after.F > prevF + 1e-9) fuelMono = false; prevF = after.F;        // 연료 단조 소진 확인
  if (s >= W0 && s < W1) {
    if (after.U < Umin) Umin = after.U; if (after.U > Umax) Umax = after.U;
    radW += (after.R - before.R); burnW += (before.F - after.F); rmsW += rms(P); cntW++;
    if (s === W0) fuelStart = before.F; fuelEnd = after.F;
  }
}
const bF = sums(P);
const Umean = (Umin + Umax) / 2, Uspread = (Umax - Umin) / Umean;
const Lmean = radW / (cntW * C.dt), burnMean = burnW / (cntW * C.dt), balance = Math.abs(Lmean - burnMean) / burnMean;
let mpx = 0, mpy = 0, mpz = 0; for (const p of P) { mpx += p.px; mpy += p.py; mpz += p.pz; }

// ① 정상상태 별(핵심) — 가열↔냉각 균형 → 내부E 가 plateau(붕괴도 폭주도 아님), 큰 throughput 에도 거의 불변.
ok(Uspread < 0.15 && bF.U > 1,
  `정상상태 — 내부E plateau ⟨U⟩≈${Umean.toFixed(0)}(spread ${(Uspread * 100).toFixed(1)}% < 15%)·throughput L≈${Lmean.toFixed(0)}/t 인데도 U 거의 불변(가열↔냉각 균형)`);
// ② 가열≈냉각(핵심) — 정상상태의 정의: 들어온 열(연소)≈나간 빛(복사).
ok(balance < 0.15 && Lmean > 1,
  `가열≈냉각 — 연소 ${burnMean.toFixed(0)}/t ≈ 복사 광도 L ${Lmean.toFixed(0)}/t (불균형 ${(balance * 100).toFixed(1)}% < 15%·정상상태)`);
// ③ 빛나는 유한 수명 별 — 광도 L>0 지속(별이 빛난다) + 연료 단조 소진(유한 수명).
ok(Lmean > 1 && fuelMono && bF.F < b0.F,
  `빛나는 유한 수명 — 광도 L=${Lmean.toFixed(0)}>0 지속·연료 단조 소진 ${b0.F.toFixed(0)}→${bF.F.toFixed(0)}(유한 수명·연료→열→빛)`);
// ④ 전체 에너지 장부 닫힘 — KE+내부E+중력PE+연료+복사빛 = const(가열=fuel→u·냉각=u→radiated·압력/점성/중력 보존).
show(L.conserved('전체 에너지 장부 K+U+W+fuel+radiated', b0.budget, bF.budget, 2e-2));
// ⑤ 운동량 보존 — 정지 시작·점화/냉각은 운동량 불변·힘은 쌍힘 → Σp≈0.  (+결정론)
ok(Math.abs(mpx) < 1e-9 && Math.abs(mpy) < 1e-9 && Math.abs(mpz) < 1e-9,
  `운동량 보존 — 정지 시작 → Σp=(${mpx.toExponential(2)}, ${mpy.toExponential(2)}, ${mpz.toExponential(2)}) ≈ 0`);
show(L.deterministic('같은 입력 → 같은 정상상태', () => { const Q = build(); for (let s = 0; s < 150; s++) step(Q); return Q.map(p => [p.cx.toFixed(5), (p.internalE || 0).toFixed(4), (p.radiated || 0).toFixed(4)]); }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

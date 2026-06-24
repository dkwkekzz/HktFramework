// step_0076/verify.js — SW5 격자 은퇴 역이주(particlesToFluid: SPH 입자 → 격자 유체). 순수·독립·영구.
//   새 거동 = 0051 fluidToParticles(격자→SPH)·0055 migrateRegionToSPH 의 *역*. SPH 입자를 점유 셀에 되쌓아
//   격자로 녹인다(질량·운동량·내부E 누적·한 셀에 여럿이면 상대 KE→열로 총E 보존) → 격자→SPH→격자 왕복=항등.
//   "은퇴"가 일방 아닌 *가역*. 보존·결정론은 tools/htj-verify-lib.js 공용 가드. 실행: node HTJ/steps/step_0076/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];

function emptyWorld(N) { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
// 운동량·내부E 있는 격자 블롭(결정론 패턴) — 자기중력 안 거치고 직접 셋(법칙만 검증).
function makeGrid(N) {
  const w = emptyWorld(N), c = (N - 1) / 2, sig = N * 0.18;
  const rho = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z, u = w.fields.therm;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2, i = (z * N + y) * N + x;
    const r = 2.0 * Math.exp(-d2 / (2 * sig * sig)); if (r < 1e-6) continue;
    rho[i] = r; gx[i] = r * 0.3 * (x - c); gy[i] = r * -0.2 * (y - c); gz[i] = r * 0.1; u[i] = r * 0.4;   // 운동량(회전풍)+내부E
  }
  return w;
}
const fsum = (w, nm) => { const a = w.fields[nm]; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const totalE = (w) => { const rho = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z, u = w.fields.therm; let e = 0; for (let i = 0; i < rho.length; i++) { const m = rho[i]; const ke = m > 1e-12 ? 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / m : 0; e += ke + u[i]; } return e; };
function maxFieldDiff(wa, wb) { let d = 0; for (const f of FIELDS) { const a = wa.fields[f], b = wb.fields[f]; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); } return d; }

// ① 격자→SPH→격자 왕복 항등 (새 거동의 알맹이) — 빈 격자에 되쌓으면 원래 장과 셀별 일치(한 셀당 입자 하나라 정확).
(() => {
  const N = 12, w0 = makeGrid(N);
  const parts = SPH.fluidToParticles(w0);                  // 격자 → SPH(0051)
  const w1 = emptyWorld(N);
  const r = SPH.particlesToFluid(parts, w1);               // SPH → 격자(역이주·이 step)
  const diff = maxFieldDiff(w0, w1);
  ok(parts.length > 0 && r.cells === parts.length && diff < 1e-9,
    `격자→SPH→격자 왕복 항등 — 입자 ${parts.length}개 되쌓음(셀 ${r.cells}) · 모든 장 셀별 최대차 ${diff.toExponential(2)}(원래 격자 복원)`);
})();

// ② migrate-out → 되돌림(이동 왕복) — 0055 로 격자를 비우고 다시 되쌓으면 원래 격자 정확 복원.
(() => {
  const N = 12, w = makeGrid(N), ref = makeGrid(N);        // w 는 변형됨·ref 는 원본 비교용
  const mig = SPH.migrateRegionToSPH(w, {});               // 격자 → SPH 이동(격자 비움·0055)
  const emptied = fsum(w, 'energy');
  SPH.particlesToFluid(mig.particles, w);                  // SPH → 격자 되돌림
  ok(emptied < 1e-9 && mig.particles.length > 0 && maxFieldDiff(w, ref) < 1e-9,
    `이동 왕복 — 비운 격자 질량 ${emptied.toExponential(2)}→되쌓음 · 입자 ${mig.particles.length} · 원래 격자 최대차 ${maxFieldDiff(w, ref).toExponential(2)}`);
})();

// ③ 누적 + 상대 KE→열(총E 보존) — 한 셀에 반대 운동량 두 입자 → 질량·운동량 합·잃은 상대 KE 가 열로(0031 demote).
(() => {
  const N = 8, w = emptyWorld(N);
  const P = [{ cx: 4, cy: 4, cz: 4, mass: 1, px: 2, py: 0, pz: 0, internalE: 0 }, { cx: 4, cy: 4, cz: 4, mass: 1, px: -2, py: 0, pz: 0, internalE: 0 }];
  const Ebefore = 0.5 * (2 * 2) / 1 + 0.5 * (2 * 2) / 1;   // KE1+KE2 = 2+2 = 4
  SPH.particlesToFluid(P, w);
  const i = (4 * N + 4) * N + 4;
  const m = w.fields.energy[i], mom = w.fields.mom_x[i], heat = w.fields.therm[i];
  ok(Math.abs(m - 2) < 1e-12 && Math.abs(mom) < 1e-12 && Math.abs(heat - 4) < 1e-9 && Math.abs(totalE(w) - Ebefore) < 1e-9,
    `누적+상대KE→열 — 셀 질량 ${m}·운동량 ${mom.toFixed(3)}(상쇄)·상대 KE 4→열 ${heat.toFixed(3)} · 총E ${Ebefore}→${totalE(w).toFixed(3)} 보존`);
})();

// ④ 경계 클램프 보존 — 격자 밖 입자도 경계 셀로 클램프(질량 손실 0)·되쌓은 셀 전부 범위 안.
(() => {
  const N = 8, w = emptyWorld(N);
  const P = [{ cx: -5, cy: 3, cz: 3, mass: 1.5, px: 0, py: 0, pz: 0, internalE: 0 }, { cx: N + 9, cy: 3, cz: 3, mass: 2.5, px: 0, py: 0, pz: 0, internalE: 0 }];
  const r = SPH.particlesToFluid(P, w);
  ok(Math.abs(fsum(w, 'energy') - 4) < 1e-12 && Math.abs(r.mass - 4) < 1e-12 && w.fields.energy[(3 * N + 3) * N + 0] > 0 && w.fields.energy[(3 * N + 3) * N + (N - 1)] > 0,
    `경계 클램프 보존 — 격자 밖 입자 질량 Σ ${fsum(w, 'energy')}(손실 0·되쌓은 셀 ${r.cells} 전부 범위 안)`);
})();

// ⑤ 결정론 (공용 가드) — 같은 입자 → 같은 격자.
show(L.deterministic('같은 입자 → 같은 격자', () => {
  const N = 10, w = makeGrid(N), parts = SPH.fluidToParticles(w), w2 = emptyWorld(N);
  SPH.particlesToFluid(parts, w2);
  return FIELDS.map(f => Array.from(w2.fields[f]).map(v => v.toFixed(6)));
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

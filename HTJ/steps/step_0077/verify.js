// step_0077/verify.js — SW5 자동 양방향 이주(autoMigrate: 밀도 기준 격자↔SPH 적응 선택). 순수·독립·영구.
//   새 거동 = 0055(격자→SPH)+0076(SPH→격자)을 정책으로 묶어 표현을 자동 선택 = SW4 적응 LOD(0039)의 격자↔SPH 판:
//   밀집/붕괴 영역은 SPH·확산 영역은 격자·이력(ρ_on>ρ_off)으로 깜빡임 방지. 전역(격자+입자) 보존.
//   보존·결정론은 tools/htj-verify-lib.js 공용 가드. 실행: node HTJ/steps/step_0077/verify.js
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

// 전역(격자+입자) 보존량.
const gridMass = (w) => { const a = w.fields.energy; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const partMass = (P) => P.reduce((s, p) => s + (p.mass || 0), 0);
function totalE(w, P) {
  const rho = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z, u = w.fields.therm; let e = 0;
  for (let i = 0; i < rho.length; i++) { const m = rho[i]; e += (m > 1e-12 ? 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / m : 0) + u[i]; }
  for (const p of P) e += (p.energy != null ? p.energy : (p.KEcm || 0) + (p.internalE || 0));
  return e;
}
function momX(w, P) { const g = w.fields.mom_x; let s = 0; for (let i = 0; i < g.length; i++) s += g[i]; for (const p of P) s += (p.px || 0); return s; }
function wp(cx, cy, cz, m, px) { return { cx, cy, cz, mass: m, px: px || 0, py: 0, pz: 0, KEcm: 0.5 * (px || 0) * (px || 0) / m, internalE: 0, energy: 0.5 * (px || 0) * (px || 0) / m, density: 0, radius: 0.62 }; }

// ① 적응 선택 (새 거동) — 밀집 격자 코어 → SPH·확산 입자 → 격자(비용이 디테일을 따라간다).
(() => {
  const N = 10, w = emptyWorld(N), rho = w.fields.energy, u = w.fields.therm;
  // 밀집 코어(중앙 3³·ρ=5≥rhoOn) — SPH 로 가야 함.
  for (let z = 4; z <= 6; z++) for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) { const i = (z * N + y) * N + x; rho[i] = 5; u[i] = 1; }
  // 확산 SPH 입자(서로 다른 셀·셀당 질량 0.3 ≤ rhoOff) — 격자로 가야 함.
  const P = [wp(0, 0, 0, 0.3), wp(2, 1, 0, 0.3), wp(8, 8, 9, 0.3), wp(1, 7, 2, 0.3)];
  const r = SPH.autoMigrate(w, P, { rhoOn: 4, rhoOff: 0.5 });
  const coreEmpty = rho[(5 * N + 5) * N + 5] === 0;            // 코어 셀 비워짐(→SPH)
  const diffuseGone = r.particles.every(p => p.mass > 0.5);    // 확산 입자는 격자로 빠지고 코어 입자만 남음
  ok(r.toSPH === 27 && r.toGrid === 4 && coreEmpty && diffuseGone,
    `적응 선택 — 밀집 코어 27셀→SPH(코어 격자 비움 ${coreEmpty}) · 확산 입자 ${r.toGrid}개→격자(남은 입자 전부 밀집 ${diffuseGone})`);
})();

// ② 이력(hysteresis) 무깜빡임 — 중간 밀도(rhoOff<셀질량<rhoOn) SPH 클러스터는 반복 호출해도 격자로 안 빠진다(안정).
(() => {
  const N = 10, w = emptyWorld(N);
  // 한 셀에 모인 중간 밀도 클러스터: 셀 질량 2 (rhoOff=0.5 < 2 < rhoOn=4).
  let P = [wp(5, 5, 5, 1), wp(5, 5, 5, 1)];
  let flips = 0, n0 = P.length;
  for (let t = 0; t < 5; t++) { const r = SPH.autoMigrate(w, P, { rhoOn: 4, rhoOff: 0.5 }); P = r.particles; flips += r.toGrid + r.toSPH; }
  ok(P.length === n0 && flips === 0 && gridMass(w) === 0,
    `이력 무깜빡임 — 중간 밀도(2) 클러스터 5회 반복: 입자 ${n0}→${P.length}·이주 0(toGrid+toSPH ${flips})·격자 빈 채(깜빡임 없음)`);
})();

// ③ 전역 보존 — 적응 이주 전후 (격자+입자) 총 질량·운동량·총E 정확 보존.
(() => {
  const N = 10, w = emptyWorld(N), rho = w.fields.energy, gx = w.fields.mom_x, u = w.fields.therm;
  for (let z = 4; z <= 6; z++) for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) { const i = (z * N + y) * N + x; rho[i] = 5; gx[i] = 2; u[i] = 1; }
  let P = [wp(0, 0, 0, 0.3, 1), wp(2, 1, 0, 0.3, -1), wp(8, 8, 9, 0.3, 0.5)];
  const m0 = gridMass(w) + partMass(P), p0 = momX(w, P), e0 = totalE(w, P);
  const r = SPH.autoMigrate(w, P, { rhoOn: 4, rhoOff: 0.5 }); P = r.particles;
  show(L.conserved('전역 질량(격자+입자)', m0, gridMass(w) + partMass(P)));
  ok(Math.abs(momX(w, P) - p0) < 1e-9 && Math.abs(totalE(w, P) - e0) < 1e-9,
    `전역 운동량·총E 보존 — px ${p0.toFixed(3)}→${momX(w, P).toFixed(3)} · E ${e0.toFixed(3)}→${totalE(w, P).toFixed(3)}`);
})();

// ④ 항등(노브 없음→회귀 0) — rhoOn/rhoOff 둘 다 없으면 격자·입자 불변.
(() => {
  const N = 8, w = emptyWorld(N), rho = w.fields.energy; rho[(4 * N + 4) * N + 4] = 9;
  const P = [wp(1, 1, 1, 0.3), wp(2, 2, 2, 7)];
  const before = JSON.stringify([Array.from(rho), P.map(p => [p.cx, p.mass])]);
  const r = SPH.autoMigrate(w, P, {});
  const after = JSON.stringify([Array.from(rho), r.particles.map(p => [p.cx, p.mass])]);
  show(L.identity('노브 없음 → 격자·입자 불변', before, after));
})();

// ⑤ 결정론 (공용 가드) — 같은 입력 → 같은 적응 이주 결과.
show(L.deterministic('같은 입력 → 같은 적응 이주', () => {
  const N = 10, w = emptyWorld(N), rho = w.fields.energy, u = w.fields.therm;
  for (let z = 4; z <= 6; z++) for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) { const i = (z * N + y) * N + x; rho[i] = 5; u[i] = 1; }
  const P = [wp(0, 0, 0, 0.3), wp(8, 8, 9, 0.3)];
  const r = SPH.autoMigrate(w, P, { rhoOn: 4, rhoOff: 0.5 });
  return [Array.from(rho).map(v => v.toFixed(4)), r.particles.map(p => [p.cx, p.cy, p.cz, p.mass.toFixed(4)]), r.toSPH, r.toGrid];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

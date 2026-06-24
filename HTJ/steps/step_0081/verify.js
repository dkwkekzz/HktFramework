// step_0081/verify.js — 구배(전단) 기준 적응 이주: autoMigrate 가 |∇v|≥shearOn 인 셀도 SPH 로. 순수·독립·영구.
//   새 거동 = 디테일을 밀도뿐 아니라 *속도 전단*으로도 판정 — 같은 밀도라도 전단 큰 영역은 SPH(Lagrangian)·균일 흐름은 격자.
//   shearOn 안 줌 → 밀도 기준만(0077 동일). 전역 보존(이주=이동). 보존·결정론·항등은 htj-verify-lib 공용 가드.
//   실행: node HTJ/steps/step_0081/verify.js
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
const gridM = (w) => { const a = w.fields.energy; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const partM = (P) => P.reduce((s, p) => s + (p.mass || 0), 0);
const gridP = (w, f) => { const a = w.fields[f]; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const partP = (P, k) => P.reduce((s, p) => s + (p[k] || 0), 0);

// ① 새 거동 — 전단 기준 이주: 같은 밀도(ρ=1)라도 *속도 전단 큰* 영역은 SPH·*균일 속도* 내부는 격자에 남는다.
(() => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy, mx = w.fields.mom_x;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x; rho[i] = 1;                  // 균일 밀도(전부 rhoOn 미만)
    // 좌반(x<6): 전단 흐름 vx = x  (∂vx/∂x=1 → |∇v|≈1) · 우반(x≥6): 균일 vx=10 (전단 0)
    mx[i] = (x < 6) ? x * 1 : 10;
  }
  const r = SPH.autoMigrate(w, [], { shearOn: 0.5 });           // 밀도 기준 없음·전단만
  // 전단 내부 셀(x=2)은 SPH 로 빠지고(격자 비움)·균일 내부 셀(x=9·경계서 멀어 전단 0)은 격자 유지.
  const shearGone = rho[(5 * N + 5) * N + 2] === 0;            // 전단 영역 셀 비워짐(→SPH)
  const uniformStays = rho[(5 * N + 5) * N + 9] === 1;         // 균일 내부 셀 격자에 그대로
  ok(shearGone && uniformStays && r.toSPH > 0,
    `전단 기준 이주 — 전단 내부 셀(x=2)→SPH(비움 ${shearGone}) · 균일 내부 셀(x=9)→격자 유지 ${uniformStays} · toSPH ${r.toSPH}`);
})();

// ② 새 거동 — 밀도+전단 OR 결합: 밀집(ρ≥rhoOn) *또는* 전단(|∇v|≥shearOn) 둘 중 하나면 SPH.
(() => {
  const N = 10, w = emptyWorld(N), rho = w.fields.energy, mx = w.fields.mom_x;
  // 셀 A(2,5,5): 밀집(ρ=9·전단 0) · 셀 B 영역(7~8,5,5): 옅음(ρ=1)+전단(vx 급변)
  rho[(5 * N + 5) * N + 2] = 9;
  for (let x = 6; x <= 9; x++) { const i = (5 * N + 5) * N + x; rho[i] = 1; mx[i] = (x - 6) * 4; }   // ∂vx/∂x≈4
  const r = SPH.autoMigrate(w, [], { rhoOn: 5, shearOn: 1.0 });
  const xs = r.particles.map(p => p.cx).sort((a, b) => a - b);
  const hasDense = r.particles.some(p => p.cx === 2), hasShear = r.particles.some(p => p.cx >= 6);
  ok(hasDense && hasShear && r.toSPH >= 2,
    `밀도+전단 OR — 밀집 셀(x=2)과 전단 영역(x≥6) 둘 다 SPH(${r.toSPH}개·x=${JSON.stringify(xs)})`);
})();

// ③ 전역 보존 — 전단 이주 전후 (격자+입자) 총 질량·운동량 정확 보존(이주=이동).
(() => {
  const N = 12, w = emptyWorld(N), rho = w.fields.energy, mx = w.fields.mom_x;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (z * N + y) * N + x; rho[i] = 1; mx[i] = x < 6 ? x * 0.7 : 5; }
  const m0 = gridM(w) + partM([]), p0 = gridP(w, 'mom_x');
  const r = SPH.autoMigrate(w, [], { shearOn: 0.3 }); const P = r.particles;
  show(L.conserved('전역 질량(격자+입자)', m0, gridM(w) + partM(P)));
  ok(Math.abs((gridP(w, 'mom_x') + partP(P, 'px')) - p0) < 1e-9,
    `전역 운동량 보존 — px ${p0.toFixed(3)} → ${(gridP(w, 'mom_x') + partP(P, 'px')).toFixed(3)}`);
})();

// ④ 항등(shearOn 안 줌 → 0077 밀도 기준만·회귀 0) — 전단 큰 셀도 ρ<rhoOn 이면 격자 유지.
(() => {
  const N = 10, w = emptyWorld(N), rho = w.fields.energy, mx = w.fields.mom_x;
  for (let x = 2; x <= 7; x++) { const i = (5 * N + 5) * N + x; rho[i] = 1; mx[i] = x * 5; }   // 큰 전단·옅은 밀도
  const r = SPH.autoMigrate(w, [], { rhoOn: 5 });               // shearOn 없음 → 밀도만
  show(L.identity('shearOn 없음 → 밀도 기준만(전단 무시·격자 유지)', r.toSPH, 0));
})();

// ⑤ 결정론 — 같은 입력 → 같은 전단 이주.
show(L.deterministic('같은 입력 → 같은 전단 적응 이주', () => {
  const N = 10, w = emptyWorld(N), rho = w.fields.energy, mx = w.fields.mom_x, my = w.fields.mom_y;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (z * N + y) * N + x; rho[i] = 1; mx[i] = Math.sin(x) * 3; my[i] = Math.cos(y) * 2; }
  const r = SPH.autoMigrate(w, [], { shearOn: 0.8 });
  return [r.toSPH, r.particles.map(p => [p.cx, p.cy, p.cz, p.mass.toFixed(4)])];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

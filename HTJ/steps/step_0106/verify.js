// step_0106/verify.js — 이주 이력(hysteresis): autoMigrate 의 minDwell 이 임계 근처 격자↔SPH *깜빡임*을 막는다.
//   새 거동 = 저밀도+고전단 셀은 격자→SPH(전단 큼)→즉시 SPH→격자(밀도 작음)를 매 call 깜빡인다(전단/와도/발산 축은
//   복귀 임계가 없어서). minDwell 이 갓 이주한 입자를 minDwell call 동안 격자 복귀에서 면제 → 깜빡임 횟수 급감.
//   minDwell=0 → 0089 동일(회귀 0). 보존·결정론은 공용 가드. 실행: node HTJ/steps/step_0106/verify.js
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
// 전단 흐름장 — vx=shear·(y−c) (|∇v|=shear·일정)·균일 옅은 밀도 ρ=1 (rhoOff 로 즉시 복귀하게).
function fillShear(w, N, shear) {
  const rho = w.fields.energy, mx = w.fields.mom_x, c = (N - 1) / 2;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x; rho[i] = 1; mx[i] = shear * (y - c);
  }
}

// 깜빡임 카운트 — T call 동안 SPH→격자 복귀(toGrid) 이벤트 총합. 저밀도+고전단이라 복귀 임계(rhoOff) 없는 dwell 0 은 매 call 깜빡.
function flickerRuns(N, T, minDwell) {
  const w = emptyWorld(N); fillShear(w, N, 2.0);
  let particles = [], totGrid = 0, totSPH = 0;
  for (let t = 0; t < T; t++) {
    const r = SPH.autoMigrate(w, particles, { shearOn: 1.0, rhoOff: 1.0, minDwell });   // 전단 기준 이주 + 밀도 복귀 + 이력
    particles = r.particles; totGrid += r.toGrid; totSPH += r.toSPH;
  }
  return { totGrid, totSPH, held: particles.length };
}

// ① 새 거동(깜빡임 방지) — 같은 장(저밀도 고전단)에서 minDwell>0 의 격자 복귀 횟수 ≪ minDwell=0.
(() => {
  const N = 8, T = 12;
  const off = flickerRuns(N, T, 0);                            // 이력 없음 → 매 call 깜빡(toGrid 큼)
  const on = flickerRuns(N, T, 6);                             // 이력 6 → 복귀 면제 → 깜빡임 급감
  ok(on.totGrid < off.totGrid * 0.5 && off.totGrid > 0,
    `깜빡임 방지 — 격자 복귀 이벤트 ${T}call: 이력없음 ${off.totGrid} → 이력6 ${on.totGrid}(${(100 * on.totGrid / off.totGrid).toFixed(0)}%·≪50%)`);
})();

// ②  이력 중 SPH 유지 — minDwell>0 이면 갓 이주 입자가 격자로 안 돌아가고 SPH 로 머문다(held > 이력없음).
(() => {
  const N = 8, T = 8;
  const off = flickerRuns(N, T, 0), on = flickerRuns(N, T, 10);
  ok(on.held > off.held, `이력 중 SPH 유지 — T call 후 SPH 보유 입자: 이력없음 ${off.held} < 이력10 ${on.held}(dwell 동안 복귀 면제)`);
})();

// ③ 항등(minDwell=0 → 0089 동일·회귀 0) — 같은 장에서 minDwell 미지정/0 결과가 byte 동일.
(() => {
  const run = (md) => {
    const N = 8, w = emptyWorld(N); fillShear(w, N, 2.0);
    const r = SPH.autoMigrate(w, [], md == null ? { shearOn: 1.0, rhoOff: 1.0 } : { shearOn: 1.0, rhoOff: 1.0, minDwell: md });
    return [r.toSPH, r.toGrid, r.particles.map(p => [p.cx, p.cy, p.cz, p.mass])];
  };
  show(L.identity('minDwell=0 → 0089 동일', run(null), run(0)));
})();

// ④ 전역 보존 — 이력 켠 이주 왕복에도 (격자+입자) 총 질량 보존(이주=이동·이력은 *시점만* 늦춤).
(() => {
  const N = 8, w = emptyWorld(N); fillShear(w, N, 2.0);
  const gridM = (ww) => { const a = ww.fields.energy; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
  const m0 = gridM(w);
  let P = [];
  for (let t = 0; t < 10; t++) { const r = SPH.autoMigrate(w, P, { shearOn: 1.0, rhoOff: 1.0, minDwell: 4 }); P = r.particles; }
  const pm = P.reduce((s, p) => s + (p.mass || 0), 0);
  show(L.conserved('전역 질량(격자+입자)', m0, gridM(w) + pm));
})();

// ⑤ 결정론.
show(L.deterministic('같은 장 → 같은 이력 이주', () => { const r = flickerRuns(8, 10, 5); return [r.totGrid, r.totSPH, r.held]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

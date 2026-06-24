// step_0082/verify.js — 와도(vorticity) 기준 적응 이주: autoMigrate 가 |∇×v|≥vortOn 인 회전 영역도 SPH 로. 순수·독립·영구.
//   새 거동 = 회전(소용돌이)을 *압축/팽창(발산)과 구분*해 짚는다 — 순수 발산은 |∇v| 크지만 |ω|=0(전단 기준이 못 가르는 축).
//   vortOn 안 줌 → 0077 동일. 전역 보존(이주=이동). 보존·결정론·항등은 htj-verify-lib 공용 가드.
//   실행: node HTJ/steps/step_0082/verify.js
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
// 평면 흐름장 채우기: vfun(x,y,c) → [vx,vy] (균일 밀도 ρ=1).
function fillFlow(w, N, vfun) {
  const rho = w.fields.energy, mx = w.fields.mom_x, my = w.fields.mom_y, c = (N - 1) / 2;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x; rho[i] = 1; const v = vfun(x, y, c); mx[i] = v[0]; my[i] = v[1];
  }
}

// ① 새 거동 — 회전 흐름은 SPH 로 이주(|ω|>0). 솔리드-바디 회전 vx=−(y−c)·vy=(x−c) → ω_z=2(어디서나).
(() => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [-(y - c), (x - c)]);
  const r = SPH.autoMigrate(w, [], { vortOn: 1.0 });            // 와도 기준만(밀도·전단 없음)
  ok(r.toSPH > 0 && gridM(w) < 1e-6,
    `회전→SPH — 솔리드-바디 회전(|ω|=2≥vortOn) 전부 SPH(toSPH ${r.toSPH}·격자 비움 ${gridM(w).toExponential(1)})`);
})();

// ② 새 거동(핵심 구분) — 순수 발산(방사 팽창)은 |∇v| 크지만 |ω|=0 → vortOn 으론 *안* 이주(전단 기준과 다른 축).
(() => {
  const N = 10, c = (N - 1) / 2, div = (x, y) => [(x - c), (y - c)];   // 방사 팽창: div=2·curl=0
  const w1 = emptyWorld(N); fillFlow(w1, N, div);
  const rV = SPH.autoMigrate(w1, [], { vortOn: 0.5 });           // 와도 기준 → 회전 0 이라 0 이주
  const w2 = emptyWorld(N); fillFlow(w2, N, div);
  const rS = SPH.autoMigrate(w2, [], { shearOn: 0.5 });          // 같은 장·전단 기준 → |∇v|=√2>0.5 이라 이주(대조)
  ok(rV.toSPH === 0 && rS.toSPH > 0,
    `발산은 와도 0 — 방사 팽창(div=2·curl=0): vortOn→이주 ${rV.toSPH}(0) · 대조 shearOn→이주 ${rS.toSPH}(>0). 회전≠발산 분리`);
})();

// ③ 전역 보존 — 와도 이주 전후 (격자+입자) 총 질량·운동량 정확 보존(이주=이동).
(() => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [-(y - c) * 0.8, (x - c) * 0.8]);
  const m0 = gridM(w) + partM([]), p0 = gridP(w, 'mom_x') + gridP(w, 'mom_y');
  const r = SPH.autoMigrate(w, [], { vortOn: 0.5 }); const P = r.particles;
  show(L.conserved('전역 질량(격자+입자)', m0, gridM(w) + partM(P)));
  ok(Math.abs((gridP(w, 'mom_x') + partP(P, 'px')) + (gridP(w, 'mom_y') + partP(P, 'py')) - p0) < 1e-9,
    `전역 운동량 보존 — Σ(px+py) ${p0.toFixed(3)} → ${((gridP(w, 'mom_x') + partP(P, 'px')) + (gridP(w, 'mom_y') + partP(P, 'py'))).toFixed(3)}`);
})();

// ④ 항등(vortOn 안 줌 → 0077 동일·회귀 0) — 회전 큰 셀도 ρ<rhoOn 이면 격자 유지.
(() => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [-(y - c) * 3, (x - c) * 3]);        // 큰 회전·옅은 밀도(ρ=1)
  const r = SPH.autoMigrate(w, [], { rhoOn: 5 });               // vortOn 없음 → 밀도만
  show(L.identity('vortOn 없음 → 밀도 기준만(회전 무시·격자 유지)', r.toSPH, 0));
})();

// ⑤ 결정론 — 같은 입력 → 같은 와도 이주.
show(L.deterministic('같은 입력 → 같은 와도 적응 이주', () => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [-(y - c) + Math.sin(x), (x - c) + Math.cos(y)]);
  const r = SPH.autoMigrate(w, [], { vortOn: 1.2 });
  return [r.toSPH, r.particles.map(p => [p.cx, p.cy, p.cz, p.mass.toFixed(4)])];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

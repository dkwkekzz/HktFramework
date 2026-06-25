// step_0089/verify.js — 발산(압축·충격면) 기준 적응 이주: autoMigrate 가 max(0,−∇·v)≥divOn 인 *수렴* 영역도 SPH 로.
//   새 거동 = 압축/충격면(수렴 흐름)을 *회전(와도)과 구분*해 짚는다 — 순수 회전은 ∇·v=0(divOn 못 잡음)·순수 수렴은
//   max(0,−∇·v)>0(divOn 잡음). 0082 와도 축의 *거울짝*(회전≠압축 분리)이자 다축(밀도·전단·회전·압축) 완성.
//   divOn 안 줌 → 0077/0081/0082 동일(회귀 0). 전역 보존(이주=이동). 보존·결정론·항등은 htj-verify-lib 공용 가드.
//   실행: node HTJ/steps/step_0089/verify.js
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

// ① 새 거동 — 수렴(압축·충격면) 흐름은 SPH 로 이주(max(0,−∇·v)>0). 방사 수렴 vx=−(x−c)·vy=−(y−c) → ∇·v=−2(어디서나)→압축 2.
(() => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [-(x - c), -(y - c)]);
  const r = SPH.autoMigrate(w, [], { divOn: 1.0 });            // 발산(압축) 기준만(밀도·전단·회전 없음)
  ok(r.toSPH > 0 && gridM(w) < 1e-6,
    `압축→SPH — 방사 수렴(max(0,−∇·v)=2≥divOn) 전부 SPH(toSPH ${r.toSPH}·격자 비움 ${gridM(w).toExponential(1)})`);
})();

// ② 새 거동(핵심 구분) — 순수 회전(소용돌이)은 ∇·v=0 → divOn 으론 *안* 이주. 대조로 vortOn 은 이주(회전≠압축).
(() => {
  const N = 10, c = (N - 1) / 2, rot = (x, y) => [-(y - c), (x - c)];   // 솔리드-바디 회전: curl=2·div=0
  const w1 = emptyWorld(N); fillFlow(w1, N, rot);
  const rD = SPH.autoMigrate(w1, [], { divOn: 0.5 });           // 발산 기준 → 압축 0 이라 0 이주
  const w2 = emptyWorld(N); fillFlow(w2, N, rot);
  const rV = SPH.autoMigrate(w2, [], { vortOn: 0.5 });          // 같은 장·와도 기준 → |ω|=2>0.5 이라 이주(대조)
  ok(rD.toSPH === 0 && rV.toSPH > 0,
    `회전은 압축 0 — 솔리드-바디 회전(curl=2·div=0): divOn→이주 ${rD.toSPH}(0) · 대조 vortOn→이주 ${rV.toSPH}(>0). 회전≠압축 분리`);
})();

// ②b 추가 구분 — 방사 *팽창*(div=+2>0)은 수렴이 아니다 → max(0,−∇·v)=0 → divOn *안* 이주(압축만 잡음).
(() => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [(x - c), (y - c)]);                 // 방사 팽창: ∇·v=+2 → 압축 0
  const r = SPH.autoMigrate(w, [], { divOn: 0.5 });
  ok(r.toSPH === 0, `팽창≠압축 — 방사 팽창(∇·v=+2>0): divOn→이주 ${r.toSPH}(0·max(0,−∇·v)=0·압축/충격면만 잡음)`);
})();

// ③ 전역 보존 — 압축 이주 전후 (격자+입자) 총 질량·운동량 정확 보존(이주=이동).
(() => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [-(x - c) * 0.8, -(y - c) * 0.8]);
  const m0 = gridM(w), p0 = gridP(w, 'mom_x') + gridP(w, 'mom_y');
  const r = SPH.autoMigrate(w, [], { divOn: 0.5 }); const P = r.particles;
  show(L.conserved('전역 질량(격자+입자)', m0, gridM(w) + partM(P)));
  ok(Math.abs((gridP(w, 'mom_x') + partP(P, 'px')) + (gridP(w, 'mom_y') + partP(P, 'py')) - p0) < 1e-9,
    `전역 운동량 보존 — Σ(px+py) ${p0.toFixed(3)} → ${((gridP(w, 'mom_x') + partP(P, 'px')) + (gridP(w, 'mom_y') + partP(P, 'py'))).toFixed(3)}`);
})();

// ④ 항등(divOn 안 줌 → 0077 동일·회귀 0) — 압축 큰 셀도 ρ<rhoOn 이면 격자 유지.
(() => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [-(x - c) * 3, -(y - c) * 3]);       // 큰 압축·옅은 밀도(ρ=1)
  const r = SPH.autoMigrate(w, [], { rhoOn: 5 });              // divOn 없음 → 밀도만
  show(L.identity('divOn 없음 → 밀도 기준만(압축 무시·격자 유지)', r.toSPH, 0));
})();

// ⑤ 결정론 — 같은 입력 → 같은 압축 이주.
show(L.deterministic('같은 입력 → 같은 압축 적응 이주', () => {
  const N = 10, w = emptyWorld(N), c = (N - 1) / 2;
  fillFlow(w, N, (x, y) => [-(x - c) + Math.sin(y), -(y - c) + Math.cos(x)]);
  const r = SPH.autoMigrate(w, [], { divOn: 1.2 });
  return [r.toSPH, r.particles.map(p => [p.cx, p.cy, p.cz, p.mass.toFixed(4)])];
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

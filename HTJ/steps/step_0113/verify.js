// step_0113/verify.js — (조립) 절차 지형 위를 걷기: 캐릭터가 fBm 높이장을 오르내린다.
//   새 물리 0(걷기 부품 0111·fBm 0074 는 부품 verify 가 보증). 여기선 *새 결합*만: 같은 걷기 법칙이
//   절차 지형 표면을 추종해 오르내린다(창발↔절차 잇기). 순수·독립·영구. 실행: node HTJ/steps/step_0113/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, G = 4, FX = 8;
const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
const elev = (x) => 9 + 6 * Stream.fbm(x * 0.03, 0.5, { salt: 'RIDGE', octaves: 3, gain: 0.5 });

function makeWorld() {
  const an = [];
  for (let x = -6; x <= 90; x += 0.5) an.push({ cx: x, cy: elev(x) - 3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
  const ch = { cx: 8, cy: elev(8) + 1.5, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
  return { an, ch, es: [ch, ...an] };
}
function tick(W, walk) {
  W.ch.py -= W.ch.mass * G * DT;
  En.applyEntityContact(W.es, DT, COPT);
  if (walk) Ctl.applyControl(W.es, DT, { commands: [{ i: 0, fx: FX }] });
  En.applyEntityFriction(W.es, DT, FOPT);
  En.applyEntityRollingResistance(W.es, DT, ROPT);
  for (const a of W.an) { a.px = 0; a.py = 0; a.pz = 0; a.Lx = 0; a.Ly = 0; a.Lz = 0; }
  En.stepEntity(W.ch, DT);
}
function walkRun(steps) {
  const W = makeWorld(); for (let t = 0; t < 60; t++) tick(W, false);
  const cx0 = W.ch.cx, sm = [];
  for (let t = 0; t < steps; t++) { tick(W, true); if (t % 10 === 0) sm.push({ cx: W.ch.cx, cy: W.ch.cy, e: elev(W.ch.cx) }); }
  return { W, cx0, sm };
}
const R = walkRun(700);

// ① 지형 추종 — 캐릭터 고도가 지형 높이를 따라간다: corr(cy, elev) ≈ 1·offset(cy−elev) 좁은 띠(표면 위를 탐).
(() => {
  const cy = R.sm.map(s => s.cy), e = R.sm.map(s => s.e), off = R.sm.map(s => s.cy - s.e);
  const mc = cy.reduce((a, b) => a + b) / cy.length, me = e.reduce((a, b) => a + b) / e.length;
  let cov = 0, vc = 0, ve = 0; for (let i = 0; i < cy.length; i++) { cov += (cy[i] - mc) * (e[i] - me); vc += (cy[i] - mc) ** 2; ve += (e[i] - me) ** 2; }
  const corr = cov / Math.sqrt(vc * ve), offMin = Math.min(...off), offMax = Math.max(...off);
  ok(corr > 0.95 && offMin > 0.6 && offMax < 1.5,
    `지형 추종 — corr(cy,elev) ${corr.toFixed(3)}>0.95·offset∈[${offMin.toFixed(2)},${offMax.toFixed(2)}]⊂(0.6,1.5)(표면 위를 탐)`);
})();

// ② 오르내림 — 캐릭터 고도가 지형 따라 유의미하게 변함(평지 아님).
(() => {
  const cy = R.sm.map(s => s.cy); const climb = Math.max(...cy) - Math.min(...cy);
  ok(climb > 1.5, `오르내림 — 캐릭터 고도 변화 ${climb.toFixed(2)}>1.5(언덕 오르내림·평지 아님)`);
})();

// ③ 접지 유지 — 걷는 내내 표면 근처(안 가라앉고 안 날아감)·터널링 0.
(() => {
  let okAll = true; for (const s of R.sm) { const off = s.cy - s.e; if (off < 0.6 || off > 1.5) okAll = false; }
  ok(okAll, `접지 유지 — 모든 샘플 cy 가 elev+[0.6,1.5] 안(터널링 0·안 날아감)`);
})();

// ④ traversal — 절차 언덕에 안 갇히고 한참 전진(횡단).
ok(R.W.ch.cx - R.cx0 > 25, `traversal — cx ${R.cx0.toFixed(1)}→${R.W.ch.cx.toFixed(1)}(Δ${(R.W.ch.cx - R.cx0).toFixed(1)}>25·언덕 횡단·안 갇힘)`);

// ⑤ 결정론.
show(L.deterministic('같은 입력 → 같은 보행', () => { const r = walkRun(300); return [Math.round(r.W.ch.cx * 1e6), Math.round(r.W.ch.cy * 1e6)]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

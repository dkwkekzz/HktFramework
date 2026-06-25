// step_0111/verify.js — (조립) 걷기: 제어 힘 + 접지 마찰 → 캐릭터가 지면을 걷는다.
//   새 물리 0(applyControl 0109·applyEntityContact 0037·applyEntityFriction 0057·applyEntityRollingResistance 0058
//   은 부품 verify 가 보증). 여기선 *새 결합*만: 제어+마찰 균형이 걷기(종단속도)와 멈춤·접지 유지를 낳는다.
//   순수·독립·영구. 실행: node HTJ/steps/step_0111/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, G = 4, F = 8;
const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };

function makeWorld() {
  const an = [];
  for (let x = -4; x <= 60; x++) an.push({ cx: x, cy: -3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
  const ch = { cx: 10, cy: 1.2, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
  return { an, ch, es: [ch, ...an] };
}
function tick(W, f) {
  W.ch.py -= W.ch.mass * G * DT;
  En.applyEntityContact(W.es, DT, COPT);
  if (f) Ctl.applyControl(W.es, DT, { commands: [{ i: 0, fx: f }] });
  En.applyEntityFriction(W.es, DT, FOPT);
  En.applyEntityRollingResistance(W.es, DT, ROPT);
  for (const a of W.an) { a.px = 0; a.py = 0; a.pz = 0; a.Lx = 0; a.Ly = 0; a.Lz = 0; }
  En.stepEntity(W.ch, DT);
}

// 공통 굴리기: 정착(70) → 우측 걷기(walkN) → 놓음(stopN). 측정값 수집.
function drive(walkN, stopN) {
  const W = makeWorld();
  for (let t = 0; t < 70; t++) tick(W, 0);                       // 정착
  const cy0 = W.ch.cy, cx0 = W.ch.cx; let cyMin = cy0, cyMax = cy0, vMid = 0, vEnd = 0;
  for (let t = 0; t < walkN; t++) { tick(W, F); cyMin = Math.min(cyMin, W.ch.cy); cyMax = Math.max(cyMax, W.ch.cy); if (t === Math.floor(walkN / 2)) vMid = W.ch.px / W.ch.mass; }
  vEnd = W.ch.px / W.ch.mass; const cxWalked = W.ch.cx;
  for (let t = 0; t < stopN; t++) tick(W, 0);                    // 놓음 → 멈춤
  return { cy0, cx0, cxWalked, cyMin, cyMax, vMid, vEnd, vStopped: W.ch.px / W.ch.mass, cxStopped: W.ch.cx, ch: W.ch };
}

const D = drive(160, 140);

// ① 걷기 — +x 제어로 캐릭터가 유의미하게 전진(locomotion).
ok(D.cxWalked - D.cx0 > 4, `걷기 — cx ${D.cx0.toFixed(2)}→${D.cxWalked.toFixed(2)}(Δ${(D.cxWalked - D.cx0).toFixed(2)}>4·전진)`);

// ② 종단속도 — 속도가 *유계*(자유 가속 F·t/m 의 수십분의 1)·후반 거의 일정(마찰이 가속을 잡는다).
(() => {
  const free = F * (160 * DT) / 1;                              // 마찰 없으면 v=F·t/m
  ok(D.vEnd < 1.5 && D.vEnd < free / 10 && Math.abs(D.vEnd - D.vMid) < 0.6,
    `종단속도 — v_end ${D.vEnd.toFixed(3)}<1.5·자유가속 ${free.toFixed(0)}의 1/${(free / D.vEnd).toFixed(0)}·중후반 Δv ${Math.abs(D.vEnd - D.vMid).toFixed(3)}<0.6(유계)`);
})();

// ③ 멈춤 — 제어를 놓으면 마찰이 운동을 열로 빼 |v|→0(얼음 아님)·위치 정지.
ok(Math.abs(D.vStopped) < 0.05 && Math.abs(D.cxStopped - D.cxWalked) < 1.0,
  `멈춤 — 놓으면 v ${D.vStopped.toFixed(4)}→0·cx 정지(Δ${Math.abs(D.cxStopped - D.cxWalked).toFixed(2)}<1.0·얼음 아님)`);

// ④ 접지 유지 — 걷는 내내 cy 가 표면 근처 유계(안 날아가고 안 가라앉음).
ok(D.cyMin > 0.5 && D.cyMax < 1.4, `접지 유지 — cy∈[${D.cyMin.toFixed(3)},${D.cyMax.toFixed(3)}]⊂(0.5,1.4)(안 날아가고 안 가라앉음)`);

// ⑤ 결정론 — 같은 입력 → 같은 걸음.
show(L.deterministic('같은 입력 → 같은 걸음', () => { const r = drive(120, 80); return [Math.round(r.cxStopped * 1e6), Math.round(r.cy0 * 1e6)]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

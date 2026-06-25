// step_0112/verify.js — (조립) 점프: 접지 게이트 + 상향 임펄스 → 캐릭터가 뛴다.
//   새 물리 0(applyControl 0109·groundContact·접촉/마찰 부품 verify 가 보증). 여기선 *새 결합*만:
//   접지일 때만 점프(게이트)·탄도 복귀·재무장. 순수·독립·영구. 실행: node HTJ/steps/step_0112/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, G = 4, JY = 7;
const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };

function makeWorld() {
  const an = [];
  for (let x = -4; x <= 60; x++) an.push({ cx: x, cy: -3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
  const ch = { cx: 10, cy: 1.2, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
  return { an, ch, es: [ch, ...an] };
}
function tick(W, jumpWanted) {
  W.ch.py -= W.ch.mass * G * DT;
  En.applyEntityContact(W.es, DT, COPT);
  const g = Ctl.groundContact(W.ch, W.an, 0.05);
  if (jumpWanted && g >= 0) Ctl.applyControl(W.es, DT, { commands: [{ i: 0, fy: JY, impulse: true }] });
  En.applyEntityFriction(W.es, DT, FOPT);
  En.applyEntityRollingResistance(W.es, DT, ROPT);
  for (const a of W.an) { a.px = 0; a.py = 0; a.pz = 0; a.Lx = 0; a.Ly = 0; a.Lz = 0; }
  En.stepEntity(W.ch, DT);
  return g >= 0;
}

// 정착 후 단발 점프(press at t=0 of window)·이후 입력 없음. 정점/착지/접지 궤적 측정.
function singleJump() {
  const W = makeWorld(); for (let t = 0; t < 70; t++) tick(W, false);
  const stand = W.ch.cy; let peak = stand, apexGrounded = true, landed = stand;
  tick(W, true);                                                 // 단발 점프(접지)
  for (let t = 0; t < 120; t++) { const gnd = tick(W, false); peak = Math.max(peak, W.ch.cy); if (W.ch.cy > peak - 0.05) apexGrounded = gnd; }
  landed = W.ch.cy; const landGrounded = Ctl.groundContact(W.ch, W.an, 0.05) >= 0;
  return { stand, peak, landed, apexGrounded, landGrounded };
}

const S = singleJump();

// ① 도약 — 접지 점프로 정점이 선 높이보다 훌쩍 솟는다.
ok(S.peak - S.stand > 4, `도약 — 정점 cy ${S.peak.toFixed(2)} − 선 높이 ${S.stand.toFixed(2)} = ${(S.peak - S.stand).toFixed(2)}>4(솟구침)`);

// ② 탄도 복귀 — 솟았다 중력에 끌려 제자리 근처로 착지하고 다시 접지(무한 비행 아님).
ok(Math.abs(S.landed - S.stand) < 0.3 && S.landGrounded && !S.apexGrounded,
  `탄도 복귀 — 착지 cy ${S.landed.toFixed(3)}≈선 ${S.stand.toFixed(3)}·착지 접지 ${S.landGrounded}·정점 공중 ${!S.apexGrounded}`);

// ③ 접지 게이트 — 공중에서 점프 연타해도 무시: 단발 점프와 *같은 정점*(한 비행 1회 도약).
(() => {
  const W = makeWorld(); for (let t = 0; t < 70; t++) tick(W, false);
  let peak = W.ch.cy, launches = 0, prevG = true;
  for (let t = 0; t < 70; t++) { const gnd = tick(W, true); peak = Math.max(peak, W.ch.cy); if (prevG && !gnd) launches++; prevG = gnd; }   // 매 step 점프 연타
  // 한 비행 동안 정점은 단발 점프와 같아야(공중 연타 무시) — peak 비교.
  ok(Math.abs(peak - S.peak) < 0.2 && launches >= 1,
    `접지 게이트 — 공중 연타해도 정점 ${peak.toFixed(2)}≈단발 ${S.peak.toFixed(2)}(공중 점프 무시)·도약은 접지 후에만(${launches}회·각각 착지 뒤)`);
})();

// ④ 재무장 — 착지해 다시 접지하면 또 점프 가능(게이트가 닫혔다 열림).
(() => {
  const W = makeWorld(); for (let t = 0; t < 70; t++) tick(W, false);
  tick(W, true); let p1 = W.ch.cy; for (let t = 0; t < 80; t++) { tick(W, false); p1 = Math.max(p1, W.ch.cy); }  // 1차 점프+착지
  const grndBefore2 = Ctl.groundContact(W.ch, W.an, 0.05) >= 0;
  tick(W, true); let p2 = W.ch.cy; for (let t = 0; t < 80; t++) { tick(W, false); p2 = Math.max(p2, W.ch.cy); } // 2차 점프
  ok(grndBefore2 && p2 - W.ch.cy > 0 && Math.abs(p2 - p1) < 0.5,
    `재무장 — 착지 후 접지 ${grndBefore2}→2차 점프 정점 ${p2.toFixed(2)}≈1차 ${p1.toFixed(2)}(게이트 재무장)`);
})();

// ⑤ 결정론.
show(L.deterministic('같은 점프 → 같은 궤적', () => { const r = singleJump(); return [Math.round(r.peak * 1e6), Math.round(r.landed * 1e6)]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

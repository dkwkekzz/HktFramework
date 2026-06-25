// step_0109/verify.js — (법칙) 제어 힘 applyControl: 행위성이 지정 개체에 명령 힘을 주입한다.
//   새 법칙의 알맹이만 직접 단언(① 연속 힘=뉴턴2 정확 ② 명령 없음=회귀 0 ③ 임펄스 1회=뉴턴1 등속 ④ 결정론).
//   운동량은 *주입*된다(외력·보존 안 됨이 핵심) — 그 양이 명령과 정확히 일치하는지 본다. 순수·독립·영구.
//   실행: node HTJ/steps/step_0109/verify.js
'use strict';
const path = require('path');
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const mk = (cx) => ({ cx, cy: 0, cz: 0, mass: 1, px: 0, py: 0, pz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });

const DT = 0.05, FX = 6, K = 40;

// ① 연속 힘 → Δp = F·dt 정확·등가속(뉴턴2). 매 call 운동량이 F·dt 씩 정확히 늘고, 위치는 ½at² 궤적.
(() => {
  const e = mk(0); let px_prev = 0, accelOk = true;
  for (let k = 1; k <= K; k++) {
    Ctl.applyControl([e], DT, { commands: [{ i: 0, fx: FX, fy: 0, fz: 0 }] });
    const dpx = e.px - px_prev; if (Math.abs(dpx - FX * DT) > 1e-12) accelOk = false;  // 매 step Δp=F·dt
    px_prev = e.px; En.stepEntity(e, DT);
  }
  const expectP = FX * DT * K;                                  // 누적 운동량 = F·dt·K
  const ec = L.conserved('누적 Δp = F·dt·K(뉴턴2 정확)', expectP, e.px, 1e-12);
  ok(ec.pass && accelOk && e.energy === 0.5 * e.px * e.px / e.mass + e.internalE,
    `연속 힘=뉴턴2 — px ${e.px.toFixed(4)}=F·dt·K ${expectP.toFixed(4)}·매 step Δp=F·dt(등가속)·energy 자기일관`);
})();

// ② 명령 없는 개체 불변 — 회귀 0. 두 개체 중 i=0 만 명령 → i=1 은 byte 동일(early-return 의미·세계 불변).
(() => {
  const e0 = mk(0), e1 = mk(5); const snap1 = JSON.stringify(e1);
  Ctl.applyControl([e0, e1], DT, { commands: [{ i: 0, fx: FX }] });
  show(L.identity('명령 없는 개체 불변(i=1)', JSON.parse(snap1), e1));
  // 빈 commands → 전체 불변(early-return).
  const a = mk(3), snapA = JSON.stringify(a); Ctl.applyControl([a], DT, { commands: [] });
  ok(JSON.stringify(a) === snapA, `빈 commands → early-return(전체 불변·회귀 0)`);
})();

// ③ 임펄스 1회 → Δp=F 정확, 이후 등속 직진(뉴턴1). 명령 끝나면 자유 드리프트(가속 0).
(() => {
  const e = mk(0); const IMP = 9;
  Ctl.applyControl([e], DT, { commands: [{ i: 0, fx: IMP, impulse: true }] });   // 1회 충격량
  const v0 = e.px / e.mass; const jumpOk = Math.abs(e.px - IMP) < 1e-12;          // Δp=F(×dt 아님)
  const xs = [];
  for (let k = 0; k < 5; k++) { En.stepEntity(e, DT); Ctl.applyControl([e], DT, { commands: [] }); xs.push(e.cx); }
  let drift = true; for (let k = 1; k < xs.length; k++) if (Math.abs((xs[k] - xs[k - 1]) - v0 * DT) > 1e-12) drift = false;
  ok(jumpOk && Math.abs(e.px - IMP) < 1e-12 && drift,
    `임펄스=뉴턴1 — Δp=F ${e.px.toFixed(3)}(×dt 아님)·이후 등속 Δx=v·dt(자유 드리프트)`);
})();

// ④ 결정론 — 같은 명령 → 같은 궤적.
show(L.deterministic('같은 명령 → 같은 궤적', () => {
  const e = mk(0), out = [];
  for (let k = 1; k <= 20; k++) { Ctl.applyControl([e], DT, { commands: [{ i: 0, fx: FX, fy: k * 0.1 }] }); En.stepEntity(e, DT); out.push(Math.round(e.cx * 1e6), Math.round(e.cy * 1e6)); }
  return out;
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

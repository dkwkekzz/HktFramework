// step_0114/verify.js — (조립) 경사 한계: 완경사는 오르고 급경사(절벽)는 막힌다(창발 walkability).
//   새 물리 0(걷기 부품 0111 은 부품 verify 가 보증). 여기선 *새 결합*만: 같은 제어 힘이 경사에 따라
//   오름/막힘으로 갈리고, 임계는 힘 균형서 창발(author 벽 아님). 순수·독립·영구. node HTJ/steps/step_0114/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, G = 4;
const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };

// 일정 경사 ramp(x0 부터 slope)·제어 힘 FX 로 steps 걷고 *오른 고도*(climb)를 잰다. 단일 함수(순수).
function climbOn(slope, FX, steps) {
  const x0 = 18, elev = (x) => 4 + slope * Math.max(0, x - x0);
  const an = [];
  for (let x = -6; x <= 140; x += 0.5) an.push({ cx: x, cy: elev(x) - 3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
  const ch = { cx: 8, cy: elev(8) + 1.0, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
  const es = [ch, ...an], zero = () => { for (const a of an) { a.px = a.py = a.pz = a.Lx = a.Ly = a.Lz = 0; } };
  for (let s = 0; s < 40; s++) { ch.py -= ch.mass * G * DT; En.applyEntityContact(es, DT, COPT); En.applyEntityFriction(es, DT, FOPT); En.applyEntityRollingResistance(es, DT, ROPT); zero(); En.stepEntity(ch, DT); }
  const cy0 = ch.cy;
  for (let s = 0; s < steps; s++) { ch.py -= ch.mass * G * DT; En.applyEntityContact(es, DT, COPT); Ctl.applyControl(es, DT, { commands: [{ i: 0, fx: FX }] }); En.applyEntityFriction(es, DT, FOPT); En.applyEntityRollingResistance(es, DT, ROPT); zero(); En.stepEntity(ch, DT); }
  return ch.cy - cy0;
}

const gentle = climbOn(0.45, 8, 900);   // 완경사 24° · 보통 힘
const cliff = climbOn(3.0, 8, 900);    // 급경사 72° · 보통 힘
const cliffStrong = climbOn(3.0, 30, 900); // 급경사 72° · 센 힘

// ① 완경사 오름 — 완만한 비탈은 같은 힘으로 유의미하게 오른다(고도 ↑).
ok(gentle > 4, `완경사 오름 — 24° 비탈 climb ${gentle.toFixed(2)}>4(꾸준히 오름)`);

// ② 급경사 막힘 — 가파른 절벽은 같은 힘으로 거의 못 오른다(절벽 밑서 정지).
ok(cliff < 1, `급경사 막힘 — 72° 절벽 climb ${cliff.toFixed(2)}<1(같은 힘으로 못 오름·절벽 밑 정지)`);

// ③ 창발 임계(힘 균형) — 같은 절벽도 제어 힘 키우면 오른다(한계가 author 아닌 힘 균형서 창발).
ok(cliffStrong > 4 && cliffStrong > cliff + 4,
  `창발 임계 — 같은 72° 절벽이 F8 막힘(${cliff.toFixed(2)}) → F30 오름(${cliffStrong.toFixed(2)})·한계가 힘 따라 움직임(author 벽 아님)`);

// ④ 결정론.
show(L.deterministic('같은 경사·힘 → 같은 결과', () => [Math.round(climbOn(0.45, 8, 300) * 1e6), Math.round(climbOn(3.0, 8, 300) * 1e6)]));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

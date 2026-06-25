// step_0111/verify.js — (조립·버그수정) 걷기: 무거운 자유 구체 지면 위를 편법 0 으로 걷는다.
//   ⚠ 버그수정: 옛 verify 는 앵커를 매 틱 운동량 0 으로 지워(부동성 위조)+균일 -mg 로 평지 걷기를 쟀다 —
//   "지면" 개념+고정 코드(원칙 위반). 바로잡음: 지면=무거운 자유 구체·캐릭터는 관성+중력(쌍힘)+접촉+마찰+제어로만.
//   부품 법칙(0027/0028/0037/0057/0058/0109)은 부품 verify 가 보증. 여기선 *그 조립이 편법 없이 성립*함을 단언.
//   순수·독립·영구. 실행: node HTJ/steps/step_0111/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, CX = 24, CY = 24, R = 12, M = 8000, F = 8;
const GOPT = { G: 0.03, soft: 1 }, COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
const g = GOPT.G * M / (R * R), VORB = Math.sqrt(g * R);          // 표면 중력·궤도속도(걷는속도와 비교)
const mk = (m, x, y, r) => ({ cx: x, cy: y, cz: 0, mass: m, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: r });

// 무거운 자유 구체 + 캐릭터. 편법 0: 앵커 없음·운동량 지우기 없음·-mg 없음.
function makeWorld() { const planet = mk(M, CX, CY, R), ch = mk(1, CX, CY + R + 1, 1); return { planet, ch, es: [planet, ch] }; }
function tang(W) { const dx = W.ch.cx - W.planet.cx, dy = W.ch.cy - W.planet.cy, d = Math.hypot(dx, dy); return [-dy / d, dx / d, d]; }
function tick(W, f) {
  En.applyEntityGravity(W.es, DT, GOPT);                         // 중력(쌍힘) — 외부 고정 아님
  En.applyEntityContact(W.es, DT, COPT);
  if (f) { const [tx, ty] = tang(W); W.ch.px += f * tx * DT; W.ch.py += f * ty * DT; }
  En.applyEntityFriction(W.es, DT, FOPT);
  En.applyEntityRollingResistance(W.es, DT, ROPT);
  En.stepEntities(W.es, DT);                                     // 관성(행성도 자유 — 안 지움)
}
function angleOf(W) { return Math.atan2(W.ch.cy - W.planet.cy, W.ch.cx - W.planet.cx); }

// 정착(60) → 걷기(walkN) → 놓음(stopN). d·속도·각도·행성 드리프트 수집.
function drive(walkN, stopN) {
  const W = makeWorld(); for (let t = 0; t < 60; t++) tick(W, 0);
  const a0 = angleOf(W), vSettle = Math.hypot(W.ch.px, W.ch.py) / W.ch.mass;
  let dMin = 99, dMax = 0, vMax = 0;
  for (let t = 0; t < walkN; t++) { tick(W, F); const [, , d] = tang(W); dMin = Math.min(dMin, d); dMax = Math.max(dMax, d); vMax = Math.max(vMax, Math.hypot(W.ch.px, W.ch.py) / W.ch.mass); }
  const sweep = Math.abs(angleOf(W) - a0) * 180 / Math.PI, vWalkEnd = Math.hypot(W.ch.px, W.ch.py) / W.ch.mass;
  for (let t = 0; t < stopN; t++) tick(W, 0);
  const planetDrift = Math.hypot(W.planet.cx - CX, W.planet.cy - CY), arc = R * Math.abs(angleOf(W) - a0);
  return { vSettle, dMin, dMax, vMax, sweep, vWalkEnd, vStopped: Math.hypot(W.ch.px, W.ch.py) / W.ch.mass, planetDrift, arc, W };
}
const D = drive(260, 200);

// ① 고정 없이 선다 — 정착 속도→0·표면(d≈R+r=13)·행성 드리프트 ≪ 캐릭터 호(무게로 버팀·고정 아님).
ok(D.vSettle < 1e-3 && Math.abs(D.dMin - (R + 1)) < 0.3 && D.planetDrift < 0.15 * D.arc,
  `고정 없이 선다 — 정착 속도 ${D.vSettle.toExponential(1)}≈0·d≈${R + 1}·행성 드리프트 ${D.planetDrift.toFixed(2)}≪캐릭터 호 ${D.arc.toFixed(1)}(무게로 버팀)`);

// ② 걷기 — 제어로 표면 따라 각도 휘어 돈다(arc).
ok(D.sweep > 30, `걷기 — 표면 따라 ${D.sweep.toFixed(0)}°(>30°) 휘어 돎(곡면 보행)`);

// ③ 안 날아감 — 걷는 내내 d≈R+r 유지·속도 ≪ 궤도속도(원심 탈출 0).
ok(D.dMax - D.dMin < 0.3 && D.dMax < R + 1.5 && D.vMax < 0.4 * VORB,
  `안 날아감 — d∈[${D.dMin.toFixed(2)},${D.dMax.toFixed(2)}]≈${R + 1}(표면 유지)·vmax ${D.vMax.toFixed(2)}≪궤도 ${VORB.toFixed(1)}(원심 탈출 0)`);

// ④ 멈춤 — 놓으면 마찰이 멈춘다(걷는 속도 → 거의 0).
ok(D.vStopped < 0.15, `멈춤 — 놓으면 속도 ${D.vWalkEnd.toFixed(2)}→${D.vStopped.toFixed(3)}(마찰이 멈춤)`);

// ⑤ 편법 부재(외부 고정 없음) — *제어 없이* 굴리면 계 총 운동량이 보존된다. 고정(pin)이 있으면 외력이라 안 보존.
//    → 지면이 *진짜 자유 물체*(쌍힘·관성)임의 증거. 시작 0 → 유지 0.
(() => {
  const W = makeWorld(); for (let t = 0; t < 300; t++) tick(W, 0);   // 제어 0 — 순수 물리만
  const Ptot = Math.hypot(W.planet.px + W.ch.px, W.planet.py + W.ch.py);
  show(L.conserved('편법 부재 — 제어 없이 계 총 운동량(고정이면 깨짐)', 0, Ptot, 1e-9));
})();

// ⑥ 결정론.
show(L.deterministic('같은 입력 → 같은 걸음', () => { const r = drive(150, 80); return [Math.round(r.W.ch.cx * 1e6), Math.round(r.W.ch.cy * 1e6)]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

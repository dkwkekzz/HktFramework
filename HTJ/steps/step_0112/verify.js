// step_0112/verify.js — (조립·버그수정) 점프: 무거운 자유 구체 표면서 방사 도약(편법 0).
//   ⚠ 버그수정: 옛 verify 는 평지+앵커 운동량 지우기+-mg 위 점프를 쟀다(지면 개념+고정 코드). 바로잡음:
//   지면=무거운 자유 구체·점프=접지일 때만 방사 임펄스·복귀=중력·안 탈출=임펄스<탈출속도. 부품 법칙은
//   부품 verify 가 보증. 순수·독립·영구. 실행: node HTJ/steps/step_0112/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, CX = 24, CY = 24, R = 12, M = 8000, JY = 2.5;
const GOPT = { G: 0.03, soft: 1 }, COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
const VESC = Math.sqrt(2 * GOPT.G * M / R);                       // 탈출속도(이보다 작게 차면 돌아옴)
const mk = (m, x, y, r) => ({ cx: x, cy: y, cz: 0, mass: m, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: r });

function makeWorld() { const planet = mk(M, CX, CY, R), ch = mk(1, CX, CY + R + 1, 1); return { planet, ch, es: [planet, ch] }; }
function rad(W) { const dx = W.ch.cx - W.planet.cx, dy = W.ch.cy - W.planet.cy, d = Math.hypot(dx, dy); return [dx / d, dy / d, d]; }
function tick(W, jumpWanted, jumpImpulse) {
  En.applyEntityGravity(W.es, DT, GOPT); En.applyEntityContact(W.es, DT, COPT);
  const [nx, ny] = rad(W), grounded = Ctl.groundContact(W.ch, [W.planet], 0.05) >= 0;
  if (jumpWanted && grounded) { const J = jumpImpulse != null ? jumpImpulse : JY; W.ch.px += J * nx; W.ch.py += J * ny; }   // 방사 바깥 임펄스
  En.applyEntityFriction(W.es, DT, FOPT); En.applyEntityRollingResistance(W.es, DT, ROPT);
  En.stepEntities(W.es, DT);
  return grounded;
}

// 단발 점프(정착 후) → 정점/착지 추적.
function singleJump(impulse) {
  const W = makeWorld(); for (let t = 0; t < 60; t++) tick(W, false);
  const stand = rad(W)[2]; let peak = stand, apexGrounded = true;
  tick(W, true, impulse);
  for (let t = 0; t < 200; t++) { const g = tick(W, false); const d = rad(W)[2]; peak = Math.max(peak, d); if (d > peak - 0.1) apexGrounded = g; }
  return { stand, peak, land: rad(W)[2], landGrounded: Ctl.groundContact(W.ch, [W.planet], 0.05) >= 0, apexGrounded };
}
const S = singleJump();

// ① 도약 — 접지 방사 점프로 고도(d)가 솟는다.
ok(S.peak - S.stand > 1.5, `도약 — 정점 d ${S.peak.toFixed(2)} − 선 높이 ${S.stand.toFixed(2)} = ${(S.peak - S.stand).toFixed(2)}>1.5(방사 솟구침)`);

// ② 탄도 복귀·안 탈출 — 솟았다 중력에 끌려 표면으로 착지·다시 접지(우주로 안 날아감).
ok(Math.abs(S.land - S.stand) < 0.3 && S.landGrounded && !S.apexGrounded && S.peak < R + 6,
  `탄도 복귀 — 착지 d ${S.land.toFixed(2)}≈선 ${S.stand.toFixed(2)}·재접지 ${S.landGrounded}·정점 공중 ${!S.apexGrounded}·peak ${S.peak.toFixed(1)}≪궤도이탈(안 탈출)`);

// ③ 접지 게이트 — 공중에서 점프 연타해도 무시(단발과 같은 정점·도약은 접지 후에만).
(() => {
  const W = makeWorld(); for (let t = 0; t < 60; t++) tick(W, false);
  let peak = rad(W)[2], launches = 0, prevG = true;
  for (let t = 0; t < 80; t++) { const g = tick(W, true); peak = Math.max(peak, rad(W)[2]); if (prevG && !g) launches++; prevG = g; }
  ok(Math.abs(peak - S.peak) < 0.3 && launches >= 1,
    `접지 게이트 — 공중 연타해도 정점 ${peak.toFixed(2)}≈단발 ${S.peak.toFixed(2)}(공중 점프 무시)·도약 ${launches}회(각각 착지 뒤)`);
})();

// ④ 탈출속도 미만 = 돌아옴 / 초과 = 떠남(안 날아감도 물리·고정 아님). 약하게(2.5)→복귀·세게(>esc)→안 돌아옴.
(() => {
  const back = singleJump(2.5);                                  // < 탈출속도 → 돌아옴
  const W = makeWorld(); for (let t = 0; t < 60; t++) tick(W, false);
  tick(W, true, VESC * 1.3); let maxd = rad(W)[2]; for (let t = 0; t < 200; t++) { tick(W, false); maxd = Math.max(maxd, rad(W)[2]); }  // > 탈출 → 떠남
  ok(back.landGrounded && Math.abs(back.land - back.stand) < 0.3 && maxd > R + 20,
    `탈출속도 — 약한 점프(2.5<esc ${VESC.toFixed(1)}) 복귀·재접지·센 점프(${(VESC * 1.3).toFixed(1)}>esc) 떠남(d ${maxd.toFixed(0)}≫·안 날아감=물리지 고정 아님)`);
})();

// ⑤ 편법 부재 — 제어 없이 계 총 운동량 보존(고정이면 깨짐 → 자유 물체 증거).
(() => {
  const W = makeWorld(); for (let t = 0; t < 300; t++) tick(W, false);
  show(L.conserved('편법 부재 — 제어 없이 계 총 운동량', 0, Math.hypot(W.planet.px + W.ch.px, W.planet.py + W.ch.py), 1e-9));
})();

// ⑥ 결정론.
show(L.deterministic('같은 점프 → 같은 궤적', () => { const r = singleJump(); return [Math.round(r.peak * 1e4), Math.round(r.land * 1e4)]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

// step_0115/verify.js — (조립) 끝없이 걷는 땅: 지형이 관찰자(캐릭터) 둘레로 스트리밍된다.
//   새 물리 0(streamChunks 0073·보행 0113 은 부품 verify 가 보증). 여기선 *새 결합*만: 관찰자=캐릭터로
//   지면을 창에서만 펼쳐 *작업집합 유계 + 무한 보행 + 연속 접지*. 순수·독립·영구. node HTJ/steps/step_0115/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, G = 4, FX = 8, W = 22, SP = 2;
const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
const elev = (x) => 9 + 5 * Stream.fbm(x * 0.03, 0.5, { salt: 'LAND', octaves: 3, gain: 0.5 });

function streamGround(ch) {
  const { chunks } = Stream.streamChunks({ cx: ch.cx, cy: 0 }, { spacing: SP, radius: W, shapeAt: (i, j) => j === 0 ? 1 : null });
  return chunks.map(c => ({ cx: c.gx * SP, cy: elev(c.gx * SP) - 3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 }));
}
function run(steps) {
  const ch = { cx: 8, cy: elev(8) + 1.0, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
  let maxC = 0, minC = 1e9, grounded = true, earlyC = 0, lateC = 0;
  for (let t = 0; t < steps; t++) {
    const an = streamGround(ch); const es = [ch, ...an];
    if (t === 50) earlyC = an.length; if (t === steps - 50) lateC = an.length;
    if (t > 30) { maxC = Math.max(maxC, an.length); minC = Math.min(minC, an.length); }
    ch.py -= ch.mass * G * DT; En.applyEntityContact(es, DT, COPT);
    if (t >= 30) Ctl.applyControl(es, DT, { commands: [{ i: 0, fx: FX }] });
    En.applyEntityFriction(es, DT, FOPT); En.applyEntityRollingResistance(es, DT, ROPT);
    En.stepEntity(ch, DT);
    const off = ch.cy - elev(ch.cx); if (t > 40 && (off < -0.5 || off > 2.5)) grounded = false;
  }
  return { ch, maxC, minC, earlyC, lateC, grounded, span: ch.cx - 8 };
}
const R = run(2400);

// ① 무한 보행 — 캐릭터가 어떤 고정 창(2W=44)보다 훨씬 멀리 걷는다(세계는 무한 절차 장).
ok(R.span > 100 && R.span > 2 * W, `무한 보행 — span ${R.span.toFixed(1)}>창 2W=${2 * W}(고정 창 넘어 끝없이)`);

// ② 작업집합 유계 — 활성 앵커 수가 거리와 무관하게 일정·총 횡단 컬럼 ≫ 활성 앵커(비용≠세계 크기).
(() => {
  const cols = R.span / SP;                                     // 횡단한 지형 컬럼 수(세계 크기 척도)
  ok(R.maxC < 30 && (R.maxC - R.minC) <= 2 && R.earlyC === R.lateC && cols > 2 * R.maxC,
    `작업집합 유계 — 활성 앵커 ${R.minC}~${R.maxC}(거리 무관·시작 ${R.earlyC}=한참 뒤 ${R.lateC})·횡단 컬럼 ${cols.toFixed(0)}≫활성 ${R.maxC}(비용≠세계 크기)`);
})();

// ③ 연속 지형 — 스트리밍 중 틈 없이 늘 접지(안 빠짐).
ok(R.grounded, `연속 지형 — 스트리밍 내내 접지(틈/낙하 0·관찰자 창이 늘 발밑 지면 보장)`);

// ④ 결정론.
show(L.deterministic('같은 입력 → 같은 무한 보행', () => { const r = run(600); return [Math.round(r.ch.cx * 1e6), Math.round(r.ch.cy * 1e6), r.maxC]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

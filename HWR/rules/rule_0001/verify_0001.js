// verify_0001 — 관성. 세계 로직(engine) + 규칙(rule_0001) 의 합성으로 굴려 단언한다.
//   node rules/rule_0001/verify_0001.js
import { stepWorld } from '../../engine.js';
import rule from './rule_0001.js';
import scenario from './scenario.js';

const rules = [rule];                                   // 뷰어와 동일: 탐색된 모든 규칙
const params = { ...rule.defaults };
const step = w => stepWorld(w, rules, params);          // 한 틱 = 엔진이 모든 규칙 적용 후 적분

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const approx = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const totalP = w => {
  let px = 0, py = 0;
  for (const e of w.elements) { const m = e.m > 0 ? e.m : 1; px += m * e.vx; py += m * e.vy; }
  return { px, py };
};

// 1. 결정론 — 같은 입력 2회 → 비트 동일
{
  const a = scenario.setup(); for (let i = 0; i < 50; i++) step(a);
  const b = scenario.setup(); for (let i = 0; i < 50; i++) step(b);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// 2. 관성(등속) + 운동량 보존 — 힘이 없으면 속도 불변, 총 운동량 불변
{
  const w = scenario.setup();
  const v0 = w.elements.map(e => ({ vx: e.vx, vy: e.vy }));
  const P0 = totalP(w);
  for (let i = 0; i < 100; i++) step(w);
  const vConst = w.elements.every((e, i) => approx(e.vx, v0[i].vx) && approx(e.vy, v0[i].vy));
  check('관성: 힘 없으면 속도 불변(등속)', vConst);
  const P1 = totalP(w);
  check('보존: 총 운동량 불변', approx(P0.px, P1.px) && approx(P0.py, P1.py),
    `Δp=(${(P1.px - P0.px).toExponential(1)}, ${(P1.py - P0.py).toExponential(1)})`);
}

// 3. 갈릴레이 — 같은 속도·다른 질량 → 같은 변위 (자유 운동은 질량 무관)
{
  const w = { width: 1e9, height: 1e9, tick: 0, elements: [
    { x: 0, y: 0, vx: 2, vy: 1, m: 1 }, { x: 0, y: 0, vx: 2, vy: 1, m: 1000 },
  ] };
  for (let i = 0; i < 100; i++) step(w);
  check('갈릴레이: 같은 v·다른 m → 같은 위치',
    approx(w.elements[0].x, w.elements[1].x) && approx(w.elements[0].y, w.elements[1].y),
    `x=${w.elements[0].x} vs ${w.elements[1].x}`);
}

// 4. 시나리오 — 같은 vx·다른 m 은 정렬 유지(질량 무관), 다른 vx 는 등속으로 갈라짐
{
  const w = scenario.setup();
  for (let i = 0; i < 5; i++) step(w);
  const aligned = [0, 1, 2, 3, 4, 5].map(i => w.elements[i].x);   // 같은 vx=1.0, 다른 m
  const spread = [6, 7, 8, 9, 10].map(i => w.elements[i].x);      // 다른 vx (0.4..2.0)
  check('시나리오: 같은 vx·다른 m → x 정렬 유지(질량 무관)',
    aligned.every(x => approx(x, aligned[0])), `x=${aligned[0]}`);
  check('시나리오: 다른 vx → 등속으로 갈라짐(오름차순)',
    spread.every((x, i) => i === 0 || x > spread[i - 1]), `x=[${spread.map(x => x.toFixed(1)).join(', ')}]`);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

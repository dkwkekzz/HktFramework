// verify_0001 — 관성(질량 = 관성의 척도). 세계 로직(engine)+규칙(rule_0001) 합성으로 굴려 단언한다.
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
const world = (els, imps = []) => ({ width: 1e9, height: 1e9, tick: 0, elements: els, impulses: imps });

// 1. 결정론 — 같은 입력 2회 → 비트 동일
{
  const a = scenario.setup(); for (let i = 0; i < 50; i++) step(a);
  const b = scenario.setup(); for (let i = 0; i < 50; i++) step(b);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// 2. 관성(등속) + 운동량 보존 — 외부 힘 없으면 속도 불변, 총 운동량 불변
{
  const w = scenario.setup(); w.impulses = [];
  const v0 = w.elements.map(e => ({ vx: e.vx, vy: e.vy }));
  const P0 = totalP(w);
  for (let i = 0; i < 100; i++) step(w);
  const vConst = w.elements.every((e, i) => approx(e.vx, v0[i].vx) && approx(e.vy, v0[i].vy));
  check('관성: 외부 힘 없으면 속도 불변(등속)', vConst);
  const P1 = totalP(w);
  check('보존: 총 운동량 불변', approx(P0.px, P1.px) && approx(P0.py, P1.py),
    `Δp=(${(P1.px - P0.px).toExponential(1)}, ${(P1.py - P0.py).toExponential(1)})`);
}

// 3. 갈릴레이 — 같은 속도·다른 질량 → 같은 변위 (외부 힘 없으면 질량 무관)
{
  const w = world([
    { x: 0, y: 0, vx: 2, vy: 1, m: 1 }, { x: 0, y: 0, vx: 2, vy: 1, m: 1000 },
  ]);
  for (let i = 0; i < 100; i++) step(w);
  check('갈릴레이: 같은 v·다른 m → 같은 위치',
    approx(w.elements[0].x, w.elements[1].x) && approx(w.elements[0].y, w.elements[1].y),
    `x=${w.elements[0].x} vs ${w.elements[1].x}`);
}

// 4. 질량 = 저항의 크기 — 같은 힘 J → Δv = J/m (무거울수록 덜 변함), m·Δv 동일
{
  const J = 12;
  const w = world(
    [{ x: 0, y: 0, vx: 0, vy: 0, m: 2 }, { x: 0, y: 0, vx: 0, vy: 0, m: 6 }],
    [{ tick: 0, idx: 0, jx: J, jy: 0 }, { tick: 0, idx: 1, jx: J, jy: 0 }],
  );
  step(w); // tick 0 외부 힘 적용 + 적분
  const dv0 = w.elements[0].vx, dv1 = w.elements[1].vx;
  check('질량 저항: 같은 힘 → Δv = J/m (무거울수록 덜 변함)',
    approx(dv0, J / 2) && approx(dv1, J / 6) && dv0 > dv1, `Δv=(${dv0}, ${dv1})`);
  check('질량 저항: m·Δv 동일(운동량 변화는 질량 무관)', approx(2 * dv0, 6 * dv1), `${2 * dv0} == ${6 * dv1}`);
}

// 5. 외부 힘 장부 닫힘 — ΔΣp = ΣJ
{
  const w = scenario.setup();
  const P0 = totalP(w);
  const J = { jx: 5, jy: -3 };
  w.impulses = [{ tick: 0, idx: 0, ...J }, { tick: 0, idx: 3, ...J }];
  step(w);
  const P1 = totalP(w);
  check('장부: ΔΣp = ΣJ', approx(P1.px - P0.px, 2 * J.jx) && approx(P1.py - P0.py, 2 * J.jy),
    `ΔΣp=(${(P1.px - P0.px).toFixed(3)}, ${(P1.py - P0.py).toFixed(3)})`);
}

// 6. 시나리오 — tick 5 동일 힘 후 가벼운 원소가 더 빠르다 (vx = J/m)
{
  const w = scenario.setup();
  for (let i = 0; i < 10; i++) step(w);
  const vs = [0, 1, 2, 3].map(i => w.elements[i].vx); // m=1,2,4,8 → 6,3,1.5,0.75
  check('시나리오: 같은 힘 → 가벼울수록 빠름(vx 내림차순)',
    vs[0] > vs[1] && vs[1] > vs[2] && vs[2] > vs[3], `vx=[${vs.map(v => v.toFixed(2)).join(', ')}]`);
  check('시나리오: vx = J/m 정확',
    approx(vs[0], 6) && approx(vs[1], 3) && approx(vs[2], 1.5) && approx(vs[3], 0.75));
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

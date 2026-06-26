// verify_0001 — 관성과 질량. node 로 직접 돌려 통과 확인:
//   node rules/rule_0001/verify_0001.js
import rule from './rule_0001.js';
import scenario from './scenario.js';

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const approx = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const totalP = w => {
  let px = 0, py = 0;
  for (const e of w.elements) { px += e.m * e.vx; py += e.m * e.vy; }
  return { px, py };
};

// 1. 결정론 — 같은 입력 2회 → 비트 동일
{
  const p = { ...rule.defaults };
  const a = rule.setup({ ...p }); for (let i = 0; i < 50; i++) rule.step(a, p);
  const b = rule.setup({ ...p }); for (let i = 0; i < 50; i++) rule.step(b, p);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// 2. 관성 — 충격량 없으면 속도 불변, 총 운동량 불변
{
  const p = { ...rule.defaults };
  const w = rule.setup({ ...p }); w.impulses = [];
  const v0 = w.elements.map(e => ({ vx: e.vx, vy: e.vy }));
  const P0 = totalP(w);
  for (let i = 0; i < 100; i++) rule.step(w, p);
  const vConst = w.elements.every((e, i) => approx(e.vx, v0[i].vx) && approx(e.vy, v0[i].vy));
  check('관성: 힘 없으면 속도 불변(등속)', vConst);
  const P1 = totalP(w);
  check('보존: 총 운동량 불변', approx(P0.px, P1.px) && approx(P0.py, P1.py),
    `Δp=(${(P1.px - P0.px).toExponential(1)}, ${(P1.py - P0.py).toExponential(1)})`);
}

// 3. 갈릴레이 — 같은 속도·다른 질량 → 같은 변위
{
  const p = { dt: 1 };
  const w = { width: 1e9, height: 1e9, tick: 0, impulses: [], elements: [
    { x: 0, y: 0, vx: 2, vy: 1, m: 1 }, { x: 0, y: 0, vx: 2, vy: 1, m: 1000 },
  ] };
  for (let i = 0; i < 100; i++) rule.step(w, p);
  check('갈릴레이: 같은 v·다른 m → 같은 위치',
    approx(w.elements[0].x, w.elements[1].x) && approx(w.elements[0].y, w.elements[1].y),
    `x=${w.elements[0].x} vs ${w.elements[1].x}`);
}

// 4. 질량 = 관성의 척도 — 같은 J → Δv = J/m, m·Δv 동일
{
  const w = { width: 1e9, height: 1e9, tick: 0, impulses: [], elements: [
    { x: 0, y: 0, vx: 0, vy: 0, m: 2 }, { x: 0, y: 0, vx: 0, vy: 0, m: 6 },
  ] };
  const J = 12;
  rule.applyImpulse(w, 0, J, 0);
  rule.applyImpulse(w, 1, J, 0);
  const dv0 = w.elements[0].vx, dv1 = w.elements[1].vx;
  check('질량 척도: Δv = J/m', approx(dv0, J / 2) && approx(dv1, J / 6), `Δv=(${dv0}, ${dv1})`);
  check('질량 척도: m·Δv 동일(운동량 변화는 질량 무관)', approx(2 * dv0, 6 * dv1), `${2 * dv0} == ${6 * dv1}`);
}

// 5. 충격량 장부 닫힘 — ΔΣp = ΣJ
{
  const w = rule.setup({ ...rule.defaults }); w.impulses = [];
  const P0 = totalP(w);
  const J = { jx: 5, jy: -3 };
  rule.applyImpulse(w, 0, J.jx, J.jy);
  rule.applyImpulse(w, 3, J.jx, J.jy);
  const P1 = totalP(w);
  check('장부: ΔΣp = ΣJ', approx(P1.px - P0.px, 2 * J.jx) && approx(P1.py - P0.py, 2 * J.jy),
    `ΔΣp=(${(P1.px - P0.px).toFixed(3)}, ${(P1.py - P0.py).toFixed(3)})`);
}

// 6. 시나리오 — tick 5 동일 충격량 후 가벼운 원소가 더 빠르다 (vx = J/m)
{
  const p = { dt: 1 };
  const w = scenario.setup();
  for (let i = 0; i < 10; i++) rule.step(w, p);
  const vs = [0, 1, 2, 3].map(i => w.elements[i].vx); // m=1,2,4,8 → 6,3,1.5,0.75
  check('시나리오: 같은 J → 가벼울수록 빠름(vx 내림차순)',
    vs[0] > vs[1] && vs[1] > vs[2] && vs[2] > vs[3], `vx=[${vs.map(v => v.toFixed(2)).join(', ')}]`);
  check('시나리오: vx = J/m 정확',
    approx(vs[0], 6) && approx(vs[1], 3) && approx(vs[2], 1.5) && approx(vs[3], 0.75));
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

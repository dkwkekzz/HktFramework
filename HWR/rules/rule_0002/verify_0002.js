// verify_0002 — 결합. 세계 로직(engine)+규칙(rule_0001,0002) 합성으로 굴려 단언한다.
//   node rules/rule_0002/verify_0002.js
import { stepWorld } from '../../engine.js';
import rule1 from '../rule_0001/rule_0001.js';
import rule2 from './rule_0002.js';
import scenario from './scenario.js';

const rules = [rule1, rule2];                           // 뷰어와 동일: 탐색된 모든 규칙
const params = Object.assign({ dt: 1 }, rule1.defaults, rule2.defaults);
const step = w => stepWorld(w, rules, params);

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const approx = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const totalM = w => w.elements.reduce((s, e) => s + (e.m > 0 ? e.m : 1), 0);
const totalP = w => {
  let px = 0, py = 0;
  for (const e of w.elements) { const m = e.m > 0 ? e.m : 1; px += m * e.vx; py += m * e.vy; }
  return { px, py };
};
const totalKE = w => {
  let ke = 0;
  for (const e of w.elements) { const m = e.m > 0 ? e.m : 1; ke += 0.5 * m * (e.vx * e.vx + e.vy * e.vy + (e.vz || 0) ** 2); }
  return ke;
};
const world = (els) => ({ width: 1e9, height: 1e9, tick: 0, elements: els });

// 1. 결정론 — 같은 입력 2회 → 비트 동일
{
  const a = scenario.setup(); for (let i = 0; i < 60; i++) step(a);
  const b = scenario.setup(); for (let i = 0; i < 60; i++) step(b);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// 2. 개수 감소 — 시나리오: 충돌쌍 3 → 3, 대조쌍 2 → 2, 삼중 3 → 1. 11 → 6.
{
  const w = scenario.setup();
  const n0 = w.elements.length;
  for (let i = 0; i < 60; i++) step(w);
  check('개수 감소: 결합으로 원소 배열이 줄어든다', w.elements.length < n0 && w.elements.length === 6,
    `${n0} → ${w.elements.length} (기대 6)`);
}

// 3·4. 질량·운동량 보존 — 시나리오 전체를 굴려도 Σm·Σmv 불변(결합은 내부 사건)
{
  const w = scenario.setup();
  const M0 = totalM(w), P0 = totalP(w);
  for (let i = 0; i < 60; i++) step(w);
  check('질량 보존: Σm 불변', approx(totalM(w), M0), `Σm=${M0} → ${totalM(w)}`);
  check('운동량 보존: Σmv 불변(ΔΣp=0)',
    approx(totalP(w).px, P0.px, 1e-9) && approx(totalP(w).py, P0.py, 1e-9),
    `Δp=(${(totalP(w).px - P0.px).toExponential(1)}, ${(totalP(w).py - P0.py).toExponential(1)})`);
}

// 5·6·7. 위치=COM · 속도=V_com · KE 감소=이론 비탄성값(KE+bondEnergy 보존)
//   tick 0 에 이미 접촉·접근한 A(m2)·B(m6) → 한 스텝에 병합. 적분(힘 없음)으로 속도 불변.
{
  const w = world([
    { x: 100, y: 100, z: 0, vx: 1, vy: 0, m: 2, r: 3, hue: 200 },
    { x: 104, y: 100, z: 0, vx: -1, vy: 0, m: 6, r: 5, hue: 20 },
  ]);
  const keBefore = totalKE(w);                          // 0.5*2 + 0.5*6 = 4
  step(w);                                              // 접촉·접근 → 병합
  check('병합: 두 원소 → 하나', w.elements.length === 1, `n=${w.elements.length}`);
  const c = w.elements[0];
  // 적분 후 위치: A.x=101, B.x=103 → COM_x=(2*101+6*103)/8=102.5 ; V_com=(2*1+6*-1)/8=-0.5
  check('위치 = 질량중심(COM)', approx(c.x, 102.5) && approx(c.y, 100), `x=${c.x}, y=${c.y}`);
  check('속도 = 질량중심 속도(V_com)', approx(c.vx, -0.5) && approx(c.vy, 0), `vx=${c.vx}`);
  const keAfter = totalKE(w);                           // 0.5*8*0.25 = 1
  const dKEtheory = -0.5 * (2 * 6 / 8) * (2 ** 2);      // -½(m1m2/M)|Δv|² = -3
  check('KE 감소 = 이론 비탄성값', approx(keAfter - keBefore, dKEtheory), `ΔKE=${(keAfter - keBefore).toFixed(3)} (이론 ${dKEtheory})`);
  check('에너지 장부: KE + bondEnergy 보존', approx(keAfter + (w.bondEnergy || 0), keBefore),
    `KE=${keAfter} + bond=${w.bondEnergy} = ${keAfter + (w.bondEnergy || 0)} (=${keBefore})`);
}

// 8. 전이적 병합 — A–B–C 한 틱 동시 접촉 → 한 덩어리(셋이 하나로)
{
  const w = world([
    { x: 100, y: 0, z: 0, vx: 1, vy: 0, m: 2, r: 3, hue: 0 },
    { x: 104, y: 0, z: 0, vx: 0, vy: 0, m: 2, r: 3, hue: 0 },
    { x: 108, y: 0, z: 0, vx: -1, vy: 0, m: 2, r: 3, hue: 0 },
  ]);
  step(w);
  check('전이적 병합: A–B–C → 하나', w.elements.length === 1 && approx(w.elements[0].m, 6),
    `n=${w.elements.length}, m=${w.elements[0] && w.elements[0].m}`);
}

// 9. 비접촉 불변 — 멀리 떨어진 쌍·서로 멀어지는 쌍은 병합 안 됨
{
  const far = world([
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, m: 2, r: 3 },
    { x: 100, y: 0, z: 0, vx: 0, vy: 0, m: 2, r: 3 },
  ]);
  for (let i = 0; i < 5; i++) step(far);
  check('비접촉: 멀리 떨어지면 병합 안 됨', far.elements.length === 2, `n=${far.elements.length}`);

  const sep = world([                                   // 접촉했지만 서로 멀어지는 중 → 결합 안 함
    { x: 100, y: 0, z: 0, vx: -1, vy: 0, m: 2, r: 3 },
    { x: 104, y: 0, z: 0, vx: 1, vy: 0, m: 2, r: 3 },
  ]);
  step(sep);
  check('비접촉: 접촉해도 멀어지는 중이면 병합 안 됨', sep.elements.length === 2, `n=${sep.elements.length}`);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

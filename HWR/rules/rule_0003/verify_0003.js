// verify_0003 — 전기력. 엔진+규칙(rule_0001,0002,0003) 합성으로 굴려 단언한다(뷰어와 동일).
//   node rules/rule_0003/verify_0003.js
import { stepWorld } from '../../engine.js';
import rule1 from '../rule_0001/rule_0001.js';
import rule2 from '../rule_0002/rule_0002.js';
import rule3 from './rule_0003.js';
import scenario from './scenario.js';

const rules = [rule1, rule2, rule3];
const params = Object.assign({ dt: 1 }, rule1.defaults, rule2.defaults, rule3.defaults);
const step = w => stepWorld(w, rules, params);

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const approx = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const world = (els) => ({ width: 1e9, height: 1e9, tick: 0, elements: els });
const sep = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const totalP = w => { let px = 0, py = 0; for (const e of w.elements) { const m = e.m > 0 ? e.m : 1; px += m * e.vx; py += m * e.vy; } return { px, py }; };

// 1. 결정론 — 같은 입력 2회 → 비트 동일
{
  const a = scenario.setup(); for (let i = 0; i < 100; i++) step(a);
  const b = scenario.setup(); for (let i = 0; i < 100; i++) step(b);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// 2. 반대 이온은 묶인다 — 정지 상태로 평형 밖(거리 10)에서 놓으면 끌려와 진동하되, 흩어지지도 무너지지도 않음
//    (en 부여 → rule_0002 가 이온으로 인식: 이미 하전이라 재이동·공유 병합 안 함. 전기력만 작용)
{
  const w = world([
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, m: 2, en: 0.9, q: +1, r: 3 },
    { x: 10, y: 0, z: 0, vx: 0, vy: 0, m: 2, en: 3.2, q: -1, r: 3 },
  ]);
  let smin = Infinity, smax = 0;
  for (let i = 0; i < 800; i++) { step(w); const s = sep(w.elements[0], w.elements[1]); smin = Math.min(smin, s); smax = Math.max(smax, s); }
  const sFinal = sep(w.elements[0], w.elements[1]);
  check('반대 이온: 묶인다(흩어지지 않음 — 거리 상한 유지)', smax <= 10.5, `smax=${smax.toFixed(2)}`);
  check('반대 이온: 무너지지 않음(거리 하한 > 0)', smin > 1, `smin=${smin.toFixed(2)}`);
  check('반대 이온: 평형 거리(=6)에 안착', Math.abs(sFinal - 6) < 1, `최종 거리=${sFinal.toFixed(2)}`);
}

// 3. 같은 부호 이온은 밀려난다 — 거리 10에서 놓으면 멀어진다(쿨롱+코어 둘 다 반발)
{
  const w = world([
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, m: 2, en: 0.9, q: +1, r: 3 },
    { x: 10, y: 0, z: 0, vx: 0, vy: 0, m: 2, en: 3.2, q: +1, r: 3 },
  ]);
  for (let i = 0; i < 200; i++) step(w);
  check('같은 부호 이온: 밀려나 멀어진다', sep(w.elements[0], w.elements[1]) > 30, `sep=${sep(w.elements[0], w.elements[1]).toFixed(1)}`);
}

// 4. 중성은 전기적으로 안 보인다 — 떨어진 중성 둘은 힘 0(위치 불변)
{
  const w = world([
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, m: 2, q: 0, r: 3 },
    { x: 20, y: 0, z: 0, vx: 0, vy: 0, m: 2, q: 0, r: 3 },
  ]);
  for (let i = 0; i < 50; i++) step(w);
  check('중성: 전기력 0(위치 불변)', approx(w.elements[0].x, 0) && approx(w.elements[1].x, 20),
    `x=[${w.elements[0].x}, ${w.elements[1].x}]`);
}

// 5. 운동량 보존 — 전기+반발+마찰 모두 작용-반작용 → 총 운동량 불변(마찰은 에너지만 소산)
{
  const w = world([
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, m: 2, en: 0.9, q: +1, r: 3 },
    { x: 8, y: 0, z: 0, vx: 0, vy: 0, m: 3, en: 3.2, q: -1, r: 3 },
  ]);
  const P0 = totalP(w);
  for (let i = 0; i < 500; i++) step(w);
  const P1 = totalP(w);
  check('운동량 보존: ΔΣp≈0 (마찰 있어도 운동량 보존, 에너지만 소산)',
    Math.abs(P1.px - P0.px) < 1e-9 && Math.abs(P1.py - P0.py) < 1e-9,
    `Δp=(${(P1.px - P0.px).toExponential(1)}, ${(P1.py - P0.py).toExponential(1)})`);
}

// 6. 마찰 창발 — 같은 전자기력에서 *접선* 미끄럼도 감쇠한다(마찰). 평형 거리의 이온쌍에 접선 속도를 주면
//    상대운동(접선 포함)이 소산되어 정지 평형으로 안착 → 마찰이 별도 힘이 아니라 EM 에서 창발함을 보임.
{
  const w = world([
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, m: 2, en: 0.9, q: +1, r: 3 },
    { x: 6, y: 0, z: 0, vx: 0, vy: 3, m: 2, en: 3.2, q: -1, r: 3 }, // 접선(y) 속도 부여
  ]);
  const relSpeed = () => Math.hypot(w.elements[0].vx - w.elements[1].vx, w.elements[0].vy - w.elements[1].vy);
  const v0 = relSpeed();
  for (let i = 0; i < 1500; i++) step(w);
  const v1 = relSpeed();
  check('마찰 창발: 접선 미끄럼이 EM 으로 감쇠(상대운동 소멸)', v1 < v0 * 0.1, `상대속력 ${v0.toFixed(2)} → ${v1.toFixed(3)}`);
}

// 7. 통합(화학) — 시나리오: H₂는 공유 병합(중성 1개체), NaCl은 이온 결합 후 전기력에 묶인 이온쌍(2개체)
{
  const w = scenario.setup();
  const n0 = w.elements.length;             // 7
  for (let i = 0; i < 300; i++) step(w);
  // H₂ 병합 → 중성 m≈2 분자 1개 존재
  const h2 = w.elements.find(e => approx(e.m, 2) && (e.q || 0) === 0 && Array.isArray(e.parts) && e.parts.length === 2);
  check('통합: H₂ 공유 병합(중성 분자 1개체)', !!h2, h2 ? `m=${h2.m}, q=${h2.q}` : '없음');
  // NaCl: 음이온(−1)은 Cl⁻ 하나뿐(전자 이동 증거). 그 옆에 묶인 양이온(Na⁺)이 평형 거리에.
  const anion = w.elements.find(e => e.q === -1);
  const cations = w.elements.filter(e => e.q === 1);                 // Na⁺ + 반발쌍 둘(+1)
  const naBound = anion ? cations.reduce((best, c) => sep(c, anion) < sep(best, anion) ? c : best, cations[0]) : null;
  check('통합: NaCl 이온 결합(전자 이동 → Cl⁻ 생성)', !!anion && cations.length >= 1, `−:${!!anion}, +개수:${cations.length}`);
  check('통합: Na⁺Cl⁻ 가 전자기력에 묶임(평형 거리)', anion && naBound && sep(naBound, anion) < 12,
    anion && naBound ? `sep=${sep(naBound, anion).toFixed(2)}` : '—');
  // 반발쌍(+,+)은 서로 밀려 멀어짐(병합·결합 안 함). 전체 개수: H₂만 병합 → 7→6.
  check('통합: 개수 7 → 6 (H₂만 병합, 반발쌍은 안 붙음)', w.elements.length === 6, `${n0} → ${w.elements.length}`);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

// verify_0007 — 전자구름 배제 부피. 엔진+규칙(rule_0001 관성 + rule_0007 배제)으로 굴려 단언한다.
//   EM(rule_0003)·결합(rule_0002/0004)을 일부러 빼서 *배제 부피 단독* 거동만 본다(전하 무관 충돌의 증거).
//   node rules/rule_0007/verify_0007.js
import { stepWorld } from '../../engine.js';
import rule1 from '../rule_0001/rule_0001.js';
import rule7 from './rule_0007.js';

const rules = [rule1, rule7];
const params = Object.assign({ dt: 1 }, rule1.defaults, rule7.defaults);
const step = w => stepWorld(w, rules, params);

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const world = (els) => ({ width: 1e9, height: 1e9, tick: 0, elements: els });
const sep = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const totalP = w => { let px = 0, py = 0; for (const e of w.elements) { const m = e.m > 0 ? e.m : 1; px += m * e.vx; py += m * e.vy; } return { px, py }; };
const totalKE = w => { let ke = 0; for (const e of w.elements) { const m = e.m > 0 ? e.m : 1; ke += 0.5 * m * (e.vx * e.vx + e.vy * e.vy + (e.vz || 0) * (e.vz || 0)); } return ke; };
// 마주 오는 한 쌍을 굴려 최소 중심거리(가장 깊이 다가간 거리)와 최종 상태를 돌려준다.
//   좌표는 토러스 경계·원점에서 먼 양수 중앙(C)에 둔다 — raw 좌표 거리/순서 단언이 랩에 안 휘말리게.
const C = 1e6;
function headOn({ Z, m = 4, q = 0, sep0 = 30, v = 0.4, steps = 200 }) {
  const w = world([
    { x: C - sep0 / 2, y: 0, z: 0, vx: +v, vy: 0, vz: 0, m, Z, q, hue: 0 },
    { x: C + sep0 / 2, y: 0, z: 0, vx: -v, vy: 0, vz: 0, m, Z, q, hue: 0 },
  ]);
  let smin = Infinity;
  for (let i = 0; i < steps; i++) { step(w); smin = Math.min(smin, sep(w.elements[0], w.elements[1])); }
  return { w, smin };
}

// 1. 결정론 — 같은 입력 2회 → 비트 동일
{
  const a = headOn({ Z: 10 }).w;
  const b = headOn({ Z: 10 }).w;
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// 2. 정면 충돌 → 튕김(중성!) — 마주 오던 중성 원자가 통과하지 않고 *되튕긴다*. 전하 0 이라 EM 은 안 보임 →
//    순수히 배제 부피의 일. (관성만이면 그냥 지나쳐 위치가 뒤바뀔 텐데, 안 뒤바뀌고 반전한다.)
{
  const { w } = headOn({ Z: 10, q: 0, v: 0.6, steps: 200 });
  const e0 = w.elements[0], e1 = w.elements[1];
  check('정면 충돌: 중성 원자가 되튕긴다(속도 반전)', e0.vx < 0 && e1.vx > 0, `v=[${e0.vx.toFixed(3)}, ${e1.vx.toFixed(3)}]`);
  check('정면 충돌: 통과하지 않는다(좌우 안 뒤바뀜)', e0.x < e1.x, `x=[${e0.x.toFixed(1)}, ${e1.x.toFixed(1)}]`);
}

// 3. 운동량 보존 — 충돌은 작용-반작용 중심력 → 총 운동량 불변
{
  const { w } = headOn({ Z: 10, v: 0.6 });
  // headOn 은 대칭(±v, 같은 질량)이라 P0=0. 충돌 후에도 0 이어야 한다.
  const P = totalP(w);
  check('운동량 보존: ΔΣp≈0', Math.abs(P.px) < 1e-9 && Math.abs(P.py) < 1e-9, `Σp=(${P.px.toExponential(1)}, ${P.py.toExponential(1)})`);
}

// 4. 탄성(소산 없음) — 보존력이라 충돌 후 운동에너지가 *유지*된다(rule_0003 마찰과 대비). 정적이 아니라 튕김.
{
  const w0 = world([
    { x: 1e6 - 15, y: 0, z: 0, vx: +0.6, vy: 0, vz: 0, m: 4, Z: 10, hue: 0 },
    { x: 1e6 + 15, y: 0, z: 0, vx: -0.6, vy: 0, vz: 0, m: 4, Z: 10, hue: 0 },
  ]);
  const ke0 = totalKE(w0);
  for (let i = 0; i < 300; i++) step(w0);
  const ke1 = totalKE(w0);
  check('탄성: 충돌 후 운동에너지 유지(소산 없음 → 튕김 지속)', ke1 > ke0 * 0.9 && ke1 < ke0 * 1.1, `KE ${ke0.toFixed(3)} → ${ke1.toFixed(3)}`);
}

// 5. 단거리 — 구름이 안 겹칠 만큼 멀면(중심거리 ≫ σ) 힘 0 → 위치 불변(원거리 거동 무간섭).
{
  const w = world([
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 4, Z: 18, hue: 0 },
    { x: 60, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 4, Z: 18, hue: 0 },
  ]);
  for (let i = 0; i < 50; i++) step(w);
  check('단거리: 멀리 떨어진 둘은 힘 0(위치 불변)', w.elements[0].x === 0 && w.elements[1].x === 60, `x=[${w.elements[0].x}, ${w.elements[1].x}]`);
}

// 6. 전자 수로 크기 — Z 큰 원자(채워진 껍질 많음)는 큰 전자구름 → *더 먼 거리에서* 부딪친다(더 못 다가감).
{
  const small = headOn({ Z: 2, m: 4, v: 0.3, sep0: 40, steps: 300 }).smin;   // 한 껍질
  const big = headOn({ Z: 18, m: 4, v: 0.3, sep0: 40, steps: 300 }).smin;     // 세 껍질
  check('전자 수→크기: Z 큰 원자가 더 먼 거리에서 튕긴다(최소접근 거리↑)', big > small + 2, `최소접근 Z2=${small.toFixed(2)} < Z18=${big.toFixed(2)}`);
}

// 7. 이온 반경(전자 수=Z−전하) — 같은 Z 라도 음이온(전자 얻음)이 양이온(전자 잃음)보다 큰 구름 → 더 먼 거리에서 튕김.
{
  const cation = headOn({ Z: 18, q: +1, m: 4, v: 0.3, sep0: 40, steps: 300 }).smin;  // 전자 적음 → 작음
  const anion = headOn({ Z: 18, q: -1, m: 4, v: 0.3, sep0: 40, steps: 300 }).smin;   // 전자 많음 → 큼
  check('이온 반경: 음이온이 양이온보다 큰 구름(최소접근 거리↑)', anion > cation + 0.3, `최소접근 양이온=${cation.toFixed(2)} < 음이온=${anion.toFixed(2)}`);
}

// 8. 다체 가스 — 여러 원자가 서로 튕기며 섞인다(NaN 없음·결정론·운동량 보존). "서로 부딪치고"의 다체판.
{
  let s = 999983; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const els = [];
  for (let k = 0; k < 30; k++) {
    const th = rnd() * Math.PI * 2, sp = 0.5 + rnd() * 1.0;
    els.push({ x: rnd() * 200, y: rnd() * 200, z: 0, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp, vz: 0, m: 2, Z: 10, hue: 200 });
  }
  const w = { width: 300, height: 300, depth: 300, tick: 0, elements: els };
  const P0 = totalP(w);
  let nan = false;
  for (let i = 0; i < 500; i++) { step(w); for (const e of w.elements) if (!isFinite(e.x) || !isFinite(e.vx)) nan = true; }
  const P1 = totalP(w);
  check('다체 가스: 발산 없음(NaN 0) + 운동량 보존', !nan && Math.abs(P1.px - P0.px) < 1e-6 && Math.abs(P1.py - P0.py) < 1e-6,
    `nan=${nan}, Δp=(${(P1.px - P0.px).toExponential(1)}, ${(P1.py - P0.py).toExponential(1)})`);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

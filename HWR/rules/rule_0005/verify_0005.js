// verify_0005 — 분자의 창발 특성. 엔진+규칙으로 굴려(뷰어와 동일) 단언한다.
//   node rules/rule_0005/verify_0005.js
import { stepWorld } from '../../engine.js';
import rule1 from '../rule_0001/rule_0001.js';
import rule2 from '../rule_0002/rule_0002.js';
import rule3 from '../rule_0003/rule_0003.js';
import rule4, { shellState } from '../rule_0004/rule_0004.js';
import rule5, { moleculeProps } from './rule_0005.js';

const full = [rule1, rule2, rule3, rule4, rule5];     // 전체 스택(뷰어와 동일)
const only5 = [rule5];                                 // rule_0005 단독(다른 힘·결합 간섭 배제)
const params = Object.assign({ dt: 1 }, rule1.defaults, rule2.defaults, rule3.defaults, rule4.defaults, rule5.defaults);
const W = 1e6;
const B = 5000;                                        // 기준 좌표 — 토러스 경계(0)에서 멀리 두어 랩 방지
const world = els => ({ width: W, height: W, depth: W, tick: 0, elements: els, impulses: [] });
const stepWith = (w, rules) => stepWorld(w, rules, params);

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}

// 손수 만든 분자(합성체) — 엔진이 병합으로 만드는 것과 같은 모양: parts(원자)·m·freeValence·r.
//   부분 위치가 *기하* → 극성을 가른다. cx,cy 중심에 배치.
const atom = (dx, dy, Z, m) => ({ x: dx, y: dy, z: 0, vx: 0, vy: 0, vz: 0, Z, en: shellState(Z).en, m, r: 3 });
function molecule(cx, cy, parts, freeValence = 0, vx = 0, vy = 0) {
  let M = 0, r2 = 0;
  for (const p of parts) { p.x += cx; p.y += cy; M += p.m; r2 += (p.r || 0) * (p.r || 0); }
  return { x: cx, y: cy, z: 0, vx, vy, vz: 0, m: M, q: 0, parts, freeValence, r: Math.sqrt(r2) };
}
// 굽은 물(H₂O): O 중앙, H 둘이 같은 쪽(+y)으로 → 쌍극자 잔류(유극성)
const water = (cx, cy, vx = 0, vy = 0) => molecule(cx, cy, [atom(0, 0, 8, 16), atom(-9, 3, 1, 1), atom(9, 3, 1, 1)], 0, vx, vy);
// 일직선 이산화탄소(CO₂): C 중앙, O 둘이 정반대(±x) → 쌍극자 상쇄(무극성)
const co2 = (cx, cy, vx = 0, vy = 0) => molecule(cx, cy, [atom(0, 0, 6, 12), atom(-12, 0, 8, 16), atom(12, 0, 8, 16)], 0, vx, vy);

const propsOf = m => moleculeProps(m, world([m]));
// 토러스 최근접 거리(경계 랩 안전)
const dist = (a, b) => {
  let dx = a.x - b.x; dx -= Math.round(dx / W) * W;
  let dy = a.y - b.y; dy -= Math.round(dy / W) * W;
  let dz = (a.z || 0) - (b.z || 0); dz -= Math.round(dz / W) * W;
  return Math.hypot(dx, dy, dz);
};

// ── A. 극성(쌍극자)은 *기하*에서 창발 — 같은 원자 조성도 배치가 가른다 ─────────────
{
  const polW = propsOf(water(0, 0)).polarity;
  const polC = propsOf(co2(0, 0)).polarity;
  check('극성: 굽은 H₂O 는 유극성(쌍극자 > 0)', polW > 1e-6, `극성=${polW.toFixed(4)}`);
  check('극성: 일직선 CO₂ 는 무극성(쌍극자 ≈ 0, 대칭 상쇄)', polC < 1e-9, `극성=${polC.toExponential(2)}`);
  // 같은 물이라도 *일직선*으로 펴면 무극성이 된다 — 극성은 조성이 아니라 기하의 함수
  const flatWater = molecule(0, 0, [atom(0, 0, 8, 16), atom(-9, 0, 1, 1), atom(9, 0, 1, 1)], 0);
  check('극성: 같은 H₂O 조성도 일직선이면 무극성(극성=기하의 함수)', propsOf(flatWater).polarity < 1e-9, `극성=${propsOf(flatWater).polarity.toExponential(2)}`);
}

// ── B. 원자는 특성이 없다 — "분자가 되어야 비로소 특성을 가진다" ──────────────────
{
  const lone = { x: B, y: B, z: 0, vx: 0, vy: 0, vz: 0, Z: 8, en: shellState(8).en, m: 16, r: 3 };
  check('원자: 홀원자는 분자가 아니라 특성(극성) 없음(props=null)', moleculeProps(lone, world([lone])) === null);
  // 두 원자만 rule_0005 단독으로 굴려도 — 결합 없이 — 서로 분자 간 인력이 없다(정지 유지)
  const a = { x: B - 10, y: B, z: 0, vx: 0, vy: 0, vz: 0, m: 16, r: 3 };
  const b = { x: B + 10, y: B, z: 0, vx: 0, vy: 0, vz: 0, m: 16, r: 3 };
  const w = world([a, b]);
  for (let i = 0; i < 20; i++) stepWith(w, only5);
  check('원자: 분자 아닌 둘은 분자 간 인력 없음(정지 유지)', Math.abs(w.elements[0].x - (B - 10)) < 1e-9 && Math.abs(w.elements[1].x - (B + 10)) < 1e-9);
}

// ── C. 분자 간 인력: 유극성끼리만 끈다(무극성·혼합은 안 끈다) ───────────────────
{
  // 두 물 분자를 인력권(평형 σ·2^⅙≈23 < r < 차단 σ·rCutK≈62) 안에 정지로 두고 단독 굴림 → 가까워져야 한다
  const w = world([water(B - 16, B), water(B + 16, B)]);   // 중심 거리 32(평형 밖·차단 안 → 인력)
  const d0 = dist(w.elements[0], w.elements[1]);
  for (let i = 0; i < 12; i++) stepWith(w, only5);
  const d1 = dist(w.elements[0], w.elements[1]);
  check('인력: 유극성 분자 둘은 서로 끌려 가까워진다', d1 < d0 - 0.5, `거리 ${d0.toFixed(1)} → ${d1.toFixed(1)}`);

  // 두 CO₂(무극성)는 같은 배치라도 인력 0 → 거리 불변
  const wc = world([co2(B - 16, B), co2(B + 16, B)]);
  const e0 = dist(wc.elements[0], wc.elements[1]);
  for (let i = 0; i < 12; i++) stepWith(wc, only5);
  const e1 = dist(wc.elements[0], wc.elements[1]);
  check('인력: 무극성 분자(CO₂) 둘은 인력 없음(거리 불변)', Math.abs(e1 - e0) < 1e-9, `거리 ${e0.toFixed(1)} → ${e1.toFixed(1)}`);

  // 유극성–무극성 쌍도 인력 0(ε = 극성곱 = 0)
  const wm = world([water(B - 16, B), co2(B + 16, B)]);
  const f0 = dist(wm.elements[0], wm.elements[1]);
  for (let i = 0; i < 12; i++) stepWith(wm, only5);
  check('인력: 유극성–무극성 쌍은 인력 없음(거리 불변)', Math.abs(dist(wm.elements[0], wm.elements[1]) - f0) < 1e-9);
}

// ── D. 운동량 보존 — 분자 간 인력은 중심력(LJ 보존력) → Σmv 불변 ─────────────────
{
  const w = world([water(B - 16, B, 0.1, 0), water(B + 16, B, -0.05, 0.03)]);
  const P = ww => ww.elements.reduce((s, e) => [s[0] + e.m * e.vx, s[1] + e.m * e.vy, s[2] + e.m * (e.vz || 0)], [0, 0, 0]);
  const p0 = P(w);
  for (let i = 0; i < 30; i++) stepWith(w, only5);
  const p1 = P(w);
  check('보존: 분자 간 인력 하에 Σmv 보존', Math.abs(p0[0] - p1[0]) < 1e-9 && Math.abs(p0[1] - p1[1]) < 1e-9 && Math.abs(p0[2] - p1[2]) < 1e-9,
    `Δp=(${(p1[0] - p0[0]).toExponential(1)}, ${(p1[1] - p0[1]).toExponential(1)})`);
}

// ── E. 반발 코어 — 너무 가까우면 민다(분자가 서로 통과·붕괴하지 않음) ─────────────
{
  // 거의 겹친 두 물(반발 코어 안)을 정지로 두면 서로 밀어내야 한다(거리 증가)
  const w = world([water(B - 3, B), water(B + 3, B)]);
  const d0 = dist(w.elements[0], w.elements[1]);
  for (let i = 0; i < 5; i++) stepWith(w, only5);
  check('반발: 너무 가까운 분자는 반발 코어로 밀려난다', dist(w.elements[0], w.elements[1]) > d0, `거리 ${d0.toFixed(2)} → ${dist(w.elements[0], w.elements[1]).toFixed(2)}`);
}

// ── F. 색·안정성(측정) — 조성의 함수, 옥텟 만족 = 안정 ───────────────────────────
{
  const pw = propsOf(water(0, 0)), pc = propsOf(co2(0, 0));
  check('색: 분자는 조성의 함수로 색을 갖는다(0~360)', pw.hue >= 0 && pw.hue < 360 && pc.hue >= 0 && pc.hue < 360, `H₂O hue=${pw.hue.toFixed(0)}, CO₂ hue=${pc.hue.toFixed(0)}`);
  check('색: 조성이 다르면 색도 다르다(H₂O ≠ CO₂)', Math.abs(pw.hue - pc.hue) > 1e-6, `${pw.hue.toFixed(1)} vs ${pc.hue.toFixed(1)}`);
  // 안정성: 옥텟 채운(freeValence 0) 분자는 안정, 잔여 손 있는 라디칼은 반응성
  const radical = molecule(0, 0, [atom(0, 0, 8, 16), atom(-9, 3, 1, 1)], 1);   // OH(잔여 손 1)
  check('안정성: 옥텟 채운 분자는 안정(stable)', pw.stable === true && pw.reactivity === 0);
  check('안정성: 잔여 손 있는 라디칼은 반응성(stable=false)', propsOf(radical).stable === false && propsOf(radical).reactivity === 1);
}

// ── G. 상태(고체/액체/기체) 창발 — 극성 인력 vs 운동에너지 ─────────────────────────
//   상태는 "분자 간 인력 ε 가 운동에너지(온도)를 이기느냐"의 결과다.
//   차가운(저속) 극성 분자쌍은 인력에 *속박*돼 가까이 머문다(응집상=액체/고체). 뜨거운(고속) 쌍은
//   인력을 *탈출*해 멀어진다(기체). 박은 라벨이 아니라 거동으로 갈린다(다체 응결은 뷰어 시나리오에서).
{
  // 차가움: 정지 → 인력에 끌려 평형 근처에 *속박*(우물 안에서 진동, 차단권 안에 영구히 머묾). 인력권(32) 출발.
  const cold = world([water(B - 16, B), water(B + 16, B)]);
  for (let i = 0; i < 80; i++) stepWith(cold, full);
  const coldD = dist(cold.elements[0], cold.elements[1]);
  // 뜨거움: 같은 배치에 큰 상대속도(서로 멀어지는) → 운동에너지가 얕은 인력 우물을 *탈출*
  const hot = world([water(B - 16, B, -1.2, 0), water(B + 16, B, 1.2, 0)]);
  for (let i = 0; i < 80; i++) stepWith(hot, full);
  const hotD = dist(hot.elements[0], hot.elements[1]);
  check('상태: 차가운 극성 분자는 인력에 속박(응집상 — 차단권 σ·rCutK≈62 내 유지)', coldD < 45, `거리=${coldD.toFixed(1)}`);
  check('상태: 뜨거운 분자는 인력을 탈출(기체 — 멀어진다)', hotD > coldD * 2, `차가움 ${coldD.toFixed(1)} ≪ 뜨거움 ${hotD.toFixed(1)}`);
}

// ── H. 결정론 — 같은 입력 → 비트 동일 ────────────────────────────────────────────
{
  const mk = () => world([water(-40, 0, 0.1, 0.05), water(40, 0, -0.1, 0)]);
  const a = mk(); for (let i = 0; i < 40; i++) stepWith(a, full);
  const b = mk(); for (let i = 0; i < 40; i++) stepWith(b, full);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// ── I. 하위 호환 — 분자 없는 세계(원자뿐)는 rule_0005 가 아무것도 안 바꾼다 ──────────
{
  // rule_0004 verify 의 H₂O 형성을 rule_0005 포함/제외로 굴려 — 형성 자체는 동일해야(인력은 분자 형성 후·약함)
  const mk = () => world([atom(0, 0, 8, 16), atom(-9, 0, 1, 1)].map((p, i) => ({ ...p, x: i === 0 ? 0 : -9, vx: i === 0 ? 0 : 0.3 })));
  // 단순화: 단일 원자 둘만(분자 아님) 굴려 rule_0005 가 힘을 안 더하는지(rule1~4 와 결과 동일)
  const base = world([{ x: 0, y: 0, z: 0, vx: 0.2, vy: 0, vz: 0, m: 2, en: 1.0, q: 0, r: 3 }, { x: 30, y: 0, z: 0, vx: -0.2, vy: 0, vz: 0, m: 2, en: 1.0, q: 0, r: 3 }]);
  const with5 = world([{ x: 0, y: 0, z: 0, vx: 0.2, vy: 0, vz: 0, m: 2, en: 1.0, q: 0, r: 3 }, { x: 30, y: 0, z: 0, vx: -0.2, vy: 0, vz: 0, m: 2, en: 1.0, q: 0, r: 3 }]);
  for (let i = 0; i < 3; i++) { stepWith(base, [rule1, rule2, rule3, rule4]); stepWith(with5, full); }
  // 둘 다 공유 병합(2→1) 됐고, 병합 후 단일 분자라 상대 분자가 없어 인력 0 → 위치·속도 동일
  check('하위호환: 단일 분자만 있으면 rule_0005 는 무영향(rule1~4 와 동일)',
    JSON.stringify(base.elements.map(e => [e.x, e.y, e.vx, e.vy])) === JSON.stringify(with5.elements.map(e => [e.x, e.y, e.vx, e.vy])),
    `개수 base=${base.elements.length} with5=${with5.elements.length}`);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

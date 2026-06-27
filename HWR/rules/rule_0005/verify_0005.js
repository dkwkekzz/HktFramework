// verify_0005 — 분자의 창발 특성(부분전하) + 분자 간 인력이 *전자기력에서 창발*함을 단언한다.
//   node rules/rule_0005/verify_0005.js
//
// 핵심: rule_0005 는 **힘을 만들지 않는다**. 분자에 부분전하 δ 를 부여(특성)할 뿐이고, 분자 간 인력은
//   rule_0003(전자기력)이 그 δ 를 보고 *창발*시킨다(반데르발스 = 부분전하 쿨롱, 별도 힘 아님 = 이중계산 없음).
//   분자(중성)는 부분전하 덕에 EM 에 보이고, 홀원자(중성)는 안 보인다 — "분자가 되어야 EM 특성을 가진다".
//
// 한계(정직): 분자는 강체 점질량이라 *회전하지 않는다*. 그래서 부분전하 EM 은 방향 의존적이고(올바른 물리:
//   전하-쌍극자·쌍극자-쌍극자), 무작위 분자 무리의 등방 응결은 회전 없이는 깨끗이 안 난다 → 분자 회전은
//   다음 규칙(백로그). 여기선 방향이 명확한 *이온-쌍극자*로 EM 창발을 강건하게 검증한다.
import { stepWorld } from '../../engine.js';
import rule1 from '../rule_0001/rule_0001.js';
import rule2 from '../rule_0002/rule_0002.js';
import rule3 from '../rule_0003/rule_0003.js';
import rule4, { shellState } from '../rule_0004/rule_0004.js';
import rule5, { moleculeProps } from './rule_0005.js';

const full = [rule1, rule2, rule3, rule4, rule5];     // 전체 스택(뷰어와 동일)
const only5 = [rule5];                                 // rule_0005 단독(힘 없음을 보임)
const params = Object.assign({ dt: 1 }, rule1.defaults, rule2.defaults, rule3.defaults, rule4.defaults, rule5.defaults);
const W = 1e6;
const B = 5000;                                        // 기준 좌표 — 토러스 경계(0)에서 멀리
const world = els => ({ width: W, height: W, depth: W, tick: 0, elements: els, impulses: [] });
const stepWith = (w, rules) => stepWorld(w, rules, params);

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}

// 부분 원자: 절대 위치 (x,y) · Z · 질량
const atom = (x, y, Z, m) => ({ x, y, z: 0, vx: 0, vy: 0, vz: 0, Z, en: shellState(Z).en, m, r: 3 });
// 분자: O 중앙, H 둘을 hdir(±x)쪽으로 — O 를 한쪽에 노출(이온-쌍극자 방향 통제)
function water(cx, cy, hdir = -1, vx = 0, vy = 0) {
  const parts = [atom(cx, cy, 8, 16), atom(cx + hdir * 9, cy + 5, 1, 1), atom(cx + hdir * 9, cy - 5, 1, 1)];
  return { x: cx, y: cy, z: 0, vx, vy, vz: 0, m: 18, q: 0, freeValence: 0, r: Math.sqrt(27), parts };
}
// 굽은(유극성)·일직선(무극성) 물 — 극성=기하 확인용
const waterBent = (cx, cy) => ({ x: cx, y: cy, z: 0, vx: 0, vy: 0, vz: 0, m: 18, q: 0, freeValence: 0, r: Math.sqrt(27), parts: [atom(cx, cy, 8, 16), atom(cx - 8, cy + 3, 1, 1), atom(cx + 8, cy + 3, 1, 1)] });
const waterFlat = (cx, cy) => ({ x: cx, y: cy, z: 0, vx: 0, vy: 0, vz: 0, m: 18, q: 0, freeValence: 0, r: Math.sqrt(27), parts: [atom(cx, cy, 8, 16), atom(cx - 8, cy, 1, 1), atom(cx + 8, cy, 1, 1)] });
const co2 = (cx, cy) => ({ x: cx, y: cy, z: 0, vx: 0, vy: 0, vz: 0, m: 44, q: 0, freeValence: 0, r: Math.sqrt(27), parts: [atom(cx, cy, 6, 12), atom(cx - 12, cy, 8, 16), atom(cx + 12, cy, 8, 16)] });
// 이온 — en 을 줘 rule_0002 가 이온으로 인식(이미 하전 → 재이동·병합 안 함, verify_0003 과 동일)
const ion = (cx, cy, q, vx = 0, vy = 0) => ({ x: cx, y: cy, z: 0, vx, vy, vz: 0, m: 23, q, en: q > 0 ? 0.9 : 3.2, r: 3 });
const neAtom = (cx, cy) => ({ x: cx, y: cy, z: 0, vx: 0, vy: 0, vz: 0, Z: 10, en: shellState(10).en, m: 20, r: 5 });

const propsOf = m => moleculeProps(m, world([m]), 10);
// 1스텝 후 첫 원소가 얻은 vx (양수 = +x 로 가속)
const step1vx = (els, rules) => { const w = world(els); stepWith(w, rules); return w.elements[0].vx; };

// ── A. 부분전하 — 분자가 되면 구성 원자가 en 차이로 δ 를 띤다(중성 분자, Σδ=0) ──────────
{
  const p = propsOf(water(0, 0));
  const sum = p.partials.reduce((a, b) => a + b, 0);
  check('부분전하: 분자 구성 원자가 δ 를 띤다(O 와 H 부호 반대)', p.partials[0] * p.partials[1] < 0, `δ=[${p.partials.map(x => x.toFixed(2))}]`);
  check('부분전하: 중성 분자라 Σδ=0', Math.abs(sum) < 1e-9, `Σδ=${sum.toExponential(1)}`);
  // 극성(쌍극자) = 부분전하의 기하 가중합. 굽으면 잔류, 대칭(일직선·CO₂)이면 상쇄
  check('극성: 굽은 H₂O 유극성 / 일직선 H₂O·CO₂ 무극성(기하가 가름)',
    propsOf(waterBent(0, 0)).polarity > 1e-6 && propsOf(waterFlat(0, 0)).polarity < 1e-9 && propsOf(co2(0, 0)).polarity < 1e-9,
    `굽음=${propsOf(waterBent(0, 0)).polarity.toFixed(2)} 일직선=${propsOf(waterFlat(0, 0)).polarity.toExponential(1)} CO₂=${propsOf(co2(0, 0)).polarity.toExponential(1)}`);
}

// ── B. rule_0005 는 힘을 만들지 않는다 — 이중계산 없음(인력은 EM 몫) ────────────────────
{
  // 분자+이온을 rule_0005 *단독*으로 굴려도 — 전자기력이 없으니 — 아무 힘도 없다(정지 유지)
  check('이중계산 없음: rule_0005 단독은 힘 0(분자+이온 정지)', step1vx([water(B, B, -1), ion(B + 10, B, -1)], only5) === 0);
  check('이중계산 없음: rule_0005 단독은 힘 0(분자+분자 정지)', step1vx([water(B, B, -1), water(B + 20, B, +1)], only5) === 0);
}

// ── C. 분자가 되어야 EM 에 보인다 — 중성 분자는 부분전하로 보이고, 홀원자는 안 보인다 ──────
{
  // 중성 *분자*: 순전하 0 이지만 부분전하로 EM 력을 받는다(이온 곁에서 가속)
  const vMol = step1vx([water(B, B, -1), ion(B + 10, B, -1)], full);
  // 중성 *홀원자*(Ne): 내부 구조 없음 → 부분전하 없음 → 이온 곁에서도 EM 력 0
  const vAtom = step1vx([neAtom(B, B), ion(B + 10, B, -1)], full);
  check('가시: 중성 분자는 부분전하로 EM 에 보인다(이온 곁 가속 ≠ 0)', Math.abs(vMol) > 1e-6, `vx=${vMol.toExponential(2)}`);
  check('불가시: 중성 홀원자는 EM 에 안 보인다(이온 곁에서도 정지)', vAtom === 0, `vx=${vAtom}`);
}

// ── D. 분자 간 인력 = 전자기력 — 부분전하에 쿨롱이 작용(방향 의존, 올바른 물리) ──────────
{
  // 이온(−)을 +x 에 둠. O(δ+)가 이온쪽이면 당김(vx>0), H(δ−)가 이온쪽이면 밂(vx<0).
  const vO = step1vx([water(B, B, -1), ion(B + 10, B, -1)], full);   // O 노출(H 반대편)
  const vH = step1vx([water(B, B, +1), ion(B + 10, B, -1)], full);   // H 가 이온쪽
  check('EM 인력: O(δ+)가 음이온쪽 → 당김(vx>0)', vO > 0, `vx=${vO.toExponential(2)}`);
  check('EM 인력: H(δ−)가 음이온쪽 → 밂(vx<0)', vH < 0, `vx=${vH.toExponential(2)}`);
  check('EM 방향성: 같은 분자도 향한 전하에 따라 인력↔반발(vO > vH)', vO > vH, `vO=${vO.toExponential(2)} vH=${vH.toExponential(2)}`);
  // 이온 부호를 뒤집으면 힘도 뒤집힌다(쿨롱) — O 노출에 양이온이면 이제 밂
  const vOpos = step1vx([water(B, B, -1), ion(B + 10, B, +1)], full);
  check('EM 부호: 이온 부호 뒤집으면 힘도 뒤집힘(O 노출에 양이온 → 밂)', vOpos < 0, `vx=${vOpos.toExponential(2)}`);
}

// ── E. 운동량 보존 — EM(쿨롱+반발+마찰)은 작용-반작용 → Σmv 보존(부분전하에도) ──────────
{
  const w = world([water(B, B, -1, 0.1, 0.05), ion(B + 14, B, -1, -0.08, 0)]);
  const P = ww => ww.elements.reduce((s, e) => [s[0] + e.m * e.vx, s[1] + e.m * e.vy, s[2] + e.m * (e.vz || 0)], [0, 0, 0]);
  const p0 = P(w);
  for (let i = 0; i < 40; i++) stepWith(w, full);
  const p1 = P(w);
  check('보존: 이온-쌍극자 EM 하에 Σmv 보존', Math.abs(p0[0] - p1[0]) < 1e-9 && Math.abs(p0[1] - p1[1]) < 1e-9 && Math.abs(p0[2] - p1[2]) < 1e-9,
    `Δp=(${(p1[0] - p0[0]).toExponential(1)}, ${(p1[1] - p0[1]).toExponential(1)})`);
}

// ── F. 색·안정성(측정) — 조성의 함수 ────────────────────────────────────────────────
{
  const pw = propsOf(waterBent(0, 0)), pc = propsOf(co2(0, 0));
  check('색: 분자는 조성의 함수로 색을 갖는다(0~360)', pw.hue >= 0 && pw.hue < 360 && pc.hue >= 0 && pc.hue < 360, `H₂O=${pw.hue.toFixed(0)} CO₂=${pc.hue.toFixed(0)}`);
  check('색: 조성이 다르면 색도 다르다(H₂O ≠ CO₂)', Math.abs(pw.hue - pc.hue) > 1e-6);
  const radical = { x: 0, y: 0, z: 0, m: 17, q: 0, freeValence: 1, r: 4, parts: [atom(0, 0, 8, 16), atom(-9, 3, 1, 1)] };  // OH(잔여 손 1)
  check('안정성: 옥텟 채운 분자 안정 / 라디칼 반응성', pw.stable === true && pw.reactivity === 0 && propsOf(radical).stable === false && propsOf(radical).reactivity === 1);
}

// ── G. 결정론 — 같은 입력 → 비트 동일 ────────────────────────────────────────────────
{
  const mk = () => world([water(B, B, -1, 0.1, 0.05), ion(B + 14, B, -1, -0.05, 0)]);
  const a = mk(); for (let i = 0; i < 40; i++) stepWith(a, full);
  const b = mk(); for (let i = 0; i < 40; i++) stepWith(b, full);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// ── H. 하위 호환 — 부분전하 없는 세계(이온·원자만)는 EM 가 기존 거동 그대로 ────────────────
{
  // 반대 이온쌍은 평형 거리(=6)에 안착(rule_0003 기존 거동) — 부분전하 확장이 이온 거동을 안 바꿈
  const w = world([ion(B, B, +1), ion(B + 10, B, -1)]);
  for (let i = 0; i < 400; i++) stepWith(w, full);
  const sep = Math.hypot(w.elements[0].x - w.elements[1].x, w.elements[0].y - w.elements[1].y);
  check('하위호환: 이온쌍은 평형 거리(=6)에 안착(기존 EM 그대로)', Math.abs(sep - 6) < 1, `거리=${sep.toFixed(2)}`);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

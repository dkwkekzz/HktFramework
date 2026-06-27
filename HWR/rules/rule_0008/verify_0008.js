// verify_0008 — 골격 결합. 엔진+규칙(rule_0001~0008)으로 굴려(뷰어와 동일) 단언한다.
//   node rules/rule_0008/verify_0008.js
//
// 핵심: 공유 결합이 *융합 질점* 대신 *지속 링크* 가 되어 — 분자가 distinct 원자 골격으로 남는다.
//   그 위에서 ① 결합 길이(Morse, 가역 분해) ② 결합각(VSEPR, 형상) ③ 고립쌍(굽음) ④ 결합 소산(회전 보존)
//   이 작동해, 형상·고분자 사슬·분자 회전이 *창발* 한다. 운동량 보존·결정론·하위 호환을 함께 단언.
import { stepWorld } from '../../engine.js';
import rule1 from '../rule_0001/rule_0001.js';
import rule2 from '../rule_0002/rule_0002.js';
import rule3 from '../rule_0003/rule_0003.js';
import rule4, { shellState } from '../rule_0004/rule_0004.js';
import rule5 from '../rule_0005/rule_0005.js';
import rule6 from '../rule_0006/rule_0006.js';
import rule7 from '../rule_0007/rule_0007.js';
import rule8 from './rule_0008.js';

const full = [rule1, rule2, rule3, rule4, rule5, rule6, rule7, rule8];
const only8 = [rule8];
const params = Object.assign({ dt: 1, bondOrderCap: 1 },
  rule1.defaults, rule2.defaults, rule3.defaults, rule4.defaults, rule5.defaults, rule6.defaults, rule7.defaults, rule8.defaults);
const W = 1e6, B = 5000;
const world = els => ({ width: W, height: W, depth: W, tick: 0, elements: els, impulses: [], skeletal: true });
const step = (w, rules = full) => stepWorld(w, rules, params);

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const mass = Z => Z * 2;
const atom = (x, y, z, Z, vx = 0, vy = 0, vz = 0) => ({ x, y, z, vx, vy, vz, Z, m: mass(Z), r: 3 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const Lof = (Za, Zb, order = 1) => {
  const ra = params.bondK * Math.sqrt(mass(Za)), rb = params.bondK * Math.sqrt(mass(Zb));
  return ((ra + rb) * params.lenScale) / (1 + params.lenShorten * (order - 1));
};
// 중심 c 에서 두 이웃 a,b 가 이루는 각(도)
const angleAt = (c, a, b) => {
  const u = [a.x - c.x, a.y - c.y, (a.z || 0) - (c.z || 0)];
  const v = [b.x - c.x, b.y - c.y, (b.z || 0) - (c.z || 0)];
  const du = Math.hypot(...u), dv = Math.hypot(...v);
  const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (du * dv);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
};
const P = w => w.elements.reduce((s, e) => [s[0] + e.m * e.vx, s[1] + e.m * e.vy, s[2] + e.m * (e.vz || 0)], [0, 0, 0]);
// 수동 골격 분자 — 중심 + 이웃들을 결합 링크로 직접 잇는다(형성 동역학과 분리해 *힘* 만 시험).
function molecule(center, ligands, order = 1) {
  const els = [center, ...ligands];
  els.forEach((e, k) => { e.id = k; e.bonds = []; });
  for (let k = 1; k < els.length; k++) {
    center.bonds.push({ other: k, order });
    ligands[k - 1].bonds.push({ other: 0, order });
  }
  const w = world(els); w._nextId = els.length; return w;
}

// ── A. 위상: 공유 결합이 융합 아니라 *지속 링크* — distinct 원자·결합 기록·보존 ──────────────
{
  // 두 탄소를 결합 길이 근처에서 부드럽게 만나게 → 골격 결합(융합 X)
  const L = Lof(6, 6);
  const w = world([atom(B, B, B, 6, 0.05, 0, 0), atom(B + L * 1.02, B, B, 6, -0.05, 0, 0)]);
  const m0 = w.elements.reduce((s, e) => s + e.m, 0), p0 = P(w);
  for (let i = 0; i < 30; i++) step(w);
  const e0 = w.elements[0], e1 = w.elements[1];
  check('위상: 공유 결합 후에도 원자가 distinct(융합 안 함, 개수 유지)', w.elements.length === 2, `개수=${w.elements.length}`);
  check('위상: 결합이 인접 리스트에 기록(양쪽 e.bonds)', e0.bonds && e0.bonds.length === 1 && e1.bonds && e1.bonds.length === 1);
  check('위상: 결합이 freeValence 를 차감(C 4 → 3)', e0.freeValence === 3 && e1.freeValence === 3, `fv=${e0.freeValence},${e1.freeValence}`);
  const m1 = w.elements.reduce((s, e) => s + e.m, 0), p1 = P(w);
  check('위상: 질량 보존', Math.abs(m0 - m1) < 1e-9);
  check('위상: 운동량 보존(Σmv)', Math.abs(p0[0] - p1[0]) < 1e-6 && Math.abs(p0[1] - p1[1]) < 1e-6 && Math.abs(p0[2] - p1[2]) < 1e-6);
}

// ── B. 결합 길이: Morse + 소산 → 평형 길이 L 부근으로 정착(진동이 식는다) ────────────────────
{
  const L = Lof(1, 1);
  const w = molecule(atom(B, B, B, 1), [atom(B + L * 1.6, B, B, 1)]);  // 늘어난 상태로 출발(H–H)
  for (let i = 0; i < 400; i++) step(w, only8);
  const r = dist(w.elements[0], w.elements[1]);
  check('길이: 결합 쌍이 평형 길이 L 부근으로 정착', Math.abs(r - L) < L * 0.1, `r=${r.toFixed(2)} L=${L.toFixed(2)}`);
}

// ── C. 형상(직선): 고립쌍 0 인 중심 + 이웃 2 → ~180°(예: O=C=O 직선) ─────────────────────────
{
  const L = Lof(6, 8);
  // 탄소 중심(고립쌍 0) + 산소 2(이중결합 차수 2 가정). 90° 로 시작 → 벌어지는지.
  const c = atom(B, B, B, 6);
  const o1 = atom(B + L, B, B, 8), o2 = atom(B, B + L, B, 8);
  const w = molecule(c, [o1, o2], 2);
  for (let i = 0; i < 600; i++) step(w, only8);
  const ang = angleAt(w.elements[0], w.elements[1], w.elements[2]);
  check('형상(직선): 고립쌍 없는 2이웃 중심은 ~180° 직선', ang > 165, `각=${ang.toFixed(1)}°`);
}

// ── D. 형상(굽음): 고립쌍 2 인 산소 + 수소 2 → <180°(물의 굽음 — 직선과 대비) ──────────────────
{
  const L = Lof(8, 1);
  const o = atom(B, B, B, 8);
  const h1 = atom(B + L, B, B, 1), h2 = atom(B, B + L, B, 1);  // 90° 시작
  const w = molecule(o, [h1, h2], 1);
  for (let i = 0; i < 800; i++) step(w, only8);
  const ang = angleAt(w.elements[0], w.elements[1], w.elements[2]);
  check('형상(굽음): 고립쌍 2 인 물(H–O–H)은 굽는다(180°가 아님)', ang < 160 && ang > 90, `각=${ang.toFixed(1)}°`);
}

// ── E. 형상(사면체): 탄소 + 수소 4 → 사면체각(~109.5°) 부근·모든 이웃 분리 ────────────────────
{
  const L = Lof(6, 1);
  const c = atom(B, B, B, 6);
  // 4 수소를 작은 비대칭 배치로(자연 정렬 보려고)
  const hs = [atom(B + L, B + 1, B, 1), atom(B - L, B, B + 1, 1), atom(B, B + L, B - 1, 1), atom(B + 1, B, B + L, 1)];
  const w = molecule(c, hs, 1);
  for (let i = 0; i < 1500; i++) step(w, only8);
  const c0 = w.elements[0];
  let amin = 999, amax = 0, asum = 0, np = 0;
  for (let a = 1; a <= 4; a++) for (let b = a + 1; b <= 4; b++) {
    const ang = angleAt(c0, w.elements[a], w.elements[b]); amin = Math.min(amin, ang); amax = Math.max(amax, ang); asum += ang; np++;
  }
  check('형상(사면체): 4 이웃이 서로 벌어진다(최소각 > 95°)', amin > 95, `최소각=${amin.toFixed(1)}°`);
  check('형상(사면체): 평균 결합각이 사면체각(109.5°) 부근', Math.abs(asum / np - 109.5) < 18, `평균=${(asum / np).toFixed(1)}°`);
}

// ── F. 고분자 사슬: 탄소들이 단일 결합(cap=1) 으로 *사슬* 골격 — 융합 블롭 아님 ──────────────────
{
  // 6 탄소를 결합 길이 간격으로 일렬, 살짝 안쪽 속도 → 단일 결합 사슬로 연결
  const L = Lof(6, 6);
  const n = 6, els = [];
  const xc = B + ((n - 1) * L * 1.03) / 2;             // 사슬 중심
  for (let k = 0; k < n; k++) {
    const x = B + k * L * 1.03;
    els.push(atom(x, B, B, 6, (xc - x) * 0.02, 0, 0));  // 안쪽으로 살짝 수렴(결합 게이트의 '접근' 충족)
  }
  const w = world(els);
  for (let i = 0; i < 200; i++) step(w);
  check('사슬: 탄소가 융합 안 하고 distinct 유지(개수 6)', w.elements.length === n, `개수=${w.elements.length}`);
  // 연결 성분 = 전체가 하나의 사슬인지 + 각 탄소의 탄소 이웃 ≤ 2(선형, 가지 아님)
  let maxDeg = 0, bonded = 0;
  for (const e of w.elements) { const d = (e.bonds || []).length; maxDeg = Math.max(maxDeg, d); if (d > 0) bonded++; }
  check('사슬: 모든 탄소가 결합에 참여(고립 원자 없음)', bonded === n, `결합 참여=${bonded}/${n}`);
  check('사슬: 각 원자 ≤2 이웃 = *선형 사슬*(가지·블롭 아님)', maxDeg <= 2, `최대 차수=${maxDeg}`);
  // 끝 원자 2개는 차수 1(사슬 양 끝)
  const ends = w.elements.filter(e => (e.bonds || []).length === 1).length;
  check('사슬: 양 끝 원자 2개(차수 1) = 열린 사슬', ends === 2, `끝=${ends}`);
}

// ── G. 회전/텀블링: 분자에 각운동 부여 → 회전이 소산에 죽지 않는다(분자 회전 창발) ──────────────
{
  const L = Lof(1, 1);
  // H–H 다이머에 *접선* 속도(회전) 부여 — 중심 기준 반대 방향
  const h1 = atom(B - L / 2, B, B, 1, 0, +0.6, 0), h2 = atom(B + L / 2, B, B, 1, 0, -0.6, 0);
  const w = molecule(h1, [h2]);
  const angMom = ww => {  // z축 각운동량 Lz = Σ m (x·vy − y·vx) (질량중심 기준)
    let cx = 0, cy = 0, M = 0; for (const e of ww.elements) { cx += e.m * e.x; cy += e.m * e.y; M += e.m; } cx /= M; cy /= M;
    return ww.elements.reduce((s, e) => s + e.m * ((e.x - cx) * e.vy - (e.y - cy) * e.vx), 0);
  };
  const lz0 = angMom(w);
  for (let i = 0; i < 300; i++) step(w, only8);
  const lz1 = angMom(w);
  check('회전: 각운동량이 유지(소산이 회전을 죽이지 않음 = 텀블링 보존)', Math.abs(lz1) > Math.abs(lz0) * 0.7, `Lz ${lz0.toFixed(2)}→${lz1.toFixed(2)}`);
  check('회전: 분자가 흩어지지 않고 묶여 회전(결합 길이 유지)', Math.abs(dist(w.elements[0], w.elements[1]) - L) < L * 0.3);
}

// ── H. 가역 분해: 결합을 충분히 늘이면 끊긴다 → 링크 제거·freeValence 복원 ─────────────────────
{
  const L = Lof(1, 1);
  // 결합 길이의 훨씬 밖에서 서로 멀어지는 속도 → Morse 끊김 임계 초과 → 분해
  const h1 = atom(B, B, B, 1, -0.5, 0, 0), h2 = atom(B + L * (1 + params.bondBreak + 0.5), B, B, 1, +0.5, 0, 0);
  const w = molecule(h1, [h2]);
  check('분해: 시작은 결합 상태(링크 1)', w.elements[0].bonds.length === 1);
  for (let i = 0; i < 10; i++) step(w, full);
  const broken = w.elements[0].bonds.length === 0 && w.elements[1].bonds.length === 0;
  check('분해: 늘어난 결합이 끊긴다(링크 제거)', broken, `링크=${w.elements[0].bonds.length}`);
  // 끊기면 손이 복원 → H 의 freeValence 1 로 되돌아옴
  step(w, full);
  check('분해: 끊긴 뒤 freeValence 복원(H: 0→1)', w.elements[0].freeValence === 1, `fv=${w.elements[0].freeValence}`);
}

// ── I. 운동량 보존 — 모든 골격 힘은 작용-반작용 쌍 내부 → Σmv 보존 ───────────────────────────
{
  const L = Lof(8, 1);
  const o = atom(B, B, B, 8, 0.2, -0.1, 0.05);
  const h1 = atom(B + L, B + 2, B, 1, -0.1, 0, 0), h2 = atom(B - 1, B + L, B, 1, 0, 0.1, -0.05);
  const w = molecule(o, [h1, h2], 1);
  const p0 = P(w);
  for (let i = 0; i < 200; i++) step(w, only8);
  const p1 = P(w);
  check('보존: 골격 힘(길이+각+고립쌍+소산) 하에 Σmv 보존', Math.abs(p0[0] - p1[0]) < 1e-6 && Math.abs(p0[1] - p1[1]) < 1e-6 && Math.abs(p0[2] - p1[2]) < 1e-6,
    `Δp=(${(p1[0] - p0[0]).toExponential(1)},${(p1[1] - p0[1]).toExponential(1)},${(p1[2] - p0[2]).toExponential(1)})`);
}

// ── J. 결정론 ─────────────────────────────────────────────────────────────────
{
  const mk = () => {
    const L = Lof(6, 6);
    return world([atom(B, B, B, 6, 0.05, 0.02, 0), atom(B + L * 1.1, B, B, 6, -0.05, 0, 0.01), atom(B, B + L * 1.1, B, 6, 0, -0.03, 0)]);
  };
  const a = mk(); for (let i = 0; i < 60; i++) step(a);
  const b = mk(); for (let i = 0; i < 60; i++) step(b);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// ── K. 하위 호환: skeletal 아닌 세계는 옛 융합 그대로(rule_0008 무영향) ─────────────────────────
{
  // skeletal 플래그 없이 두 수소 → 옛 거동: 공유 *융합*(병합)으로 개수 줄어듦
  const L = Lof(1, 1);
  const w = { width: W, height: W, depth: W, tick: 0, impulses: [], elements: [atom(B, B, B, 1, 0.05, 0, 0), atom(B + L * 1.0, B, B, 1, -0.05, 0, 0)] };
  for (let i = 0; i < 20; i++) stepWorld(w, full, params);
  check('하위호환: skeletal 아니면 공유 결합은 옛 *융합*(병합, 개수 감소)', w.elements.length === 1, `개수=${w.elements.length}`);
  check('하위호환: 융합체는 골격 링크(e.bonds)를 안 만든다', !w.elements[0].bonds);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

// verify_0006 — 금속 결합. 엔진+규칙(rule_0001~0006)으로 굴려(뷰어와 동일) 단언한다.
//   node rules/rule_0006/verify_0006.js
//
// 핵심: 금속 원자(Z 의 껍질에서 tendency='metal' 창발)가 *비방향성·비포화·소산적* 전자바다 결합으로
//   **차가운 고체 격자**로 응집한다 — 분자(방향성)·이온(같은전하 반발)이 dt=1 에서 못 하던 *벌크 응집*을
//   금속은 등방+소산 덕에 해낸다. 비활성/비금속은 금속결합 안 함 → 물질 종류가 결합 종류로 갈린다.
import { stepWorld } from '../../engine.js';
import rule1 from '../rule_0001/rule_0001.js';
import rule2 from '../rule_0002/rule_0002.js';
import rule3 from '../rule_0003/rule_0003.js';
import rule4, { shellState } from '../rule_0004/rule_0004.js';
import rule5 from '../rule_0005/rule_0005.js';
import rule6 from './rule_0006.js';

const full = [rule1, rule2, rule3, rule4, rule5, rule6];
const only6 = [rule6];
const params = Object.assign({ dt: 1 }, rule1.defaults, rule2.defaults, rule3.defaults, rule4.defaults, rule5.defaults, rule6.defaults);
const W = 1e6, B = 5000;
const world = els => ({ width: W, height: W, depth: W, tick: 0, elements: els, impulses: [] });
const stepWith = (w, rules) => stepWorld(w, rules, params);

let failed = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const atom = (x, y, z, Z, vx = 0, vy = 0, vz = 0) => ({ x, y, z, vx, vy, vz, Z, m: Z * 2, r: 3 });
const sigmaOf = Z => 2 * params.bondK * Math.sqrt(Z * 2);

// 금속 원자 n³ 격자(평형 밖 σ·1.25 간격, 시드 흔들림·속도) → 응집·냉각시켜 고체가 되는지
function metalCluster(Z, n) {
  const sp = sigmaOf(Z) * 1.25;
  const els = []; let s = 5;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++)
    els.push(atom(B + i * sp + rnd() * sp * 0.2, B + j * sp + rnd() * sp * 0.2, B + k * sp + rnd() * sp * 0.2, Z, rnd() * 0.5, rnd() * 0.5, rnd() * 0.5));
  return world(els);
}
const stats = w => {
  let cx = 0, cy = 0, cz = 0, ke = 0; const n = w.elements.length;
  for (const e of w.elements) { cx += e.x; cy += e.y; cz += e.z; ke += 0.5 * e.m * (e.vx ** 2 + e.vy ** 2 + (e.vz || 0) ** 2); }
  cx /= n; cy /= n; cz /= n;
  let rg = 0, nn = 0;
  for (const e of w.elements) { rg += dist(e, { x: cx, y: cy, z: cz }) ** 2; let bd = 1e9; for (const o of w.elements) { if (o === e) continue; bd = Math.min(bd, dist(e, o)); } nn += bd; }
  return { n, ke, rg: Math.sqrt(rg / n), nn: nn / n };
};

// ── A. 금속성은 Z 에서 창발 ───────────────────────────────────────────────────
{
  const Fe = shellState(26), Na = shellState(11), Cl = shellState(17), Ne = shellState(10);
  check('금속성: Fe·Na 는 금속(tendency=metal)', Fe.tendency === 'metal' && Na.tendency === 'metal');
  check('금속성: Cl(비금속)·Ne(비활성)는 금속 아님', Cl.tendency !== 'metal' && Ne.tendency !== 'metal');
  check('금속성 세기(원자가): Fe(8) > Na(1) → Fe 가 더 단단', Fe.valence > Na.valence, `Fe=${Fe.valence} Na=${Na.valence}`);
}

// ── B. 금속은 고체 격자로 응집한다(벌크 응집 — 차가운 바운드 덩어리) ──────────────
{
  const wFe = metalCluster(26, 3); const N = wFe.elements.length;
  const sp = sigmaOf(26) * 1.25;
  let bad = false;
  for (let i = 0; i < 800; i++) { stepWith(wFe, full); for (const e of wFe.elements) if (!isFinite(e.x)) bad = true; }
  const s = stats(wFe);
  check('응집: 금속 덩어리가 발산하지 않는다', !bad);
  check('응집: 식어서 바운드(잔여 KE 작음 = 고체)', s.ke < 5, `KE=${s.ke.toFixed(2)}`);
  check('응집: 최근접 간격이 접촉(σ 부근)으로 수축 = 격자', s.nn < sp, `최근접=${s.nn.toFixed(1)} < 시작간격 ${sp.toFixed(1)}`);
  check('응집: 금속은 병합 안 함(distinct 원자 격자, 분자 아님)', wFe.elements.length === N, `개수 ${N}→${wFe.elements.length}`);
}

// ── C. 비활성/비금속은 금속결합 안 함 → 안 응집(물질 종류가 결합으로 갈림) ────────────
{
  const wNe = world([]); let s = 9;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; };
  const sp = 30;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++)
    wNe.elements.push(atom(B + i * sp + rnd() * 5, B + j * sp + rnd() * 5, B + k * sp + rnd() * 5, 10, rnd() * 0.3, rnd() * 0.3, rnd() * 0.3));
  const rg0 = stats(wNe).rg;
  for (let i = 0; i < 400; i++) stepWith(wNe, full);
  const rg1 = stats(wNe).rg;
  check('비활성: Ne 는 금속결합 안 해 응집 안 함(덩어리 안 수축/오히려 퍼짐)', rg1 >= rg0 - 2, `반경 ${rg0.toFixed(1)} → ${rg1.toFixed(1)}`);
}

// ── D. 금속끼리 병합 안 함(격자) — rule_0004 가드: 두 금속 원자는 분자로 안 합쳐진다 ──────
{
  const w = world([atom(B - sigmaOf(11) * 0.6, B, B, 11, 0.2, 0, 0), atom(B + sigmaOf(11) * 0.6, B, B, 11, -0.2, 0, 0)]);
  for (let i = 0; i < 40; i++) stepWith(w, full);
  check('격자: 두 금속 원자는 병합 안 하고 distinct 유지(금속=분자 아님)', w.elements.length === 2, `개수=${w.elements.length}`);
  check('격자: 두 금속은 전자바다로 묶여 가까이 머묾(흩어지지 않음)', dist(w.elements[0], w.elements[1]) < sigmaOf(11) * 2, `거리=${dist(w.elements[0], w.elements[1]).toFixed(1)}`);
}

// ── E. 결합 세기 창발(Fe > Na) — 같은 σ-상대 거리에서 Fe 의 전자바다 인력이 더 깊다 ────────
{
  // 두 원자를 1.3σ 에 정지로 두고 rule_0006 단독 1스텝 → 끌리는 가속(서로 다가옴) 크기 비교(질량 정규화)
  const pullAccel = Z => {
    const sp = sigmaOf(Z) * 1.3;
    const w = world([atom(B, B, B, Z), atom(B + sp, B, B, Z)]);
    stepWith(w, only6);
    return Math.abs(w.elements[0].vx);  // 1스텝 후 +x(상대쪽) 가속 = F/m
  };
  const aFe = pullAccel(26), aNa = pullAccel(11);
  check('세기: Fe 의 금속결합 인력(우물 깊이)이 Na 보다 깊다', aFe > aNa, `Fe 가속=${aFe.toExponential(2)} Na=${aNa.toExponential(2)}`);
}

// ── F. 운동량 보존 — 전자바다 소산은 *상대*운동만 흡수 → Σmv 보존(에너지만 냉각) ───────────
{
  const sp = sigmaOf(26) * 1.2;
  const w = world([atom(B, B, B, 26, 0.2, 0.1, 0), atom(B + sp, B, B, 26, -0.1, 0, 0.05)]);
  const P = ww => ww.elements.reduce((s, e) => [s[0] + e.m * e.vx, s[1] + e.m * e.vy, s[2] + e.m * (e.vz || 0)], [0, 0, 0]);
  const p0 = P(w);
  for (let i = 0; i < 60; i++) stepWith(w, only6);
  const p1 = P(w);
  check('보존: 금속결합(인력+소산) 하에 Σmv 보존', Math.abs(p0[0] - p1[0]) < 1e-9 && Math.abs(p0[1] - p1[1]) < 1e-9 && Math.abs(p0[2] - p1[2]) < 1e-9,
    `Δp=(${(p1[0] - p0[0]).toExponential(1)}, ${(p1[1] - p0[1]).toExponential(1)})`);
}

// ── G. 결정론 ─────────────────────────────────────────────────────────────────
{
  const mk = () => world([atom(B, B, B, 26, 0.2, 0, 0), atom(B + sigmaOf(26) * 1.2, B, B, 26, -0.1, 0.05, 0)]);
  const a = mk(); for (let i = 0; i < 50; i++) stepWith(a, full);
  const b = mk(); for (let i = 0; i < 50; i++) stepWith(b, full);
  check('결정론: 같은 입력 → 비트 동일', JSON.stringify(a) === JSON.stringify(b));
}

// ── H. 하위 호환 — 금속 없는 세계(비금속·이온·분자)는 rule_0006 무영향 ──────────────────
{
  // 비금속 원자 둘만 rule_0006 단독으로 굴려도 힘 0(금속결합은 금속끼리만)
  const w = world([atom(B, B, B, 17), atom(B + 30, B, B, 17)]);   // Cl(비금속) 둘
  for (let i = 0; i < 20; i++) stepWith(w, only6);
  check('하위호환: 비금속끼리는 금속결합 0(정지 유지)', Math.abs(w.elements[0].x - B) < 1e-9 && Math.abs(w.elements[1].x - (B + 30)) < 1e-9);
}

console.log(failed === 0 ? '\n전체 통과 ✅' : `\n실패 ${failed}건 ❌`);
process.exitCode = failed === 0 ? 0 : 1;

// step_0061/verify.js — M1 신뢰성 있는 인접 병합: 닿아 *정착*한 개체가 확실히 한 개체로 coalesce. 순수·독립·영구.
//
//   design/merge-dna.md §4 M1 — 합치기(0036)는 *순간* 상대속도(vstick)로 판정해, 접촉(0037 반발)이 떼어놓고
//   잔여 진동이 있는 인접 덩어리는 닿아 있어도 coalesce 안 했다(복잡한 알맹이 클러스터로 남음). 이 step 의
//   `coalesceSettled` 는 그 판정을 *지속 정착*(settle 카운터≥dwell)으로 바꿔 — 가라앉아 멈춘 덩어리를 연결 성분
//   통째로 한 개체로 합친다(mergeGroup 재사용·4 보존량 정확·앵커 제외). 0025 활동도(동결)의 개체 병합 판.
//   적정 검증(4 축): ① 새 거동=정착 후 병합+보존 ② 안전=dwell 전/안 정착이면 안 합침 ③ 게이트=안 닿음·앵커 제외
//   ④ dwell≤0 회귀0 ⑤ 결정론. 실행: node HTJ/steps/step_0061/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 개체 descriptor(0056 verify 와 동일 형식).
function ent(cx, cy, cz, mass, px, py, pz, opts) {
  opts = opts || {};
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  const internalE = opts.internalE != null ? opts.internalE : 5;
  return {
    cx, cy, cz, mass, px, py, pz, Lx: opts.Lx || 0, Ly: opts.Ly || 0, Lz: opts.Lz || 0,
    KEcm, internalKE: 0, internalE, energy: KEcm + internalE,
    cells: opts.cells != null ? opts.cells : 100, radius: opts.radius != null ? opts.radius : 1.2, temp: 0, peak: 1,
    anchored: !!opts.anchored
  };
}
const sum = (es, f) => es.reduce((s, e) => s + f(e), 0);
const totMass = (es) => sum(es, e => e.mass);
const totP = (es) => [sum(es, e => e.px), sum(es, e => e.py), sum(es, e => e.pz)];
const totE = (es) => sum(es, e => e.energy);
// 원점 기준 총 각운동량 L = Σ(L_i + r_i×p_i).
function totL(es) {
  let Lx = 0, Ly = 0, Lz = 0;
  for (const e of es) { Lx += (e.Lx || 0) + (e.cy * e.pz - e.cz * e.py); Ly += (e.Ly || 0) + (e.cz * e.px - e.cx * e.pz); Lz += (e.Lz || 0) + (e.cx * e.py - e.cy * e.px); }
  return [Lx, Ly, Lz];
}
const vlen = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// 닿은 사슬(spacing 2 < 2r+pad) — 약간의 스핀/궤도 L 도 실어 원점 L 보존을 비자명하게.
function makeChain(n, vx, internalE) {
  const es = [];
  for (let i = 0; i < n; i++) es.push(ent(i * 2, 0, 0, 100, vx * 100, 0, 0, { internalE: internalE != null ? internalE : 5, Lz: 3 }));
  return es;
}
const opt = { dwell: 3, vSettle: 0.1, vstick: 0.5, pad: 0.5 };

// ── 1. 정착 후 병합 + 보존(질량·운동량·각운동량·총E) ──
{
  let es = makeChain(4, 0);                                    // 4알 정지·닿음
  const m0 = totMass(es), p0 = totP(es), l0 = totL(es), e0 = totE(es);
  let merges = 0;
  for (let s = 0; s < 6; s++) { const r = En.coalesceSettled(es, 1, opt); es = r.entities; merges += r.merges; }
  const coalesced = es.length === 1 && merges === 1;          // 사슬 통째로 한 개체
  const conserved = Math.abs(totMass(es) - m0) < 1e-9 && vlen(totP(es), p0) < 1e-9 && vlen(totL(es), l0) < 1e-9 && Math.abs(totE(es) - e0) < 1e-9;
  check('정착 후 병합 + 보존 — 닿아 멈춘 4알이 dwell 후 한 개체로 coalesce(4 보존량 정확)',
    coalesced && conserved,
    `4알→${es.length}개(merges ${merges}) · 질량 ${m0}=${totMass(es)} · ΔΣP ${vlen(totP(es), p0).toExponential(1)} · ΔΣL(원점) ${vlen(totL(es), l0).toExponential(1)} · ΔΣE ${Math.abs(totE(es) - e0).toExponential(1)}`);
}

// ── 2. 안전 — dwell 전엔 안 합침 · 안 정착(빠름)하면 영영 안 합침 ──
{
  // (a) dwell 전: 정지·닿음이지만 settle<dwell(2 step 만) → 아직 안 합침.
  let es = makeChain(4, 0);
  for (let s = 0; s < 2; s++) es = En.coalesceSettled(es, 1, opt).entities;   // 2 < dwell 3
  const notYet = es.length === 4;
  // (b) 안 정착: 모두 빠르게 이동(|v|=5>vSettle) → settle 늘 0 → 많은 step 도 안 합침.
  let fast = makeChain(4, 5);                                  // px=5*mass → |v|=5
  let fmerges = 0;
  for (let s = 0; s < 12; s++) { const r = En.coalesceSettled(fast, 1, opt); fast = r.entities; fmerges += r.merges; }
  const neverWhileMoving = fast.length === 4 && fmerges === 0;
  check('안전 — dwell 전엔 안 합침 · 안 정착(빠름)하면 안 합침(성급한 병합 방지)',
    notYet && neverWhileMoving,
    `dwell 전 ${es.length}개(미병합) · 빠른 사슬 12 step → ${fast.length}개(merges ${fmerges}=0)`);
}

// ── 3. 게이트 — 안 닿으면 안 합침 · 정적 앵커는 제외(지형 안 합쳐짐) ──
{
  // (a) 떨어진 두 정지 개체(거리 6 > 2r+pad=2.9) → 정착해도 안 합침.
  let sep = [ent(0, 0, 0, 100, 0, 0, 0, {}), ent(6, 0, 0, 100, 0, 0, 0, {})];
  for (let s = 0; s < 6; s++) sep = En.coalesceSettled(sep, 1, opt).entities;
  const noFarMerge = sep.length === 2;
  // (b) 앵커(지형)에 정지 개체가 닿아 있어도 → 앵커 제외라 안 합침(개체도 그대로).
  let anc = [ent(0, 0, 0, 1e6, 0, 0, 0, { radius: 3, anchored: true }), ent(4, 0, 0, 100, 0, 0, 0, { radius: 1.2 })];
  for (let s = 0; s < 6; s++) anc = En.coalesceSettled(anc, 1, opt).entities;
  const anchorExcluded = anc.length === 2 && anc.some(e => e.anchored);
  check('게이트 — 안 닿으면 안 합침 · 정적 앵커(지형)는 병합 제외',
    noFarMerge && anchorExcluded,
    `떨어진 쌍 ${sep.length}개(미병합) · 앵커+개체 ${anc.length}개(앵커 보존·안 흡수)`);
}

// ── 4. dwell≤0 → early-return(회귀 0·세계·settle 카운터 불변) ──
{
  const es = makeChain(4, 0);
  const snap = JSON.stringify(es);
  const r = En.coalesceSettled(es, 1, { dwell: 0, vSettle: 0.1 });
  const unchanged = r.entities.length === 4 && r.merges === 0 && JSON.stringify(es) === snap && es.every(e => e.settle === undefined);
  check('dwell≤0 → early-return(회귀 0) — 세계도 settle 카운터도 안 건드림',
    unchanged, `length ${r.entities.length}·merges ${r.merges}·원본 불변 ${JSON.stringify(es) === snap}·settle 미설정 ${es.every(e => e.settle === undefined)}`);
}

// ── 5. 결정론 — 같은 초기 → 같은 병합 지문 ──
{
  function fp() {
    let es = makeChain(5, 0);
    for (let s = 0; s < 6; s++) es = En.coalesceSettled(es, 1, opt).entities;
    let h = es.length >>> 0;
    for (const e of es) h = (Math.imul(h, 131) + Math.round(e.cx * 1e4) + Math.round(e.mass) + Math.round(e.energy * 1e2)) >>> 0;
    return h >>> 0;
  }
  const a = fp(), b = fp();
  check('결정론 — 같은 정착 사슬 → 같은 병합 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0061 수치 검증: M1 신뢰성 있는 인접 병합 — 정착한 개체가 한 개체로 coalesce ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

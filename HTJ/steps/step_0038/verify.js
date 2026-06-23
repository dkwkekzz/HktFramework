// step_0038/verify.js — SW3 구체 쪼개기(파편화): 임계 넘은 구체가 작은 구체들로. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW3 — 합치기(SW1)의 *거울*: 강한 충돌/외란으로 임계를 넘은 구체가 깨진다.
//   mergeGroup 의 보존 합산을 역으로 — 부모 1 개 → n 조각, 질량·운동량·각운동량(원점)·총E *정확* 보존
//   (Σ조각=부모). 분산(폭발) KE 는 부모 internalE(결합열)에서 꺼냄(merge "잃은 KE→열" 의 역). 임계가 가른다.
//
//   검증 대상:
//     1. 쪼개기 4 보존량 — 질량·운동량·각운동량(원점)·총E 가 쪼갠 전후 정확 보존(1→n).
//     2. 분산 역대칭 — 조각 ΣKEcm = KEcm_parent + dispersalFrac·internalE, Σinternal = (1−df)·internalE(결합열→분산).
//     3. 임계가 가름 — fragmentOnImpact: 빠른 충돌(상대 KE≥임계)→깨짐(N↑)·느린 충돌→안 깨짐(N 그대로).
//     4. 스핀 분배 — 부모 intrinsic 스핀 L 이 조각들에 L/n 씩(ΣL_i=L)·원점 기준 총 L 보존.
//     5. 항등/안전 — n<2·안 닿음·빈/단일·임계 미만 무변화.
//     6. 결정론.
//
//   실행: node HTJ/steps/step_0038/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);

function ent(cx, cy, cz, mass, px, py, pz, opts) {
  opts = opts || {};
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  const internalE = opts.internalE != null ? opts.internalE : 0;
  return {
    cx, cy, cz, mass, px, py, pz, Lx: opts.Lx || 0, Ly: opts.Ly || 0, Lz: opts.Lz || 0,
    KEcm, internalKE: 0, internalE, energy: KEcm + internalE,
    cells: opts.cells != null ? opts.cells : 400, radius: opts.radius != null ? opts.radius : 3, temp: 0, peak: opts.peak || 1
  };
}
const totMass = (es) => es.reduce((s, e) => s + e.mass, 0);
const totP = (es) => es.reduce((a, e) => [a[0] + e.px, a[1] + e.py, a[2] + e.pz], [0, 0, 0]);
const totE = (es) => es.reduce((s, e) => s + e.energy, 0);
const totKE = (es) => es.reduce((s, e) => s + e.KEcm, 0);
const totInt = (es) => es.reduce((s, e) => s + e.internalE, 0);
// 원점 기준 총 각운동량 Σ(L_i + r_i×P_i).
function totL(es) {
  let x = 0, y = 0, z = 0;
  for (const e of es) {
    x += (e.Lx || 0) + (e.cy * e.pz - e.cz * e.py);
    y += (e.Ly || 0) + (e.cz * e.px - e.cx * e.pz);
    z += (e.Lz || 0) + (e.cx * e.py - e.cy * e.px);
  }
  return [x, y, z];
}

// ── 1. 쪼개기 4 보존량 (1→n) ──
{
  // 움직이며 도는 구체(운동량·스핀 보유)를 6 조각으로. 모든 보존량이 정확히 유지돼야.
  const parent = ent(16, 18, 14, 600, 120, -60, 30, { internalE: 200, cells: 480, radius: 3, Lx: 10, Ly: -40, Lz: 25 });
  const frags = En.fragmentEntity(parent, { n: 6, dispersalFrac: 0.5 });
  const m0 = parent.mass, p0 = [parent.px, parent.py, parent.pz], l0 = totL([parent]), e0 = parent.energy;
  const m1 = totMass(frags), p1 = totP(frags), l1 = totL(frags), e1 = totE(frags);
  const ok = frags.length === 6 && relOk(m1, m0) &&
    relOk(p1[0], p0[0]) && relOk(p1[1], p0[1]) && relOk(p1[2], p0[2]) &&
    relOk(l1[0], l0[0], 1e-4) && relOk(l1[1], l0[1], 1e-4) && relOk(l1[2], l0[2], 1e-4) && relOk(e1, e0);
  check('쪼개기 4 보존량 — 질량·운동량·각운동량(원점)·총E 정확 보존(1→6)',
    ok, `N 1→${frags.length} · 질량 ${m0}→${m1} · ΣP [${p0.map(v => v.toFixed(0))}]→[${p1.map(v => v.toFixed(0))}] · L_z ${l0[2].toFixed(1)}→${l1[2].toFixed(1)} · E ${e0}→${e1.toFixed(1)}`);
}

// ── 2. 분산 역대칭 — 결합열 → 조각 분산 KE (merge 의 역) ──
{
  // 정지 구체(KEcm=0) → 분산 KE 는 internalE 에서만. df=0.5 → 절반이 분산, 절반은 조각 열로.
  const parent = ent(16, 16, 16, 400, 0, 0, 0, { internalE: 160, cells: 400, radius: 3 });
  const df = 0.5;
  const frags = En.fragmentEntity(parent, { n: 4, dispersalFrac: df });
  const KE_disp = totKE(frags), int_after = totInt(frags);
  // 기대: ΣKEcm = df·internalE = 80, Σinternal = (1−df)·internalE = 80, 합 = 160 = 부모 E.
  const ok = relOk(KE_disp, df * parent.internalE) && relOk(int_after, (1 - df) * parent.internalE) &&
    relOk(KE_disp + int_after, parent.energy);
  check('분산 역대칭 — 결합열(internalE) → 조각 분산 KE(merge 의 역)·합=부모E',
    ok, `분산 ΣKEcm ${KE_disp.toFixed(1)}(=${(df * parent.internalE).toFixed(1)}) · 잔류 Σinternal ${int_after.toFixed(1)}(=${((1 - df) * parent.internalE).toFixed(1)}) · 합 ${(KE_disp + int_after).toFixed(1)}=E ${parent.energy}`);
}

// ── 3. 임계가 가름 — 빠른 충돌→깸·느린 충돌→안 깸 ──
{
  // 반지름 3 두 구체 접촉(거리 6). 상대 속도 큰 쌍(빠름)→깸, 작은 쌍(느림)→안 깸. μ=50, v=px/m.
  const fast = En.fragmentOnImpact(
    [ent(13, 16, 16, 100, 150, 0, 0, { internalE: 40, cells: 400, radius: 3 }),
     ent(19, 16, 16, 100, -150, 0, 0, { internalE: 40, cells: 400, radius: 3 })],
    { shatterKE: 100, n: 4, dispersalFrac: 0.5 });   // v=±1.5 → 상대 3 → KE=½·50·9=225 ≥ 100 → 깸
  const slow2 = En.fragmentOnImpact(
    [ent(13, 16, 16, 100, 10, 0, 0, { internalE: 40, cells: 400, radius: 3 }),
     ent(19, 16, 16, 100, -10, 0, 0, { internalE: 40, cells: 400, radius: 3 })],
    { shatterKE: 100, n: 4, dispersalFrac: 0.5 });   // v=±0.1 → 상대 0.2 → KE=½·50·0.04=1 < 100 → 안 깸
  // 빠름: 둘 다 깸 → 4+4=8. 느림(상대속도 0.2): 안 깸 → 2. 보존도 확인(빠름).
  const fastMass = relOk(totMass(fast.entities), 200), fastP = relOk(totP(fast.entities)[0], 0);
  check('임계가 가름 — 빠른 충돌→깸(N↑)·느린 충돌→안 깸(N 그대로)·보존',
    fast.entities.length === 8 && slow2.entities.length === 2 && fast.shatters === 2 && fastMass && fastP,
    `빠름 N 2→${fast.entities.length}(깸·shatters ${fast.shatters}) · 느림 N 2→${slow2.entities.length}(안 깸) · 빠름 질량 200·ΣP_x 0 보존`);
}

// ── 4. 스핀 분배 — 부모 intrinsic 스핀이 조각에 L/n 씩 ──
{
  const parent = ent(16, 16, 16, 400, 0, 0, 0, { internalE: 80, cells: 400, radius: 3, Lx: 0, Ly: 0, Lz: 90 });
  const frags = En.fragmentEntity(parent, { n: 5, dispersalFrac: 0.4 });
  const spinSum = frags.reduce((s, e) => s + e.Lz, 0);           // Σ intrinsic L_z = 90
  const each = frags[0].Lz;                                       // 90/5 = 18
  const totalL = totL(frags)[2];                                  // 원점 기준 총 L_z = 90(궤도 0 + intrinsic 90)
  check('스핀 분배 — 부모 스핀 L 이 조각마다 L/n·원점 총 L 보존',
    relOk(spinSum, 90) && relOk(each, 18) && relOk(totalL, 90, 1e-4),
    `조각당 L_z=${each.toFixed(1)}(=18) · Σintrinsic ${spinSum.toFixed(1)}(=90) · 원점 총 L_z ${totalL.toFixed(2)}(=90)`);
}

// ── 5. 항등/안전 — n<2·안 닿음·빈/단일·임계 미만 ──
{
  const n1 = En.fragmentEntity(ent(16, 16, 16, 100, 1, 0, 0, { internalE: 10 }), { n: 1 });   // n<2 → 그대로
  const far = En.fragmentOnImpact(
    [ent(8, 16, 16, 100, 50, 0, 0, { internalE: 40, radius: 3 }), ent(28, 16, 16, 100, -50, 0, 0, { internalE: 40, radius: 3 })],
    { shatterKE: 1, n: 4 });   // 거리 20 > r+r+pad → 안 닿음 → 안 깸(빨라도)
  const empty = En.fragmentOnImpact([], { shatterKE: 1 });
  const single = En.fragmentOnImpact([ent(16, 16, 16, 100, 1, 0, 0, { radius: 3 })], { shatterKE: 1 });
  const sub = En.fragmentOnImpact(
    [ent(13, 16, 16, 100, 5, 0, 0, { internalE: 40, radius: 3 }), ent(19, 16, 16, 100, -5, 0, 0, { internalE: 40, radius: 3 })],
    { shatterKE: 1e9, n: 4 });   // 임계 매우 큼 → 안 깸
  check('항등/안전 — n<2·안 닿음·빈/단일·임계 미만 무변화',
    n1.length === 1 && far.entities.length === 2 && far.shatters === 0 &&
    empty.entities.length === 0 && single.entities.length === 1 && sub.entities.length === 2,
    `n<2 ${n1.length} · 안 닿음 ${far.entities.length}(shatters ${far.shatters}) · 빈/단일 ${empty.entities.length}/${single.entities.length} · 임계미만 ${sub.entities.length}`);
}

// ── 6. 결정론 ──
{
  function fp() {
    const parent = ent(16, 16, 16, 480, 30, -20, 10, { internalE: 120, cells: 360, radius: 3, Lx: 5, Ly: -15, Lz: 40 });
    const frags = En.fragmentEntity(parent, { n: 7, dispersalFrac: 0.5 });
    let h = frags.length;
    for (const e of frags) h = (h * 131 + Math.round(e.cx * 1e3) + Math.round(e.px * 1e2) + Math.round(e.energy * 1e2) + Math.round(e.Lz * 1e2)) >>> 0;
    return h >>> 0;
  }
  check('결정론 — 같은 입력 → 같은 쪼개기 결과 지문', fp() === fp(), `0x${fp().toString(16)}`);
}

console.log('\n=== step_0038 수치 검증: SW3 구체 쪼개기(파편화) — 임계 넘은 구체가 작은 구체들로 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

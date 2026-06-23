// step_0036/verify.js — SW1 구체 합치기(강착): 닿고 느린 개체들이 하나의 큰 개체로. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW1 — 구체 세계의 첫 벽돌. 두 구체가 닿고(CoM 거리 ≤ r_a+r_b+pad) 느리면
//   (상대 속도 ≤ vstick) 하나로 붙는다(강착) — N↓ + 창발 물리(행성 형성). 빠르면 안 붙음(임계가 가름).
//   합산이라 보존이 *정확*: 질량·운동량·각운동량(원점 기준)·총E 불변. 궤도 L→스핀, 잃은 CoM KE→강착열.
//
//   검증 대상:
//     1. 합치기 4 보존량 — 질량·운동량·각운동량(원점)·총E 가 합치기 전후 정확 보존.
//     2. 비탄성 강착열 — 합쳐진 internalE ≥ Σinternal_i(잃은 CoM KE 가 열로)·KEcm 감소.
//     3. 임계 — 느리면 붙고(N 2→1) 빠르면 안 붙음(N 2 그대로). author 안 하고 임계가 가름.
//     4. 궤도 L→스핀 — 접선 운동량으로 닿은 둘이 합치면 궤도 각운동량이 합쳐진 구체의 스핀(L≠0)으로.
//     5. 연결 성분(체인) — 일렬로 닿은 셋이 한 개체로(N 3→1)·보존.
//     6. 안전/항등 — 빈·단일 입력 무변화·안 닿으면 안 합침.
//     7. 결정론.
//
//   실행: node HTJ/steps/step_0036/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b) => Math.abs(a - b) <= 1e-6 + 1e-9 * Math.abs(b);

// 개체 descriptor 생성(promote 산출물 형식). internalE=열, radius 기본 2.
function ent(cx, cy, cz, mass, px, py, pz, opts) {
  opts = opts || {};
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  const internalE = opts.internalE != null ? opts.internalE : 0;
  return {
    cx, cy, cz, mass, px, py, pz, Lx: opts.Lx || 0, Ly: opts.Ly || 0, Lz: opts.Lz || 0,
    KEcm, internalKE: opts.internalKE || 0, internalE, energy: KEcm + internalE,
    cells: opts.cells != null ? opts.cells : 100, radius: opts.radius != null ? opts.radius : 2, temp: 0, peak: opts.peak || 1
  };
}
const totMass = (es) => es.reduce((s, e) => s + e.mass, 0);
const totP = (es) => es.reduce((a, e) => [a[0] + e.px, a[1] + e.py, a[2] + e.pz], [0, 0, 0]);
const totE = (es) => es.reduce((s, e) => s + e.energy, 0);
// 원점 기준 총 각운동량 Σ(L_i + r_i×P_i) — 합치기가 보존해야 하는 양.
function totL(es) {
  let x = 0, y = 0, z = 0;
  for (const e of es) {
    x += (e.Lx || 0) + (e.cy * e.pz - e.cz * e.py);
    y += (e.Ly || 0) + (e.cz * e.px - e.cx * e.pz);
    z += (e.Lz || 0) + (e.cx * e.py - e.cy * e.px);
  }
  return [x, y, z];
}

// ── 1. 합치기 4 보존량 ──
{
  // 두 구체(반지름 2·CoM 거리 4=닿음) 접선 운동량 ±20(상대 속도 0.4 ≤ 0.5=느림 → 붙음).
  const before = [ent(14, 16, 16, 100, 0, 20, 0, { internalE: 50, cells: 120 }),
                  ent(18, 16, 16, 100, 0, -20, 0, { internalE: 50, cells: 120 })];
  const res = En.mergeEntities(before, { vstick: 0.5, pad: 0.5 });
  const m0 = totMass(before), p0 = totP(before), l0 = totL(before), e0 = totE(before);
  const m1 = totMass(res.entities), p1 = totP(res.entities), l1 = totL(res.entities), e1 = totE(res.entities);
  const ok = res.entities.length === 1 && relOk(m1, m0) &&
    relOk(p1[0], p0[0]) && relOk(p1[1], p0[1]) && relOk(p1[2], p0[2]) &&
    relOk(l1[0], l0[0]) && relOk(l1[1], l0[1]) && relOk(l1[2], l0[2]) && relOk(e1, e0);
  check('합치기 4 보존량 — 질량·운동량·각운동량(원점)·총E 정확 보존(2→1)',
    ok, `N 2→${res.entities.length} · 질량 ${m0}→${m1} · L_z ${l0[2].toFixed(1)}→${l1[2].toFixed(1)} · E ${e0}→${e1}`);
}

// ── 2. 비탄성 강착열 — 잃은 CoM KE 가 열로 ──
{
  const a = ent(14, 16, 16, 100, 0, 20, 0, { internalE: 50, cells: 120 });
  const b = ent(18, 16, 16, 100, 0, -20, 0, { internalE: 50, cells: 120 });
  const res = En.mergeEntities([a, b], { vstick: 0.5, pad: 0.5 });
  const c = res.entities[0];
  const sumInt = a.internalE + b.internalE, sumKEcm = a.KEcm + b.KEcm;
  // P 가 상쇄(20+(-20)=0) → KEcm=0 → 상대 운동E 전부 열로.
  const ok = c.internalE >= sumInt - 1e-9 && c.KEcm <= sumKEcm + 1e-9 && relOk(c.internalE, sumInt + (sumKEcm - c.KEcm));
  check('비탄성 강착열 — internalE↑(잃은 CoM KE→열)·KEcm 감소',
    ok, `internalE ${sumInt}→${c.internalE.toFixed(1)}(+${(c.internalE - sumInt).toFixed(1)}) · KEcm ${sumKEcm.toFixed(1)}→${c.KEcm.toFixed(1)}`);
}

// ── 3. 임계 — 느리면 붙고 빠르면 안 붙음 ──
{
  const slow = En.mergeEntities(
    [ent(14, 16, 16, 100, 0, 20, 0, { cells: 120 }), ent(18, 16, 16, 100, 0, -20, 0, { cells: 120 })],
    { vstick: 0.5, pad: 0.5 });   // 상대 속도 0.4 ≤ 0.5 → 붙음
  const fast = En.mergeEntities(
    [ent(14, 16, 16, 100, 0, 100, 0, { cells: 120 }), ent(18, 16, 16, 100, 0, -100, 0, { cells: 120 })],
    { vstick: 0.5, pad: 0.5 });   // 상대 속도 2.0 > 0.5 → 안 붙음
  check('임계 — 느리면 붙고(2→1) 빠르면 안 붙음(2 그대로)',
    slow.entities.length === 1 && fast.entities.length === 2,
    `느림 N→${slow.entities.length}(=1) · 빠름 N→${fast.entities.length}(=2)`);
}

// ── 4. 궤도 L→스핀 ──
{
  // 둘 다 intrinsic L=0, 접선 운동량으로 닿음 → 합치면 궤도 각운동량이 스핀이 된다.
  const before = [ent(14, 16, 16, 100, 0, 20, 0, { cells: 120 }), ent(18, 16, 16, 100, 0, -20, 0, { cells: 120 })];
  const c = En.mergeEntities(before, { vstick: 0.5, pad: 0.5 }).entities[0];
  const spinBefore = before.reduce((s, e) => s + Math.abs(e.Lz), 0);  // 0(intrinsic 없음)
  // 기대: orbital Lz = (-2)(20) + (2)(-20) = -80 → 합쳐진 스핀 Lz ≈ -80.
  check('궤도 L→스핀 — 접선 운동량으로 닿은 둘이 합치면 스핀 창발',
    spinBefore < 1e-9 && relOk(c.Lz, -80),
    `합치기 전 Σ|L_z|=${spinBefore} → 합쳐진 스핀 L_z=${c.Lz.toFixed(1)}(=-80=궤도)`);
}

// ── 5. 연결 성분(체인) — 일렬로 닿은 셋이 하나로 ──
{
  // x=14,18,22 (반지름 2·이웃 거리 4=닿음·14↔22 는 직접 안 닿지만 18 통해 체인), 정지(상대 0) → 한 성분.
  const before = [ent(14, 16, 16, 100, 0, 0, 0, { internalE: 10, cells: 100 }),
                  ent(18, 16, 16, 100, 0, 0, 0, { internalE: 10, cells: 100 }),
                  ent(22, 16, 16, 100, 0, 0, 0, { internalE: 10, cells: 100 })];
  const res = En.mergeEntities(before, { vstick: 0.5, pad: 0.5 });
  const ok = res.entities.length === 1 && relOk(totMass(res.entities), totMass(before)) &&
    relOk(totE(res.entities), totE(before)) && relOk(res.entities[0].cx, 18);
  check('연결 성분(체인) — 일렬로 닿은 셋이 한 개체로(3→1)·보존',
    ok, `N 3→${res.entities.length} · 질량 ${totMass(res.entities)} · CoM_x ${res.entities[0].cx.toFixed(1)}(=18)`);
}

// ── 6. 안전/항등 — 빈·단일·안 닿음 ──
{
  const empty = En.mergeEntities([], {});
  const single = En.mergeEntities([ent(16, 16, 16, 100, 1, 0, 0, { cells: 100 })], {});
  // 멀리 떨어진 둘(거리 20 > r+r+pad) 정지 → 안 합침.
  const far = En.mergeEntities([ent(8, 16, 16, 100, 0, 0, 0, { cells: 100 }), ent(28, 16, 16, 100, 0, 0, 0, { cells: 100 })], { vstick: 10, pad: 0.5 });
  check('안전/항등 — 빈(0)·단일(1)·안 닿음(2) 무변화',
    empty.entities.length === 0 && single.entities.length === 1 && far.entities.length === 2 && far.merges === 0,
    `빈 ${empty.entities.length} · 단일 ${single.entities.length} · 멀리 ${far.entities.length}(merges ${far.merges})`);
}

// ── 7. 결정론 ──
{
  function fp() {
    const es = [];
    for (let k = 0; k < 5; k++) es.push(ent(14 + k, 16, 16, 100, 0, (k % 2 ? -1 : 1) * 10, 0, { internalE: 5, cells: 80 }));
    const r = En.mergeEntities(es, { vstick: 0.5, pad: 0.5 });
    let h = r.entities.length;
    for (const e of r.entities) h = (h * 131 + Math.round(e.cx * 1e4) + Math.round(e.Lz * 1e2) + Math.round(e.energy * 1e2)) >>> 0;
    return h >>> 0;
  }
  check('결정론 — 같은 입력 → 같은 합치기 결과 지문', fp() === fp(), `0x${fp().toString(16)}`);
}

console.log('\n=== step_0036 수치 검증: SW1 구체 합치기(강착) — 닿고 느린 구체가 큰 구체로 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);

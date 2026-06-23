// step_0039/verify.js — SW4 적응 LOD(관찰자 거리 기반 합치기/쪼개기). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW4 / §4 — 0034 격자 LOD 의 *Lagrangian* 판. SW1(mergeGroup·합치기)·
//   SW3(fragmentEntity·쪼개기)의 보존 합산/분배를 *물리 임계* 대신 **거리 임계**로 재사용:
//   먼 구체는 블록당 1 개로 합치고(coarsen·비용↓)·가까운 coarse 구체는 fine 으로 되쪼갠다(refine·디테일↑).
//   비용이 *세계 크기*가 아니라 *관찰되는 디테일*에 묶인다.
//
//   검증 대상:
//     1. coarsen 보존 — 먼 구체를 블록당 1 개로 합쳐도 질량·운동량·각운동량(원점)·총E 정확 보존(N↓).
//     2. refine 보존 — near 의 coarse 구체를 fine 조각으로 되쪼개도 4 보존량 정확(폭발 없이 = 벌크만).
//     3. 왕복 보존 — 같은 무리를 coarsen(멀 때)→refine(관찰자 다가옴)·한 바퀴 후 벌크 정확 보존·fine 복원.
//     4. 비용이 관찰 영역에 묶임 — 먼 구체 밀도를 4× 키워도(세계 키움) effective 개체 수 불변(near + far 블록).
//     5. 항등/안전 — observer 없음/bs≤0 → early-return(회귀 0)·빈/단일·near 단독 그대로.
//     6. 결정론.
//
//   실행: node HTJ/steps/step_0039/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);

// 개체 생성기 — descriptor 자기일관(KEcm·energy).
function ent(cx, cy, cz, mass, px, py, pz, opts) {
  opts = opts || {};
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  const internalE = opts.internalE != null ? opts.internalE : 0;
  return {
    cx, cy, cz, mass, px, py, pz, Lx: opts.Lx || 0, Ly: opts.Ly || 0, Lz: opts.Lz || 0,
    KEcm, internalKE: 0, internalE, energy: KEcm + internalE,
    cells: opts.cells != null ? opts.cells : 8, radius: En.equivalentRadius(opts.cells != null ? opts.cells : 8),
    temp: 0, peak: 1, lodMembers: opts.lodMembers != null ? opts.lodMembers : 1
  };
}

// 벌크 보존량(원점 기준) — 질량·운동량·각운동량(L_intrinsic + r×P)·총E.
function totals(es) {
  let M = 0, Px = 0, Py = 0, Pz = 0, Lx = 0, Ly = 0, Lz = 0, E = 0;
  for (const e of es) {
    M += e.mass; Px += e.px; Py += e.py; Pz += e.pz; E += (e.energy || 0);
    Lx += (e.Lx || 0) + (e.cy * e.pz - e.cz * e.py);
    Ly += (e.Ly || 0) + (e.cz * e.px - e.cx * e.pz);
    Lz += (e.Lz || 0) + (e.cx * e.py - e.cy * e.px);
  }
  return { M, Px, Py, Pz, Lx, Ly, Lz, E };
}
function conserved(a, b, tol) {
  return relOk(a.M, b.M, tol) && relOk(a.Px, b.Px, tol) && relOk(a.Py, b.Py, tol) && relOk(a.Pz, b.Pz, tol)
    && relOk(a.Lx, b.Lx, tol) && relOk(a.Ly, b.Ly, tol) && relOk(a.Lz, b.Lz, tol) && relOk(a.E, b.E, tol);
}

// ── 1. coarsen 보존 — 먼 구체 무리를 블록당 1 개로 합쳐도 벌크 정확 보존(N↓) ──
{
  const obs = [0, 0, 0], bs = 8, nearR = 5;
  // 관찰자서 먼(거리>5) 한 블록(40~46)에 6 개 구체 — 합쳐져 1 개.
  const es = [];
  for (let i = 0; i < 6; i++) es.push(ent(40 + i * 0.8, 41, 41, 10 + i, 3 * (i - 2), -2 * i, i, { internalE: 5 * (i + 1), Lz: 4 * i }));
  const before = totals(es);
  const r = En.adaptLOD(es, { observer: obs, blockSize: bs, nearRadius: nearR });
  const after = totals(r.entities);
  check('coarsen 보존 — 먼 무리를 블록당 1 개로 합쳐도 4 보존량 정확(N↓)',
    r.entities.length === 1 && r.coarsened === 1 && conserved(before, after, 1e-6),
    `N 6→${r.entities.length}(coarsened ${r.coarsened}) · 질량 ${before.M}→${after.M.toFixed(1)} · ΣP_x ${before.Px.toFixed(1)}→${after.Px.toFixed(1)} · L_z ${before.Lz.toFixed(1)}→${after.Lz.toFixed(1)} · E ${before.E.toFixed(2)}→${after.E.toFixed(2)} · lodMembers ${r.entities[0].lodMembers}`);
}

// ── 2. refine 보존 — near 의 coarse 구체를 fine 으로 되쪼개도 벌크 정확(폭발 없이) ──
{
  const obs = [0, 0, 0], bs = 8, nearR = 10;
  // 관찰자 가까이(거리<10) coarse 구체 1 개(lodMembers=5)·스핀·결합열 보유 → fine 5 개로.
  const coarse = ent(2, 1, 0, 50, 12, -8, 4, { internalE: 80, Lz: 30, cells: 40, lodMembers: 5 });
  const before = totals([coarse]);
  const r = En.adaptLOD([coarse], { observer: obs, blockSize: bs, nearRadius: nearR });
  const after = totals(r.entities);
  const allFine = r.entities.every(e => (e.lodMembers || 1) === 1);
  check('refine 보존 — near coarse 구체를 fine 조각으로 되쪼개도 4 보존량 정확(폭발 없이)',
    r.entities.length === 5 && r.refined === 1 && allFine && conserved(before, after, 1e-6),
    `N 1→${r.entities.length}(refined ${r.refined}) · 질량 ${before.M}→${after.M.toFixed(1)} · ΣP ${before.Px.toFixed(1)}→${after.Px.toFixed(1)} · L_z ${before.Lz.toFixed(2)}→${after.Lz.toFixed(2)} · E ${before.E.toFixed(1)}→${after.E.toFixed(1)} · 모두 fine ${allFine}`);
}

// ── 3. 왕복 보존 — 멀 때 coarsen → 관찰자 다가오면 refine·한 바퀴 후 벌크 정확·fine 복원 ──
{
  const bs = 8, nearR = 6;
  // 한 블록(48~52)에 4 개 구체. ① 관찰자 멀리([0,0,0]) → coarsen(1 개). ② 관찰자 그 블록 중심으로 → refine(4 개).
  const es = [];
  for (let i = 0; i < 4; i++) es.push(ent(48 + i, 49, 50, 12 + i, 2 * (i - 1), 3 * i, -i, { internalE: 6 * (i + 1), Lz: 5 * i }));
  const before = totals(es);
  const far = En.adaptLOD(es, { observer: [0, 0, 0], blockSize: bs, nearRadius: nearR });
  const coarse = totals(far.entities);
  const near = En.adaptLOD(far.entities, { observer: [50, 50, 50], blockSize: bs, nearRadius: nearR });
  const after = totals(near.entities);
  check('왕복 보존 — coarsen(멀 때)→refine(다가옴)·한 바퀴 후 벌크 정확·fine 복원',
    far.entities.length === 1 && near.entities.length === 4
    && conserved(before, coarse, 1e-6) && conserved(before, after, 1e-6),
    `N 4→coarsen 1→refine ${near.entities.length} · 질량 ${before.M}→${after.M.toFixed(1)} · ΣP_x ${before.Px.toFixed(1)}→${after.Px.toFixed(1)} · L_z ${before.Lz.toFixed(1)}→${after.Lz.toFixed(1)} · E ${before.E.toFixed(2)}→${after.E.toFixed(2)}(coarse 단계 E ${coarse.E.toFixed(2)})`);
}

// ── 4. 비용이 관찰 영역에 묶임 — 먼 구체 밀도 4× 키워도 effective 개체 수 불변 ──
{
  const obs = [0, 0, 0], bs = 8, nearR = 6;
  // near 구체 3 개(거리<6) 고정. far = 같은 부피(블록 2 개)에 density 만큼 구체.
  function scene(density) {
    const es = [];
    for (let i = 0; i < 3; i++) es.push(ent(1 + i, 0, 0, 10, i, -i, 0, { internalE: 3 }));   // near(그대로)
    // far 블록 A(중심 ~(44,4,4))·B(중심 ~(4,44,4)) 에 density 개씩.
    for (let b = 0; b < 2; b++) for (let i = 0; i < density; i++) {
      const cx = b === 0 ? 40 + (i % 7) : 1 + (i % 7);
      const cy = b === 0 ? 1 + (i % 7) : 40 + (i % 7);
      es.push(ent(cx, cy, 1 + (i % 7), 5, i, 2 * i, -i, { internalE: 2 }));
    }
    return es;
  }
  const r1 = En.adaptLOD(scene(8), { observer: obs, blockSize: bs, nearRadius: nearR });
  const r4 = En.adaptLOD(scene(32), { observer: obs, blockSize: bs, nearRadius: nearR });
  const raw1 = 3 + 2 * 8, raw4 = 3 + 2 * 32;
  // effective(=결과 개체 수)는 near(3) + occupied far 블록 수(밀도 무관) → density 와 무관하게 동일.
  check('비용이 관찰 영역에 묶임 — 먼 구체 밀도 4× 키워도 effective 개체 수 불변(세계 크기 분리)',
    r1.entities.length === r4.entities.length && r4.entities.length < raw4 && r1.entities.length <= 3 + 2,
    `raw ${raw1}→effective ${r1.entities.length} · raw ${raw4}→effective ${r4.entities.length}(불변·near 3 + far 블록) · 4× 원시 ${raw4} 인데 비용 ${r4.entities.length}`);
}

// ── 5. 항등/안전 — observer 없음·bs≤0 → early-return·빈/단일·near 단독 그대로 ──
{
  const es = [ent(40, 40, 40, 10, 1, 0, 0, { internalE: 5 }), ent(41, 40, 40, 10, 0, 1, 0, { internalE: 5 })];
  const noObs = En.adaptLOD(es, { blockSize: 8, nearRadius: 5 });                        // observer 없음
  const noBs = En.adaptLOD(es, { observer: [0, 0, 0], blockSize: 0, nearRadius: 5 });    // bs≤0
  const empty = En.adaptLOD([], { observer: [0, 0, 0], blockSize: 8, nearRadius: 5 });
  const single = En.adaptLOD([es[0]], { observer: [0, 0, 0], blockSize: 8, nearRadius: 5 });
  // near 단독(거리<near·lodMembers=1) → 그대로(refine 안 함).
  const nearSolo = En.adaptLOD([ent(1, 0, 0, 10, 1, 0, 0, { internalE: 5 })], { observer: [0, 0, 0], blockSize: 8, nearRadius: 5 });
  check('항등/안전 — observer 없음·bs≤0→early-return·빈/단일·near 단독 무변화',
    noObs.entities.length === 2 && noObs.coarsened === 0 && noBs.entities.length === 2
    && empty.entities.length === 0 && single.entities.length === 1
    && nearSolo.entities.length === 1 && nearSolo.refined === 0,
    `noObs N ${noObs.entities.length}(coarsened ${noObs.coarsened}) · noBs N ${noBs.entities.length} · empty ${empty.entities.length} · single ${single.entities.length} · near단독 ${nearSolo.entities.length}(refined ${nearSolo.refined})`);
}

// ── 6. 결정론 — 같은 입력 → 같은 LOD 결과 지문 ──
{
  function fnv(es) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const e of es) { push(e.cx); push(e.cy); push(e.cz); push(e.mass); push(e.px); push(e.py); push(e.pz); push(e.Lz); push(e.energy); push(e.lodMembers || 1); }
    return h >>> 0;
  }
  function scene() {
    const es = [];
    for (let i = 0; i < 5; i++) es.push(ent(40 + i, 41, 42, 8 + i, i, -i, 2 * i, { internalE: 4 * i, Lz: 3 * i }));  // far 블록(합쳐짐)
    es.push(ent(2, 1, 0, 30, 5, -3, 1, { internalE: 20, Lz: 12, lodMembers: 3, cells: 24 }));                       // near coarse(쪼개짐)
    return es;
  }
  const o = { observer: [0, 0, 0], blockSize: 8, nearRadius: 6 };
  const a = fnv(En.adaptLOD(scene(), o).entities);
  const b = fnv(En.adaptLOD(scene(), o).entities);
  check('결정론 — 같은 입력 → 같은 적응 LOD 결과 지문', a === b, `0x${a.toString(16)}`);
}

// ── 결과 출력 ──
let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW4 적응 LOD: 멀면 합치고 가까이서 쪼갠다·벌크 정확·비용이 관찰 영역에 묶임' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);

// step_0072/verify.js — adaptLOD coarsen DNA 태깅(재coarsen 형태 보존) 검증. 순수·독립.
//   새 거동 = adaptLOD coarsen 이 opts.tagDNA 훅으로 합친 블롭에 shapeHash 부착 → 재coarsen 해도 DNA 보존 →
//   다음 refine(0071)이 평면 고리 아닌 *원래 형태*. 0071 의 짝(refine 은 형태 복원·coarsen 은 형태 기억).
//   부품 보존은 부품 verify 가 보증 → 여기선 새 거동·왕복 형태 보존·dedup·통합 보존·항등만.
//   실행: node HTJ/steps/step_0072/verify.js
'use strict';
const path = require('path');
const E = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const D = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const ROPT = { quantum: 0.25, spread: 2.0 };
// 멀리(원점서 먼) 같은 블록 안에 모인 fine DNA 형태 조각들(z 기복) — coarsen 대상.
function farPieces() {
  const SHAPE = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [0, 2, 1], [2, 2, 1]], k = 3;
  return SHAPE.map(q => ({ cx: 300 + q[0] * k, cy: 300 + q[1] * k, cz: 150 + q[2] * k, mass: 5, px: 1, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 4, cells: 5, energy: 4 + 0.5 * 1 * 1 / 5, lodMembers: 1 }));
}
const OBS = [0, 0, 0], BASE = { observer: OBS, blockSize: 200, nearRadius: 50, spread: 1 };
function totals(list) {
  let M = 0, Px = 0, Py = 0, Pz = 0, Lx = 0, Ly = 0, Lz = 0, Eg = 0;
  for (const e of list) { M += e.mass; Px += e.px; Py += e.py; Pz += e.pz; Eg += e.energy; Lx += (e.Lx || 0) + (e.cy * e.pz - e.cz * e.py); Ly += (e.Ly || 0) + (e.cz * e.px - e.cx * e.pz); Lz += (e.Lz || 0) + (e.cx * e.py - e.cy * e.px); }
  return { M, Pmag: Math.hypot(Px, Py, Pz), Lmag: Math.hypot(Lx, Ly, Lz), Eg };
}

// ① 새 거동 — coarsen 이 DNA 태깅 + 왕복 형태 보존: 합친 블롭에 shapeHash 부착 → refine 하면 원래 DNA 형태(z 기복)
//    복원·rehash 가 태그와 동일(형태가 cycle 을 살아남음). 훅 없으면 shapeHash 없음(다음 refine=평면 고리).
(() => {
  const dict = {};
  const tag = E.adaptLOD(farPieces(), Object.assign({}, BASE, { tagDNA: (mem) => D.registerShape(dict, mem) }));
  const blob = tag.entities.find(e => e.lodMembers > 1);
  const noTag = E.adaptLOD(farPieces(), BASE).entities.find(e => e.lodMembers > 1);
  const refined = blob && blob.shapeHash ? D.refineByDNA(blob, dict, ROPT) : null;
  const rehash = refined ? D.shapeDNA(refined.map(p => ({ cx: p.cx, cy: p.cy, cz: p.cz }))).hash : null;
  const zs = refined ? (Math.max(...refined.map(p => p.cz)) - Math.min(...refined.map(p => p.cz))) : 0;
  ok(blob && typeof blob.shapeHash === 'string' && !noTag.shapeHash && refined && refined.length === 6 && rehash === blob.shapeHash && zs > 0.5,
    `coarsen DNA 태깅+왕복 — 블롭 shapeHash ${blob && blob.shapeHash}(훅 없으면 ${noTag && noTag.shapeHash}) · refine→${refined && refined.length}조각·rehash ${rehash}==태그 ${rehash === (blob && blob.shapeHash)}·z기복 ${zs.toFixed(2)}(평면 아님)`);
})();

// ② dedup 안정(K 불변) — coarsen→refine→재coarsen 한 바퀴 돌아도 같은 형태는 사전 1항목(K 불변·확장성).
(() => {
  const dict = {};
  const tagOpt = { tagDNA: (mem) => D.registerShape(dict, mem) };
  const r1 = E.adaptLOD(farPieces(), Object.assign({}, BASE, tagOpt));
  const blob = r1.entities.find(e => e.lodMembers > 1);
  const refined = D.refineByDNA(blob, dict, ROPT);                      // near refine
  // 되쪼갠 조각을 다시 멀리 같은 블록에 두고 재coarsen → 같은 형태 → 같은 hash → dict 안 자람.
  const again = refined.map(p => Object.assign({}, p, { cx: p.cx + 300, cy: p.cy + 300 }));
  E.adaptLOD(again, Object.assign({}, BASE, tagOpt, { blockSize: 400 }));
  ok(Object.keys(dict).length === 1, `dedup 안정 — coarsen→refine→재coarsen 후 사전 K=${Object.keys(dict).length}(같은 형태=1항목·확장성)`);
})();

// ③ 보존(통합) — coarsen+태깅 전체가 질량·운동량·각운동량(원점)·총E 정확(태깅은 메타데이터·물리 불변).
(() => {
  const dict = {};
  const before = totals(farPieces());
  const after = totals(E.adaptLOD(farPieces(), Object.assign({}, BASE, { tagDNA: (mem) => D.registerShape(dict, mem) })).entities);
  show(L.conserved('질량(통합)', before.M, after.M, 1e-9));
  show(L.conserved('운동량 |P|(통합)', before.Pmag, after.Pmag, 1e-9));
  show(L.conserved('각운동량 |L|(원점·통합)', before.Lmag, after.Lmag, 1e-9));
  show(L.conserved('총E(통합)', before.Eg, after.Eg, 1e-9));
})();

// ④ 항등(노브=0→회귀 0) — tagDNA 훅 없으면 합친 블롭의 *물리*는 동일하고 shapeHash 만 안 붙음(태깅=순수 메타).
(() => {
  const withTag = E.adaptLOD(farPieces(), Object.assign({}, BASE, { tagDNA: () => 'tag' })).entities.find(e => e.lodMembers > 1);
  const noTag = E.adaptLOD(farPieces(), BASE).entities.find(e => e.lodMembers > 1);
  const strip = (e) => { const c = Object.assign({}, e); delete c.shapeHash; return c; };
  show(L.identity('태깅 제거 시 물리 byte 동일(shapeHash 만 메타)', JSON.stringify(strip(noTag)), JSON.stringify(strip(withTag))));
})();

// ⑤ 결정론(공용 가드).
show(L.deterministic('같은 세계·훅 → 같은 coarsen+태깅', () => { const dict = {}; return E.adaptLOD(farPieces(), Object.assign({}, BASE, { tagDNA: (mem) => D.registerShape(dict, mem) })).entities.map(e => `${e.cx.toFixed(4)},${e.mass},${e.shapeHash || '-'}`); }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

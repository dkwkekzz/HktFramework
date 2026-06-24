// step_0070/verify.js — M4 DNA 물리 footprint 되쪼갬 검증. 순수·독립.
//   새 거동 = 합친 개체를 *평면 고리*(0039 한계) 아닌 *원래 DNA 형태* 위치로 되쪼개되 4 보존량 정확 보존
//   = "렌더 LOD(0069)↔물리 LOD 합류"(merge-dna §4 M4). 보존·결정론은 tools/htj-verify-lib.js 공용 가드.
//   실행: node HTJ/steps/step_0070/verify.js
'use strict';
const path = require('path');
const D = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const E = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// 시험용 — L 자 3D 형태(z 기복 있음)를 등록하고, 그 hash 를 단 합친 개체(부모) 하나.
const SHAPE = [{ cx: 0, cy: 0, cz: 0 }, { cx: 1, cy: 0, cz: 0 }, { cx: 2, cy: 0, cz: 0 }, { cx: 0, cy: 1, cz: 0 }, { cx: 0, cy: 2, cz: 1 }, { cx: 0, cy: 0, cz: 2 }];
const DICT = {}, HASH = D.registerShape(DICT, SHAPE);
const ROPT = { quantum: 0.25, spread: 2.0 };
function parent() {
  const p = { cx: 30, cy: 18, cz: 25, radius: 3, mass: 40, px: 12, py: -6, pz: 4, Lx: 5, Ly: -2, Lz: 9, internalE: 50, cells: 40, shapeHash: HASH };
  p.KEcm = 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / p.mass; p.energy = p.KEcm + p.internalE; return p;
}
// 원점 기준 총량(질량·운동량·각운동량·총E) — 개체 목록 → 합.
function totals(list) {
  let M = 0, Px = 0, Py = 0, Pz = 0, Lx = 0, Ly = 0, Lz = 0, Eg = 0;
  for (const e of list) {
    M += e.mass; Px += e.px; Py += e.py; Pz += e.pz; Eg += e.energy;
    Lx += (e.Lx || 0); Ly += (e.Ly || 0); Lz += (e.Lz || 0);
    Lx += e.cy * e.pz - e.cz * e.py; Ly += e.cz * e.px - e.cx * e.pz; Lz += e.cx * e.py - e.cy * e.px;  // 궤도 r×p(원점)
  }
  return { M, Px, Py, Pz, Lx, Ly, Lz, Eg, Pmag: Math.hypot(Px, Py, Pz), Lmag: Math.hypot(Lx, Ly, Lz) };
}
// 무게중심 0 으로 옮긴 상대 좌표(형태 비교용).
function centered(list) { let cx = 0, cy = 0, cz = 0; for (const p of list) { cx += p.cx; cy += p.cy; cz += p.cz; } const n = list.length; cx /= n; cy /= n; cz /= n; return list.map(p => [p.cx - cx, p.cy - cy, p.cz - cz]); }

// ① DNA 형태 충실 (새 거동) — 물리 조각이 *렌더(reconstructShape 0063)가 그리는 바로 그 DNA 형태*를 차지한다
//    (평면 고리 아님). reconstructShape 와 무게중심 정렬 시 위치 정확 일치 · 대조: fragmentEntity 평면 고리는 z 기복 소실.
(() => {
  const par = parent();
  const mem = D.refineByDNA(par, DICT, ROPT);
  const rec = D.reconstructShape(par, DICT, ROPT);            // 같은 사전·hash·배율 = 렌더 형태
  const cm = centered(mem), cr = centered(rec);
  let dnaDiff = 0; for (let i = 0; i < cm.length; i++) dnaDiff = Math.max(dnaDiff, Math.abs(cm[i][0] - cr[i][0]), Math.abs(cm[i][1] - cr[i][1]), Math.abs(cm[i][2] - cr[i][2]));
  const ring = E.fragmentEntity(par, { n: mem.length, dispersalFrac: 0 });   // 0039 평면 고리(z=0)
  const cg = centered(ring); let ringZ = 0; for (let i = 0; i < cg.length; i++) ringZ = Math.max(ringZ, Math.abs(cg[i][2]));
  const dnaZ = Math.max(...cr.map(p => Math.abs(p[2])));
  ok(mem.length === SHAPE.length && dnaDiff < 1e-9 && ringZ < 1e-9 && dnaZ > 0.5,
    `DNA 형태 충실 — 물리 조각 ${mem.length}개가 렌더 형태와 정확 일치(무게중심 정렬 max 차 ${dnaDiff.toExponential(1)}) · DNA z기복 ${dnaZ.toFixed(2)} vs 평면 고리 z ${ringZ.toExponential(1)}(고리는 모양 소실)`);
})();

// ②③④⑤ 보존 (공용 가드) — 질량·운동량·각운동량(원점)·총E 정확(부모 = Σ조각).
(() => {
  const a = totals([parent()]), b = totals(D.refineByDNA(parent(), DICT, ROPT));
  show(L.conserved('질량', a.M, b.M));
  show(L.conserved('운동량 |P|', a.Pmag, b.Pmag, 1e-9));
  show(L.conserved('각운동량 |L|(원점·궤도+스핀)', a.Lmag, b.Lmag, 1e-9));
  show(L.conserved('총E', a.Eg, b.Eg, 1e-9));
})();

// ⑥ 항등(노브=0→회귀 0) — shapeHash 없음/사전에 없음/n<2 → null(호출자: fragmentEntity 평면 고리 폴백=0039 불변).
(() => {
  const noHash = D.refineByDNA({ cx: 0, cy: 0, cz: 0, radius: 1, mass: 1 }, DICT, ROPT);
  const noDict = D.refineByDNA(parent(), null, ROPT);
  const unknown = D.refineByDNA({ cx: 0, cy: 0, cz: 0, radius: 1, mass: 1, shapeHash: 'deadbeef' }, DICT, ROPT);
  show(L.identity('DNA 없음 → null(0039 평면 고리 폴백·회귀 0)', [null, null, null], [noHash, noDict, unknown]));
})();

// ⑦ 결정론(공용 가드) — 같은 개체·사전 → 같은 되쪼갬.
show(L.deterministic('같은 개체·사전 → 같은 물리 되쪼갬', () => D.refineByDNA(parent(), DICT, ROPT).map(e => `${e.cx.toFixed(6)},${e.cy.toFixed(6)},${e.cz.toFixed(6)},${e.mass},${e.energy.toFixed(6)}`)));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

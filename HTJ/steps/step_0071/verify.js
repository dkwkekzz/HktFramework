// step_0071/verify.js — adaptLOD ↔ refineByDNA 배선(통합) 검증. 순수·독립.
//   새 상호작용 = LOD 루프(adaptLOD·0039)의 near refine 이 DNA(shapeHash) 든 개체를 *원래 형태* 물리 조각으로
//   되쪼갬(refineByDNA·0070) = 렌더 LOD↔물리 LOD 합류가 실제 LOD 파이프라인에. 부품 보존은 부품 verify 가
//   이미 보증 → 여기선 *통합* 보존(합쳐서도)·새 상호작용·항등(훅 없음→0039)만. 실행: node HTJ/steps/step_0071/verify.js
'use strict';
const path = require('path');
const E = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const D = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// L 자 3D 형태(z 기복) 등록 → 합친 DNA 개체들.
const SHAPE = [{ cx: 0, cy: 0, cz: 0 }, { cx: 1, cy: 0, cz: 0 }, { cx: 2, cy: 0, cz: 0 }, { cx: 0, cy: 1, cz: 0 }, { cx: 0, cy: 2, cz: 1 }, { cx: 2, cy: 2, cz: 1 }];
const DICT = {}, HASH = D.registerShape(DICT, SHAPE);
const ROPT = { quantum: 0.25, spread: 2.0 };
function coarse(cx, cy, cz, withHash) {
  const e = { cx, cy, cz, radius: 3, mass: 30, px: 6, py: -3, pz: 2, Lx: 1, Ly: 2, Lz: -1, internalE: 24, cells: 30, lodMembers: SHAPE.length };
  if (withHash) e.shapeHash = HASH;
  e.KEcm = 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass; e.energy = e.KEcm + e.internalE; return e;
}
// world: near coarse DNA 개체(관찰자 곁) + far 개체(딴 블록·그대로). observer=원점.
function world() { return [coarse(2, 1, 0, true), coarse(200, 0, 0, true)]; }
const OBS = [0, 0, 0], OPTS_BASE = { observer: OBS, blockSize: 64, nearRadius: 40, spread: 1 };
const HOOK = (e) => D.refineByDNA(e, DICT, ROPT);
function totals(list) {
  let M = 0, Px = 0, Py = 0, Pz = 0, Lx = 0, Ly = 0, Lz = 0, Eg = 0;
  for (const e of list) { M += e.mass; Px += e.px; Py += e.py; Pz += e.pz; Eg += e.energy; Lx += (e.Lx || 0) + (e.cy * e.pz - e.cz * e.py); Ly += (e.Ly || 0) + (e.cz * e.px - e.cx * e.pz); Lz += (e.Lz || 0) + (e.cx * e.py - e.cy * e.px); }
  return { M, Pmag: Math.hypot(Px, Py, Pz), Lmag: Math.hypot(Lx, Ly, Lz), Eg };
}
function centered(list) { let cx = 0, cy = 0, cz = 0; for (const p of list) { cx += p.cx; cy += p.cy; cz += p.cz; } const n = list.length; cx /= n; cy /= n; cz /= n; return list.map(p => [p.cx - cx, p.cy - cy, p.cz - cz]); }

// ① 새 상호작용 — adaptLOD 의 near refine 이 DNA 형태 조각으로(평면 고리 아님). 훅 켜면 near 개체가
//    SHAPE.length 조각·z 기복 보존 = reconstructShape 형태와 정렬 일치. 훅 끄면 평면 고리(z=0).
(() => {
  const withHook = E.adaptLOD(world(), Object.assign({}, OPTS_BASE, { refineDNA: HOOK }));
  const noHook = E.adaptLOD(world(), OPTS_BASE);
  // near(원점 곁) 조각만 추출.
  const nearPieces = withHook.entities.filter(e => Math.hypot(e.cx, e.cy, e.cz) < 40);
  const rec = D.reconstructShape(coarse(2, 1, 0, true), DICT, ROPT);
  const cm = centered(nearPieces), cr = centered(rec);
  let dnaDiff = 0; for (let i = 0; i < Math.min(cm.length, cr.length); i++) dnaDiff = Math.max(dnaDiff, Math.abs(cm[i][0] - cr[i][0]), Math.abs(cm[i][1] - cr[i][1]), Math.abs(cm[i][2] - cr[i][2]));
  const ringPieces = noHook.entities.filter(e => Math.hypot(e.cx, e.cy, e.cz) < 40);
  let ringZ = 0; for (const p of centered(ringPieces)) ringZ = Math.max(ringZ, Math.abs(p[2]));
  const dnaZ = Math.max(...cr.map(p => Math.abs(p[2])));
  ok(nearPieces.length === SHAPE.length && dnaDiff < 1e-9 && ringZ < 1e-9 && dnaZ > 0.5,
    `새 상호작용 — adaptLOD near refine 이 DNA 형태 ${nearPieces.length}조각(렌더 형태와 정렬 max 차 ${dnaDiff.toExponential(1)}·z기복 ${dnaZ.toFixed(2)}) vs 훅 끄면 평면 고리 z ${ringZ.toExponential(1)}`);
})();

// ② 합쳐서도 보존(통합) — adaptLOD(coarsen far + DNA refine near) 전체가 질량·운동량·각운동량(원점)·총E 정확 보존.
(() => {
  const before = totals(world());
  const after = totals(E.adaptLOD(world(), Object.assign({}, OPTS_BASE, { refineDNA: HOOK })).entities);
  show(L.conserved('질량(통합)', before.M, after.M, 1e-9));
  show(L.conserved('운동량 |P|(통합)', before.Pmag, after.Pmag, 1e-9));
  show(L.conserved('각운동량 |L|(원점·통합)', before.Lmag, after.Lmag, 1e-9));
  show(L.conserved('총E(통합)', before.Eg, after.Eg, 1e-9));
})();

// ③ 항등(훅 없음→0039 회귀 0) — opts.refineDNA 미지정이면 refine 이 fragmentEntity 평면 고리(0039)와 byte 동일.
(() => {
  const noHook = E.adaptLOD(world(), OPTS_BASE).entities;
  const near = coarse(2, 1, 0, true);
  const ring = E.fragmentEntity(near, { n: near.lodMembers, dispersalFrac: 0, spread: OPTS_BASE.spread }).map(f => (f.lodMembers = 1, f));
  const got = noHook.filter(e => Math.hypot(e.cx, e.cy, e.cz) < 40);
  show(L.identity('훅 없음 → adaptLOD refine = fragmentEntity 평면 고리(0039)', JSON.stringify(ring), JSON.stringify(got)));
})();

// ④ 결정론(공용 가드).
show(L.deterministic('같은 세계·관찰자·훅 → 같은 LOD 결과', () => E.adaptLOD(world(), Object.assign({}, OPTS_BASE, { refineDNA: HOOK })).entities.map(e => `${e.cx.toFixed(6)},${e.cy.toFixed(6)},${e.cz.toFixed(6)},${e.mass},${e.energy.toFixed(6)}`)));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

// step_0083/verify.js — (조립) 법칙만으로 지형과 바다: 노이즈 지형 위로 SPH 물이 분지에 고여 수면을 찾는다.
//   조립 step → engine 변경 0(기존 법칙: 노이즈 높이장 + sphPressureForce/Viscosity/BoundaryForce + 중력 + stepEntities).
//   부품 보존·물리는 0041/0046/0060 verify 가 이미 보증 → 여기선 *합쳐서 생긴 창발*만:
//     ① 바다는 분지에 고인다(물이 낮은 지형으로) ② 수면이 평평하다(물이 제 높이를 찾는다=바다)
//     ③ 땅·바다 공존(봉우리=땅이 수면 위로·분지=바다) ④ 보존(물 질량) ⑤ 결정론.
//   지형은 *노이즈 법칙*(value-noise fBm·author 없음)으로 깔고, 바다는 *중력+경계 접촉*으로 고인다 — 둘 다 법칙만으로.
//   순수·독립·영구. 실행: node HTJ/steps/step_0083/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// ── 지형 = 노이즈 법칙(value-noise fBm) — author 없이 봉우리·계곡이 창발 (0074 fieldNoise 법칙 가족) ──
function lattice(i) { let h = (Math.imul((i ^ 0x9e3779b9) >>> 0, 2654435761)) >>> 0; return (h & 0xffff) / 0xffff; }
function vnoise(x) { const xi = Math.floor(x), xf = x - xi, u = xf * xf * (3 - 2 * xf); return lattice(xi) * (1 - u) + lattice(xi + 1) * u; }
function fbm(x) { let s = 0, a = 1, f = 1, n = 0; for (let o = 0; o < 4; o++) { s += a * vnoise(x * f); n += a; a *= 0.5; f *= 2; } return s / n; }
const AMP = 22, SCALE = 0.6, X0 = -50, X1 = 50;
const terrainTop = (x) => AMP * fbm(x * SCALE);

// 지형 바닥 = 작은 앵커 구를 촘촘히 깔아 bumpy 상부 envelope ≈ terrainTop + 양옆 벽(그릇)
function buildAnchors() {
  const R = 7, DX = 2, an = [];
  for (let x = X0; x <= X1 + 1e-9; x += DX) an.push({ cx: x, cy: 0, cz: terrainTop(x) - R, radius: R });
  for (let z = 0; z <= 40; z += 3) { an.push({ cx: X0 - 2, cy: 0, cz: z, radius: 6 }); an.push({ cx: X1 + 2, cy: 0, cz: z, radius: 6 }); }
  return an;
}
function wp(cx, cz) { return { cx, cy: 0, cz, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 }; }
const G = 4, DT = 0.02;
const popt = { stiffness: 80, h: 2.2, gamma: 2 }, vopt = { alpha: 2, beta: 2, h: 2.2, gamma: 2 }, bopt = { stiffness: 200, damp: 40, skin: 0.6 };

// 균일 살포한 물을 settle 시킨다(지형 무관 살포 → 법칙이 분지로 모은다).
function settle(steps) {
  const an = buildAnchors(), water = [];
  let seed = 11; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let x = X0 + 5; x <= X1 - 5; x += 3.2) for (let k = 0; k < 2; k++) water.push(wp(x + (rnd() - 0.5) * 1.2, 30 + k * 2.2));
  for (let s = 0; s < steps; s++) {
    Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt);
    for (const p of water) p.pz -= p.mass * G * DT;
    Sph.sphBoundaryForce(water, an, DT, bopt);
    En.stepEntities(water, DT);
  }
  return water;
}

// x 컬럼별 지형 높이 · 물 질량 · 수면(최상단 물) 측정
function columns(water) {
  const NB = 25, dx = (X1 - X0) / NB;
  const wmass = new Array(NB).fill(0), wtop = new Array(NB).fill(-Infinity), tcol = new Array(NB).fill(0);
  for (let b = 0; b < NB; b++) tcol[b] = terrainTop(X0 + (b + 0.5) * dx);
  for (const p of water) { const b = Math.min(NB - 1, Math.max(0, Math.floor((p.cx - X0) / dx))); wmass[b] += p.mass; if (p.cz > wtop[b]) wtop[b] = p.cz; }
  const wet = [], dry = []; for (let b = 0; b < NB; b++) (wmass[b] > 2 ? wet : dry).push(b);
  return { NB, wmass, wtop, tcol, wet, dry };
}
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };

const water = settle(6000);
const C = columns(water);
const N0 = water.length;

// ① 바다는 분지에 고인다 — 물 찬 컬럼의 지형이 마른 컬럼보다 *낮다*(낮은 곳으로 흐른다).
(() => {
  const tWet = mean(C.wet.map(b => C.tcol[b])), tDry = mean(C.dry.map(b => C.tcol[b]));
  ok(tWet < tDry - 1.0, `바다는 분지에 — 물 찬 컬럼 지형 ${tWet.toFixed(2)} < 마른 컬럼 ${tDry.toFixed(2)}(중력이 물을 낮은 곳으로)`);
})();

// ② 수면이 평평하다 — 정착한 물 표면 높이 산포 ≪ 지형 산포(물이 제 높이를 찾는다 = 바다의 표식).
(() => {
  const surfStd = std(C.wet.map(b => C.wtop[b])), terrStd = std(C.tcol);
  ok(surfStd < 0.4 * terrStd, `수면 평평(제 높이 찾기) — 수면 산포 ${surfStd.toFixed(2)} < 0.4×지형 산포 ${(0.4 * terrStd).toFixed(2)}(지형 ${terrStd.toFixed(2)})`);
})();

// ③ 땅·바다 공존 — 물 찬 컬럼(바다)·마른 컬럼(땅) 둘 다 충분 + 봉우리가 수면 위로 솟음(땅=섬).
(() => {
  const level = mean(C.wet.map(b => C.wtop[b]));
  const land = []; for (let b = 0; b < C.NB; b++) if (C.tcol[b] > level + 1) land.push(b);
  ok(C.wet.length >= 5 && C.dry.length >= 5 && land.length >= 1,
    `땅·바다 공존 — 바다 컬럼 ${C.wet.length}·땅(마른) 컬럼 ${C.dry.length}·수면(≈${level.toFixed(1)}) 위로 솟은 봉우리 ${land.length}개`);
})();

// ④ 보존 — 물 질량(개수)은 조립 중 사라지지 않는다(살포=초기·이동만·NaN 없음).
(() => {
  const finite = water.every(p => Number.isFinite(p.cx) && Number.isFinite(p.cz));
  show(L.conserved('물 질량(살포 → 정착)', N0, water.reduce((s, p) => s + p.mass, 0)));
  ok(finite, `유한성 — 모든 입자 좌표 유한(발산 없음·최저 z ${Math.min(...water.map(p => p.cz)).toFixed(1)})`);
})();

// ⑤ 결정론 — 같은 입력 → 같은 지형·바다(짧게 재현).
show(L.deterministic('같은 법칙 → 같은 지형·바다', () => settle(800).map(p => [p.cx.toFixed(5), p.cz.toFixed(5)])));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

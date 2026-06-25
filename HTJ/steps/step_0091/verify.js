// step_0091/verify.js — (조립) 연속 바다·해안선: 2D 맵 노이즈 지형 위로 SPH 물이 분지에 고여 한 수면을 찾고 해안선이 창발.
//   조립 step → engine 변경 0(0083 의 1D 단면을 2D 맵으로: 노이즈 높이장 h(x,y) + sphPressureForce/Viscosity/BoundaryForce
//   + 중력 + stepEntities). 부품 보존·물리는 0041/0046/0060/0083 verify 가 보증 → 여기선 *합쳐서 생긴 창발*만:
//     ① 연속 수면(2D 맵 전역에서 물이 한 높이=바다) ② 해안선 창발(바다∩땅 경계가 지형 ≈ 해수면 등고선) ③ 땅·바다·섬 공존
//     ④ 물 보존 ⑤ 결정론. 지형은 노이즈 법칙(author 없음)·바다는 중력+경계 접촉으로 — 둘 다 법칙만으로.
//   순수·독립·영구. 실행: node HTJ/steps/step_0091/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// ── 2D 맵 지형 = 노이즈 법칙(value-noise fBm·author 없음·0074/0083 노이즈 가족) ──
function lat(i, j) { let h = (Math.imul(((i * 73856093) ^ (j * 19349663) ^ 0x9e3779b9) >>> 0, 2654435761)) >>> 0; return (h & 0xffff) / 0xffff; }
function sm(t) { return t * t * (3 - 2 * t); }
function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = sm(xf), v = sm(yf);
  const a = lat(xi, yi) * (1 - u) + lat(xi + 1, yi) * u, b = lat(xi, yi + 1) * (1 - u) + lat(xi + 1, yi + 1) * u; return a * (1 - v) + b * v; }
function fbm2(x, y) { let s = 0, a = 1, f = 1, n = 0; for (let o = 0; o < 4; o++) { s += a * vn(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; }
const AMP = 24, SCALE = 0.16, R = 18;
const terr = (x, y) => AMP * fbm2((x + 100) * SCALE, (y + 100) * SCALE);

const G = 4, DT = 0.02;
const popt = { stiffness: 80, h: 2.2, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.2, gamma: 2 }, bopt = { stiffness: 200, damp: 40, skin: 0.6 };
function buildAnchors() {
  const an = [], AR = 5, DXY = 2.4;
  for (let x = -R; x <= R + 1e-9; x += DXY) for (let y = -R; y <= R + 1e-9; y += DXY) an.push({ cx: x, cy: y, cz: terr(x, y) - AR, radius: AR });
  for (let t = -R; t <= R + 1e-9; t += 2.4) for (let z = 0; z <= AMP + 10; z += 3) {
    an.push({ cx: t, cy: -R - 2, cz: z, radius: 5 }); an.push({ cx: t, cy: R + 2, cz: z, radius: 5 });
    an.push({ cx: -R - 2, cy: t, cz: z, radius: 5 }); an.push({ cx: R + 2, cy: t, cz: z, radius: 5 });
  }
  return an;
}
function settle(steps) {
  const an = buildAnchors(), water = [];
  let seed = 11; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let x = -R + 4; x <= R - 4; x += 2.6) for (let y = -R + 4; y <= R - 4; y += 2.6) water.push({ cx: x + (rnd() - .5), cy: y + (rnd() - .5), cz: AMP + 8 + rnd() * 3, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
  for (let s = 0; s < steps; s++) {
    Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt);
    for (const p of water) p.pz -= p.mass * G * DT;
    Sph.sphBoundaryForce(water, an, DT, bopt);
    En.stepEntities(water, DT);
  }
  return water;
}
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };

// 2D 컬럼 격자 분석: 셀별 지형/수면/젖음 + 해안선(젖음∩마름 4-이웃 경계)
function analyze(water) {
  const NB = 14, dxy = (2 * R) / NB;
  const wm = {}, wtop = {};
  for (const p of water) { const bx = Math.min(NB - 1, Math.max(0, Math.floor((p.cx + R) / dxy))), by = Math.min(NB - 1, Math.max(0, Math.floor((p.cy + R) / dxy))); const k = bx + ',' + by; wm[k] = (wm[k] || 0) + 1; if (!(k in wtop) || p.cz > wtop[k]) wtop[k] = p.cz; }
  const wet = (bx, by) => (wm[bx + ',' + by] || 0) >= 2;
  const th = (bx, by) => terr(-R + (bx + .5) * dxy, -R + (by + .5) * dxy);
  const wetTops = [], allT = [], wetTerr = [], dryTerr = [], coastWet = [], coastDry = [];
  for (let bx = 0; bx < NB; bx++) for (let by = 0; by < NB; by++) {
    allT.push(th(bx, by));
    if (wet(bx, by)) {
      wetTops.push(wtop[bx + ',' + by]); wetTerr.push(th(bx, by));
      // 해안선 = 젖은 셀이 마른 이웃과 닿는 곳 — 물가 등고선은 *젖은 셀(아래)과 마른 이웃(위) 사이*를 지난다.
      const dryNbrs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [bx + dx, by + dy]).filter(([nx, ny]) => nx >= 0 && nx < NB && ny >= 0 && ny < NB && !wet(nx, ny));
      if (dryNbrs.length) { coastWet.push(th(bx, by)); for (const [nx, ny] of dryNbrs) coastDry.push(th(nx, ny)); }
    } else dryTerr.push(th(bx, by));
  }
  const level = mean(wetTops);
  return { NB, level, surfStd: std(wetTops), terrStd: std(allT), wet: wetTops.length, dry: dryTerr.length,
    tWet: mean(wetTerr), tDry: mean(dryTerr), coast: coastWet.length, coastWet: mean(coastWet), coastDry: mean(coastDry),
    islands: allT.filter(h => h > level + 1.5).length };
}

const water = settle(3000), N0 = water.length, A = analyze(water);

// ① 연속 수면 — 2D 맵 전역에서 정착한 물 표면이 한 높이(바다)·산포 ≪ 지형 산포(0083 의 평평함을 2D 로).
ok(A.surfStd < 0.4 * A.terrStd,
  `연속 수면 — 2D 맵 수면 산포 ${A.surfStd.toFixed(2)} < 0.4×지형 산포 ${(0.4 * A.terrStd).toFixed(2)}(물이 전역에서 한 높이 ≈${A.level.toFixed(1)}=바다)`);
// ② 해안선 창발(핵심·0083 엔 없던) — 바다∩땅 경계가 또렷이 존재하고, 그 경계에서 지형이 *바다→땅으로 솟는다*(마른쪽 > 젖은쪽).
ok(A.coast >= 3 && A.coastDry > A.coastWet && A.coastWet < A.level,
  `해안선 창발 — 바다∩땅 경계 ${A.coast}셀·해안선에서 지형이 솟음(마른쪽 ${A.coastDry.toFixed(1)} > 젖은쪽 ${A.coastWet.toFixed(1)})·젖은쪽 지형 ${A.coastWet.toFixed(1)} < 해수면 ${A.level.toFixed(1)}(물에 잠긴 해저)`);
// ③ 땅·바다·섬 공존 — 바다(젖음)·땅(마름) 충분 + 해수면 위로 솟은 섬(봉우리)·바다 지형 < 땅 지형.
ok(A.wet >= 8 && A.dry >= 8 && A.islands >= 1 && A.tWet < A.tDry - 1,
  `땅·바다·섬 공존 — 바다 ${A.wet}·땅 ${A.dry}·섬(해수면 위 봉우리) ${A.islands}·바다지형 ${A.tWet.toFixed(1)}<땅지형 ${A.tDry.toFixed(1)}`);
// ④ 물 보존 — 살포 → 정착에 물(질량) 사라지지 않고 발산 없음.
(() => {
  const finite = water.every(p => Number.isFinite(p.cx) && Number.isFinite(p.cy) && Number.isFinite(p.cz));
  show(L.conserved('물 질량(살포 → 정착)', N0, water.reduce((s, p) => s + p.mass, 0)));
  ok(finite, `유한성 — 모든 입자 좌표 유한(발산 없음·최저 z ${Math.min(...water.map(p => p.cz)).toFixed(1)})`);
})();
// ⑤ 결정론 — 같은 법칙 → 같은 지형·바다(짧게 재현).
show(L.deterministic('같은 법칙 → 같은 연속 바다', () => settle(500).map(p => [p.cx.toFixed(5), p.cy.toFixed(5), p.cz.toFixed(5)])));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

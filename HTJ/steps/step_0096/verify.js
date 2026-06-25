// step_0096/verify.js — (조립) 바이옴 지형 위의 바다: 바다는 따뜻한 저지 분지에 고이고, 찬 고지(산)는 섬으로 솟는다.
//   조립 step → engine 변경 0. 두 트랙을 한 무대에서 합친다: ① 2D 바다(0091·SPH 물이 분지에 한 수면)
//   ② 바이옴(0092~0095·biomeField, 고도축=실제 지형장 → 높은 땅=찬 바이옴). 부품 보존·물리는 부품 verify 가 보증 →
//   여기선 *합쳐서 생긴 cross-thread 창발*만: 바다=따뜻한 저지·섬/산=찬 고지(기후와 해수면이 한 세계에서 일관).
//   순수·독립·영구. 실행: node HTJ/steps/step_0096/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// ── 2D 맵 지형 = 노이즈 법칙(0091 과 동일 가족) ──
function lat(i, j) { let h = (Math.imul(((i * 73856093) ^ (j * 19349663) ^ 0x9e3779b9) >>> 0, 2654435761)) >>> 0; return (h & 0xffff) / 0xffff; }
function sm(t) { return t * t * (3 - 2 * t); }
function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = sm(xf), v = sm(yf);
  const a = lat(xi, yi) * (1 - u) + lat(xi + 1, yi) * u, b = lat(xi, yi + 1) * (1 - u) + lat(xi + 1, yi + 1) * u; return a * (1 - v) + b * v; }
function fbm2(x, y) { let s = 0, a = 1, f = 1, n = 0; for (let o = 0; o < 4; o++) { s += a * vn(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; }
const AMP = 24, SCALE = 0.16, R = 18;
const terr = (x, y) => AMP * fbm2((x + 100) * SCALE, (y + 100) * SCALE);
// 바이옴 — 고도축 = 정규화 지형(0095 elevFn) → 높은 땅이 찬 바이옴(lapse). 위도는 끄고(latAmp 0) 고도만으로 본다.
const bf = S.biomeField({ scale: 0.07, nTemp: 3, nHum: 3, lapse: 0.6, elevFn: (x, y) => terr(x, y) / AMP });

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

function analyze(water) {
  const NB = 14, dxy = (2 * R) / NB;
  const wm = {}, wtop = {};
  for (const p of water) { const bx = Math.min(NB - 1, Math.max(0, Math.floor((p.cx + R) / dxy))), by = Math.min(NB - 1, Math.max(0, Math.floor((p.cy + R) / dxy))); const k = bx + ',' + by; wm[k] = (wm[k] || 0) + 1; if (!(k in wtop) || p.cz > wtop[k]) wtop[k] = p.cz; }
  const wet = (bx, by) => (wm[bx + ',' + by] || 0) >= 2;
  const cx = (bx) => -R + (bx + .5) * dxy, cy = (by) => -R + (by + .5) * dxy;
  const th = (bx, by) => terr(cx(bx), cy(by));
  const wetTops = [], wetTerr = [], dryTerr = [];
  const wetTemp = [], islandTemp = [], islandRows = [];
  let level;
  for (let bx = 0; bx < NB; bx++) for (let by = 0; by < NB; by++) { if (wet(bx, by)) wetTops.push(wtop[bx + ',' + by]); }
  level = mean(wetTops);
  for (let bx = 0; bx < NB; bx++) for (let by = 0; by < NB; by++) {
    const h = th(bx, by), b = bf(cx(bx), cy(by));
    if (wet(bx, by)) { wetTerr.push(h); wetTemp.push(b.effTemp); }
    else { dryTerr.push(h); if (h > level + 1.5) { islandTemp.push(b.effTemp); islandRows.push(Math.floor(b.biome / 3)); } }
  }
  return { level, wet: wetTops.length, dry: dryTerr.length, tWet: mean(wetTerr), tDry: mean(dryTerr),
    tempWet: mean(wetTemp), tempIsland: mean(islandTemp), islands: islandTemp.length,
    islandCold: islandRows.filter(r => r === 0).length / (islandRows.length || 1) };
}

const water = settle(3000), N0 = water.length, A = analyze(water);

// ① 바다 = 저지 분지(0091 재현) — 물이 낮은 지형에 고인다(젖은 지형 < 마른 지형)·발산 없음.
ok(A.wet >= 8 && A.dry >= 8 && A.tWet < A.tDry - 1,
  `바다=저지 — 바다 ${A.wet}·땅 ${A.dry}·바다지형 ${A.tWet.toFixed(1)} < 땅지형 ${A.tDry.toFixed(1)}(물이 낮은 분지에 고임)`);

// ② cross-thread 창발(핵심) — 바다(따뜻한 저지)와 섬/산(찬 고지)이 한 세계에서 일관: 바다 effTemp > 섬 effTemp·섬은 대개 찬 바이옴.
ok(A.islands >= 1 && A.tempWet > A.tempIsland + 0.1 && A.islandCold > 0.5,
  `바다=따뜻·산=차다 — 바다 effTemp ${A.tempWet.toFixed(2)} > 섬 ${A.tempIsland.toFixed(2)}(Δ${(A.tempWet - A.tempIsland).toFixed(2)})·섬 ${A.islands}개 중 찬 바이옴 ${(A.islandCold * 100).toFixed(0)}%(고지=찬 산·자기일관)`);

// ③ 물 보존 — 살포 → 정착에 물(질량) 사라지지 않고 좌표 유한.
(() => {
  const finite = water.every(p => Number.isFinite(p.cx) && Number.isFinite(p.cy) && Number.isFinite(p.cz));
  show(L.conserved('물 질량(살포 → 정착)', N0, water.reduce((s, p) => s + p.mass, 0)));
  ok(finite, `유한성 — 모든 입자 좌표 유한(발산 없음·해수면 ≈${A.level.toFixed(1)})`);
})();

// ④ 결정론 — 같은 법칙 → 같은 바다+바이옴(짧게 재현).
show(L.deterministic('같은 법칙 → 같은 바이옴 바다', () => settle(500).map(p => [p.cx.toFixed(5), p.cy.toFixed(5), p.cz.toFixed(5)])));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

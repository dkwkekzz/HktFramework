// step_0108/verify.js — (조립) 안정 분절 침식: 비겹침 *그리드 베드* 위에서 흐름이 *공간 협곡*을 깎는다(안정).
//   0075 침식(sphSedimentErosion)은 *겹친 sphere 앵커* 카펫 위에선 경계력이 폭발해 불안정했다(단일 램프 균일 하강만).
//   핵심 고침은 *베드 표현* — 셀당 앵커 하나(비겹침·0103/0104 식)면 침식이 안정하고, 빠른 흐름 셀이 더 깎여 *협곡*이
//   공간적으로 창발한다(채널 깊어짐→흐름 집중→더 깎임 되먹임). 침식 법칙(0075)·물리 부품은 부품 verify 가 보증.
//   여기선 *새 결합*만: 그리드 베드 위 안정 침식 + 흐름 따라 협곡. 순수·독립·영구. 실행: node HTJ/steps/step_0108/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

const GW = 22, GH = 22, G = 4, DT = 0.02, AR = 4;
const elevFn = (x, y) => 8 * Math.pow((x - (GW - 1) / 2) / ((GW - 1) / 2), 2) + 0.30 * y
  + 1.0 * Stream.fbm(x * 0.18, y * 0.18, { salt: 'CAN', octaves: 3, gain: 0.5 });
const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.0, gamma: 2 };
const bopt = { stiffness: 200, damp: 30, skin: 0.6 }, fopt = { drag: 6, skin: 0.6 };
const eopt = { erodeRate: 1.6, capacity: 1.2, skin: 0.6, minBed: 0.5 };   // 0075 침식(그리드 베드·강하게 깎음)

// 셀당 앵커 하나(비겹침·DXY=1 = 격자 간격) — 0075 의 겹친 카펫 대신. erosion 이 A.bed/A.radius 만 바꿈.
//   모든 앵커(벽 포함)에 bed 부여 → 전역 침식 보존을 정확히 닫는다(벽이 깎여도 장부에 든다).
function bedAnchors() {
  const an = [];
  for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) an.push({ cx: x, cy: y, cz: elevFn(x, y) - AR, radius: AR, bed: AR });
  for (let x = -1; x <= GW; x++) for (let z = 0; z <= 14; z += 3) an.push({ cx: x, cy: GH + 1, cz: z, radius: 5, bed: 5 });
  for (let y = -1; y <= GH; y++) for (let z = 0; z <= 14; z += 3) { an.push({ cx: -2, cy: y, cz: z, radius: 5, bed: 5 }); an.push({ cx: GW + 1, cy: y, cz: z, radius: 5, bed: 5 }); }
  return an;
}

function run() {
  const an = bedAnchors(), water = []; let seed = 4, spawned = 0, exitedSed = 0; let maxV = 0;
  const bed0All = an.reduce((s, a) => s + a.bed, 0);              // 초기 Σbed(전 앵커)
  const presence = new Float64Array(GW * GH);                     // 물이 지난 셀(wetted·흐름 경로)
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let step = 0; step < 64; step++) {
    if (step < 56) for (let i = 0; i < 9; i++) {                   // 상류 살포(끊임없이→협곡 깎임)
      const x = 2 + rnd() * (GW - 4), y = GH - 4 - rnd() * 3;
      water.push({ cx: x, cy: y, cz: elevFn(x, y) + 5, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, sediment: 0, radius: 1 });
      spawned++;
    }
    for (let s = 0; s < 20; s++) {
      Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt);
      for (const p of water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(water, an, DT, bopt);
      Sph.sphBedFriction(water, an, DT, fopt);
      Sph.sphSedimentErosion(water, an, DT, eopt);                 // 0075 침식 — 그리드 베드 깎고 쌓음
      En.stepEntities(water, DT);
      for (let k = water.length - 1; k >= 0; k--) if (water[k].cy < -1 || water[k].cz < -2) { exitedSed += water[k].sediment || 0; water.splice(k, 1); }
    }
    for (const p of water) { const v = Math.hypot(p.px, p.py, p.pz) / (p.mass || 1); if (v > maxV) maxV = v;
      const c = Math.round(p.cx), r = Math.round(p.cy); if (c >= 0 && c < GW && r >= 0 && r < GH) presence[r * GW + c]++; }
  }
  const bed = an.filter(a => a.cx >= 0 && a.cx < GW && a.cy >= 0 && a.cy < GH);   // 그리드 베드(협곡 측정)
  const bedNowAll = an.reduce((s, a) => s + a.bed, 0);
  return { an, bed, water, spawned, maxV, bed0All, bedNowAll, exitedSed, presence };
}

const Wd = run();

// ① 공간 비균일 협곡 — 침식이 *빠른 흐름 경사*(stream power)를 따라 *집중*된다(균일 램프 하강이 아닌 공간 협곡).
//   0075 한계 = 단일 램프 *균일* 하강. 여기선 경사 가파른 곳이 더 깎이고(corr) 침식이 소수 셀에 *집중*(협곡 단면).
const slopeAt = (x, y) => { const e = elevFn(x, y); return Math.hypot(elevFn(x + 1, y) - e, elevFn(x, y + 1) - e); };
(() => {
  const sl = [], ero = [];
  for (const a of Wd.bed) { sl.push(slopeAt(a.cx, a.cy)); ero.push(Math.max(0, AR - a.radius)); }
  const ms = mean(sl), me = mean(ero); let cov = 0, vs = 0, ve = 0;
  for (let k = 0; k < sl.length; k++) { const ds = sl[k] - ms, de = ero[k] - me; cov += ds * de; vs += ds * ds; ve += de * de; }
  const corr = cov / (Math.sqrt(vs * ve) || 1);
  const sorted = ero.slice().sort((a, b) => b - a), tot = sorted.reduce((s, v) => s + v, 0);
  const top = sorted.slice(0, Math.floor(sorted.length * 0.3)).reduce((s, v) => s + v, 0);
  const concFrac = top / (tot || 1);
  ok(corr > 0.2 && concFrac > 0.55 && tot > 10,
    `공간 비균일 협곡 — corr(경사,침식) ${corr.toFixed(2)}>0.2·상위 30% 셀이 침식 ${(100 * concFrac).toFixed(0)}%>55% 집중(균일 램프 아닌 협곡)`);
})();

// ② 안정성(겹친 앵커 폭발 없음) — 침식 내내 물 속도가 유한·베드가 유한(NaN/발산 0)·minBed 아래로 안 깎임.
(() => {
  let finite = true, belowMin = 0;
  for (const a of Wd.bed) { if (!isFinite(a.radius) || !isFinite(a.bed)) finite = false; if (a.bed < eopt.minBed - 1e-9) belowMin++; }
  ok(finite && belowMin === 0 && isFinite(Wd.maxV) && Wd.maxV < 60,
    `안정성 — 베드 유한·minBed 위반 ${belowMin}·max속도 ${Wd.maxV.toFixed(1)}<60(겹친 앵커 폭발 없음·그리드 베드 안정)`);
})();

// ③ 침식 보존 — Σ A.bed(전 앵커·땅) + Σ p.sediment(운반 중) + 유출 운반 = 초기 Σbed(0075 쌍이동·정확 보존).
(() => {
  const sed = Wd.water.reduce((s, p) => s + (p.sediment || 0), 0);
  const total = Wd.bedNowAll + sed + Wd.exitedSed;
  show(L.conserved('침식 장부(Σbed + 운반중 + 유출운반)', Wd.bed0All, total, 1e-9));
})();

// ④ 결정론.
show(L.deterministic('같은 비 → 같은 협곡', () => run().bed.map(a => Math.round(a.radius * 1e3))));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

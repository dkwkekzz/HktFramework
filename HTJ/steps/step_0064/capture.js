// step_0064/capture.js — 눈 검증: TW3 강 = 물이 기울인 지형 채널을 *흘러내려* 하류 댐에 고인다.
//   design/environment.md §3 TW3. 새 엔진 법칙 `sphBedFriction`(바닥 접선 항력)이 물에 *종단속도*를 줘서
//   끝없는 가속(탄도) 대신 *일정 속도로 흘러* 강이 된다. 상류(+x·오른쪽) source 가 물을 계속 흘려보내고,
//   bed friction 으로 흐름이 유한하며, 하류(−x·왼쪽) 댐 뒤에 고여 저수지가 찬다. 4 패널(시간 경과)·x-z 단면.
//   회색=지형 경계(바닥·댐·상류벽)·파랑=물(밝을수록 *빠른 흐름*·어두울수록 고인 물). PNG=tools/htj-capture.js.
//   실행: node HTJ/steps/step_0064/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

// 기울인 램프 바닥 = 큰 구를 오른쪽-위에 둬 패치가 내리막 사면(우측 高→좌측 低). 중력은 수직(−z).
const R = 600, XC = 145.5, ZC = -567.6, HWy = 6, BRw = 200, G = 4, DRAG = 0.6;
const floorZ = (x) => ZC + Math.sqrt(Math.max(0, R * R - (x - XC) * (x - XC)));
const anchors = [
  { cx: XC, cy: 0, cz: ZC, radius: R },                       // 램프 바닥(기울어짐)
  { cx: -(BRw + 52), cy: 0, cz: floorZ(-50), radius: BRw }, { cx: (BRw + 52), cy: 0, cz: floorZ(50), radius: BRw },   // 댐(좌) / 상류 back(우)
  { cx: 0, cy: -(BRw + HWy), cz: floorZ(0), radius: BRw }, { cx: 0, cy: (BRw + HWy), cz: floorZ(0), radius: BRw },     // y 벽(채널)
];
const popt = { stiffness: 90, h: 2.0, gamma: 2 }, vopt = { alpha: 1.5, beta: 2, h: 2.0, gamma: 2 }, bopt = { stiffness: 150, damp: 30, skin: 0.6 };
function rng(s) { return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function wp(cx, cy, cz) { return { cx, cy, cz, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 }; }
const rnd = rng(7), water = [];
const speed = (w) => Math.hypot(w.px, w.py, w.pz) / w.mass;

// x-z 단면(강 옆모습): 오른쪽(+x)=상류 高·왼쪽(−x)=하류 댐 低. 지형 경계(회색·v=2) + 물(파랑·v=속도 정규화).
const Nc = 48, HWx = 52, OX = Nc * 0.5, OZ = Nc * 0.74, sc = Nc * 0.92 / (2 * HWx);
const terrain = [];
for (let x = -HWx; x <= HWx + 1e-9; x += 3) terrain.push({ cx: OX + x * sc, cy: OZ - floorZ(x) * sc, r: 0.5, v: 2 });   // 램프 바닥(내리막)
for (let z = 0; z <= 14 + 1e-9; z += 1.5) terrain.push({ cx: OX - HWx * sc, cy: OZ - (floorZ(-50) + z) * sc, r: 0.5, v: 2 });   // 댐(좌)
for (let z = 0; z <= 14 + 1e-9; z += 1.5) terrain.push({ cx: OX + HWx * sc, cy: OZ - (floorZ(50) + z) * sc, r: 0.5, v: 2 });    // 상류벽(우)
function snap() {
  const pts = terrain.slice();
  for (const w of water) pts.push({ cx: OX + w.cx * sc, cy: OZ - w.cz * sc, r: 0.8, v: Math.min(1, speed(w) / 4) });   // 밝기=속도(흐름)
  return { pts };
}
const marks = [1200, 2600, 4000, 6000], frames = [];
for (let s = 1; s <= 6000; s++) {
  if (water.length < 180 && s % 18 === 0) for (let j = 0; j < 3; j++) { const x = 46 - rnd() * 4; water.push(wp(x, (rnd() - 0.5) * 8, floorZ(x) + 3 + rnd() * 3)); }
  Sph.sphPressureForce(water, 0.02, popt); Sph.sphViscosity(water, 0.02, vopt);
  for (const w of water) w.pz -= w.mass * G * 0.02;          // 수직 중력(기울기는 램프 바닥에)
  Sph.sphBoundaryForce(water, anchors, 0.02, bopt); Sph.sphBedFriction(water, anchors, 0.02, { drag: DRAG, skin: bopt.skin });
  En.stepEntities(water, 0.02);
  if (marks.includes(s)) frames.push(snap());
}
const outPath = path.join(__dirname, 'capture.png');
// 색: 지형=회색(v≥1.5)·물=파랑(밝기=속도: 빠른 흐름=밝음·고인 물=어두움).
Cap.writeFramesPNG(outPath, frames, { N: Nc, color: (v) => v >= 1.5 ? [70, 76, 92] : [40 + v * 90, 90 + v * 120, 190 + v * 60] });

const xs = water.map(w => w.cx);
const damPool = xs.filter(x => x < -HWx + 22).length, mv = water.reduce((s, w) => s + speed(w), 0) / water.length;
const ok = fs.existsSync(outPath) && damPool > 120 && water.filter(w => Math.abs(w.cx) > HWx + 5).length === 0;
console.log('\n=== 눈 검증: TW3 강(물이 기울인 지형 채널을 흘러내려 하류 댐에 고임) ===');
console.log(`  기울인 램프 바닥(우측 z=${floorZ(50).toFixed(0)} 高 → 좌측 z=${floorZ(-50).toFixed(0)} 低·내리막) · 상류 source → bed friction 종단속도 흐름 → 하류 댐 저수지`);
console.log(`  물 ${water.length}개 SPH 입자 · 하류 댐 고임 ${damPool}/${water.length} · 정착 평균속도 ${mv.toFixed(2)} · 이탈 0`);
console.log('  4 패널: 상류서 흐르기 시작 → 채널 따라 흘러내림 → 댐 뒤 저수지 차오름 → 가득 고임(밝을수록 빠른 흐름)');
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 물이 경사 채널을 흘러 하류에 고인다(강)' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

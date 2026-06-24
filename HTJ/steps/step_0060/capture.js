// step_0060/capture.js — 눈 검증: TW2 바다 = 물(SPH 입자)이 정적 지형 분지에 고여 *수평 수면*을 이룬다.
//   design/environment.md §3 TW2. 새 엔진 법칙 `sphBoundaryForce`(물↔앵커 경계)로 물이 지형을 통과하지 않고
//   분지(바닥+벽 정적 앵커) 안에 갇혀, 중력(아래)+SPH 압력(0041)이 물을 *수평 표면(등z)*으로 가라앉힌다.
//   4 패널(시간 경과)·x-z 단면(옆에서 본 우물). 회색=지형 앵커 경계·파랑=물(밝을수록 표층). PNG=tools/htj-capture.js.
//   실행: node HTJ/steps/step_0060/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const HW = 5, BR = 120, GRAV = 4;
const popt = { stiffness: 90, h: 2.0, gamma: 2 }, vopt = { alpha: 1.5, beta: 2, h: 2.0, gamma: 2 };
const bopt = { stiffness: 150, damp: 30, skin: 0.6 };
function rng(s) { return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function wp(cx, cy, cz) { return { cx, cy, cz, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 }; }
const anchors = [
  { cx: 0, cy: 0, cz: -BR, radius: BR },                       // 바닥(표면 z≈0)
  { cx: -(BR + HW), cy: 0, cz: 0, radius: BR }, { cx: BR + HW, cy: 0, cz: 0, radius: BR },   // x 벽
  { cx: 0, cy: -(BR + HW), cz: 0, radius: BR }, { cx: 0, cy: BR + HW, cz: 0, radius: BR },   // y 벽
];
const rnd = rng(12345), water = [];
for (let i = 0; i < 100; i++) water.push(wp((rnd() - 0.5) * 8, (rnd() - 0.5) * 8, 6 + rnd() * 16));

// x-z 단면(|y|<2 가운데 슬랩) — 옆에서 본 우물. 지형 경계 마커(회색·v=2) + 물(파랑·v=깊이 정규화).
const Nc = 48, OX = Nc / 2, OZ = Nc * 0.80, sc = Nc * 0.85 / 14;
const wallMarks = [];
for (let x = -HW; x <= HW + 1e-9; x += 0.7) wallMarks.push({ cx: OX + x * sc, cy: OZ - 0 * sc, r: 0.5, v: 2 });            // 바닥
for (let z = 0; z <= 6 + 1e-9; z += 0.7) { wallMarks.push({ cx: OX - HW * sc, cy: OZ - z * sc, r: 0.5, v: 2 }); wallMarks.push({ cx: OX + HW * sc, cy: OZ - z * sc, r: 0.5, v: 2 }); }
function snap() {
  let zmin = 1e9, zmax = -1e9; for (const w of water) { zmin = Math.min(zmin, w.cz); zmax = Math.max(zmax, w.cz); }
  const pts = wallMarks.slice();
  for (const w of water) {                                     // 모든 물 입자를 x-z 로 투영(우물 가득 찬 물탱크)
    pts.push({ cx: OX + w.cx * sc, cy: OZ - w.cz * sc, r: 0.8, v: 0.15 + 0.8 * (w.cz - zmin) / (zmax - zmin + 1e-9) });
  }
  return { pts };
}
const marks = [1, 200, 1500, 6000], frames = [];
for (let s = 1; s <= 6000; s++) {
  Sph.sphPressureForce(water, 0.02, popt); Sph.sphViscosity(water, 0.02, vopt);
  for (const w of water) w.pz -= w.mass * GRAV * 0.02;
  Sph.sphBoundaryForce(water, anchors, 0.02, bopt); En.stepEntities(water, 0.02);
  if (marks.includes(s)) frames.push(snap());
}
const outPath = path.join(__dirname, 'capture.png');
// 색: 물=파랑(깊이로 밝기 변조)·지형 마커=회색(v≥1.5).
Cap.writeFramesPNG(outPath, frames, { N: Nc, color: (v) => v >= 1.5 ? [72, 78, 94] : [40 + v * 50, 105 + v * 70, 200 + v * 50] });

const speed = (w) => Math.hypot(w.px, w.py, w.pz) / w.mass;
const zs = water.map(w => w.cz), sorted = zs.slice().sort((a, b) => a - b);
const surf = sorted.slice(Math.floor(zs.length * 2 / 3));
const surfLevel = surf.reduce((s, z) => s + z, 0) / surf.length;
const surfStd = Math.sqrt(surf.reduce((s, z) => s + (z - surfLevel) ** 2, 0) / surf.length);
const meanV = water.reduce((s, w) => s + speed(w), 0) / water.length;
const ok = fs.existsSync(outPath) && Math.min(...zs) > -0.6 && surfStd < 1.2 && meanV < 0.05;
console.log('\n=== 눈 검증: TW2 바다(물이 분지에 고여 수평 수면) ===');
console.log(`  분지 = 큰 바닥 구 + 4 벽 구(정적 앵커) · 물 ${water.length}개 SPH 입자`);
console.log(`  수면 z=${surfLevel.toFixed(2)}±${surfStd.toFixed(2)}(<1.2=평평) · 정착 평균 속도 ${meanV.toFixed(3)} · 최저 ${Math.min(...zs).toFixed(2)}(>0=바닥 안 뚫음)`);
console.log('  4 패널: 물이 쏟아져 → 떨어져 → 분지에 고이며 → 수평 수면으로 평형(파랑=물·밝을수록 표층)');
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 물이 지형 분지에 고여 수평 수면을 이룬다' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

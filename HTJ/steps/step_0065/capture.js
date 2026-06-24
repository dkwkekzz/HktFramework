// step_0065/capture.js — 눈 검증: T1 지형 표면 발현(점→면). 같은 지형 앵커 카펫이 *민둥 구 점 무리*에서
//   *연속 음영 표면*으로 발현되는 4 단계를 나란히 보인다. design/merge-dna.md §5 T1.
//   x-z 단면(가운데 y 행). ① 앵커 점(민둥 구·old) → ② 표면 정점(조밀) → ③ 표면 채움(면) → ④ 법선 음영(자연스러운 땅).
//   PNG=tools/htj-capture.js(disc 만 사용·법선 음영은 v 값으로). 실행: node HTJ/steps/step_0065/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const T = require(path.resolve(__dirname, '../../engine/htj-terrain.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

// 시험 지형(verify 와 같은 골격) — 7×7 앵커 카펫 위 사인 높이장(봉우리·계곡).
const W = 12, SPC = 4, hf = (x, y) => 3.0 * Math.sin(0.32 * x) * Math.cos(0.28 * y) + 1.6 * Math.sin(0.2 * x + 0.15 * y);
const anchors = [];
for (let x = -W; x <= W; x += SPC) for (let y = -W; y <= W; y += SPC) anchors.push({ cx: x, cy: y, cz: hf(x, y) });
const surf = T.terrainSurface(anchors, { up: 4 });

// 고정 광원(htj-render 와 같은 정신) — 법선 음영 shade = 0.4 + 0.6·max(0,n·L).
const Ln = (() => { const v = [0.45, 1.0, 0.6], m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; })();
const shade = (n) => 0.4 + 0.6 * Math.max(0, n.x * Ln[0] + n.y * Ln[1] + n.z * Ln[2]);

// 단면(가운데 y 행) 좌표계 — x → 가로, 높이 z → 세로(위가 높음). N=64 패널.
const Nc = 64, OX = Nc * 0.5, sc = Nc * 0.85 / (2 * W + 4), OZ = Nc * 0.52, BASE = Nc * 0.95;
const J0 = surf.ny >> 1;                                           // 가운데 y 행
const colX = (x) => OX + x * sc, rowZ = (z) => OZ - z * sc;

// 패널 1 — 앵커 점(민둥 구·old): 성긴 큰 디스크(가운데 y 행 앵커만).
function panelAnchors() {
  const pts = [];
  for (const a of anchors) { if (Math.abs(a.cy) > 1e-6) continue; pts.push({ cx: colX(a.cx), cy: rowZ(a.cz), r: 1.8, v: 0.85 }); }
  return { pts };
}
// 패널 2 — 표면 정점(조밀): 작은 점이지만 촘촘(점→면 직전).
function panelVerts() {
  const pts = [];
  for (let I = 0; I < surf.nx; I++) { const v = T.vertexWorld(surf, I, J0); pts.push({ cx: colX(v.cx), cy: rowZ(v.cz), r: 0.55, v: 0.7 }); }
  return { pts };
}
// 패널 3 — 표면 채움(면): 각 열에서 표면 높이부터 base 까지 디스크로 채워 *이어진 면*.
function panelFill() {
  const pts = [];
  for (let I = 0; I < surf.nx; I++) {
    const v = T.vertexWorld(surf, I, J0), top = rowZ(v.cz);
    for (let py = top; py <= BASE; py += 0.8) pts.push({ cx: colX(v.cx), cy: py, r: 0.5, v: 0.55 });
  }
  return { pts };
}
// 패널 4 — 법선 음영(자연스러운 땅): 채움 + 표면 정점 색을 법선 음영(n·L)으로 — 기운 면이 어둡고/밝다.
function panelShaded() {
  const pts = [];
  for (let I = 0; I < surf.nx; I++) {
    const v = T.vertexWorld(surf, I, J0), top = rowZ(v.cz), s = shade(v.n);
    for (let py = top; py <= BASE; py += 0.8) { const depth = 1 - (py - top) / (BASE - top + 1e-9); pts.push({ cx: colX(v.cx), cy: py, r: 0.5, v: s * (0.45 + 0.55 * depth) }); }
  }
  return { pts };
}

const frames = [panelAnchors(), panelVerts(), panelFill(), panelShaded()];
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N: Nc });

// 음영 대비 측정 — 법선 음영이 평탄하지 않다(기운 면이 실제로 음영 차를 만든다).
let sMin = 1, sMax = 0; for (let I = 0; I < surf.nx; I++) { const s = shade(T.vertexWorld(surf, I, J0).n); sMin = Math.min(sMin, s); sMax = Math.max(sMax, s); }
const ok = fs.existsSync(outPath) && surf.count > anchors.length * 4 && (sMax - sMin) > 0.1;
console.log('\n=== 눈 검증: T1 지형 표면 발현(점→면) ===');
console.log(`  같은 지형(앵커 ${anchors.length}) → 표면 정점 ${surf.count}(×${(surf.count / anchors.length).toFixed(1)})`);
console.log(`  4 패널: ① 앵커 점(민둥 구·old) → ② 표면 정점(조밀) → ③ 표면 채움(면) → ④ 법선 음영(자연스러운 땅)`);
console.log(`  법선 음영 대비 ${(sMax - sMin).toFixed(2)}(기운 면이 밝기 차를 만든다)`);
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 민둥 구 점 무리가 연속 음영 표면(땅)으로 발현' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

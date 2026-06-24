// step_0063/capture.js — 눈 검증: M3 DNA 로 렌더. 합친 개체가 *민둥 구가 아니라* 원래 윤곽으로 그려진다.
//   design/merge-dna.md §4 M3. 0062 는 합친 개체를 단색 원으로 그렸다(DNA 팔레트). 이 step 은 그 shapeHash 로
//   세계 사전에서 형태를 꺼내(reconstructShape) *구성원 점 무리(L·직선·삼각 윤곽)*로 그린다 = "큰 원이 지형
//   모양으로 돌아온다". 같은 모양=같은 윤곽·같은 색(DNA). 4 패널(시간)·top-down. PNG=tools/htj-capture.js.
//   실행: node HTJ/steps/step_0063/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const DNA = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const SS = 2.4, sr = 1.2;
const L = [[0, 0], [1, 0], [2, 0], [2, 1]], LINE = [[0, 0], [1, 0], [2, 0], [3, 0]], TRI = [[0, 0], [1, 0], [0.5, 1]];
function mk(cx, cy) { return { cx, cy, cz: 0, mass: 100, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalKE: 0, internalE: 5, energy: 5, cells: 100, radius: sr, temp: 0, peak: 1 }; }
function cluster(shape, ox, oy) { return shape.map(([x, y]) => mk(ox + x * SS, oy + y * SS)); }
function build() {
  return [].concat(cluster(L, 8, 10), cluster(L, 30, 10), cluster(L, 52, 10),
    cluster(LINE, 8, 34), cluster(LINE, 34, 34), cluster(TRI, 12, 54), cluster(TRI, 40, 54));
}

const wdict = {};
const mopt = { dwell: 3, vSettle: 0.1, vstick: 0.5, pad: 0.6, tagMerge: (mem) => DNA.registerShape(wdict, mem) };
const ropt = { quantum: 0.25, spread: 1.1, subScale: 0.62 };   // 윤곽 가독: 점 펼침·sub 크기

const Nc = 64;
function hsv(u) {
  const h = u * 6, c = 235, x = c * (1 - Math.abs(h % 2 - 1)); let r, g, b;
  if (h < 1) [r, g, b] = [c, x, 0]; else if (h < 2) [r, g, b] = [x, c, 0]; else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c]; else if (h < 5) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [(r + 20) | 0, (g + 20) | 0, (b + 20) | 0];
}
function snap(es) {
  const pts = [];
  for (const e of es) {
    const shape = DNA.reconstructShape(e, wdict, ropt);        // shapeHash → 원래 윤곽(점 무리) · 없으면 null
    if (shape) { const v = DNA.hashToUnit(e.shapeHash); for (const p of shape) pts.push({ cx: p.cx, cy: p.cy, r: p.r, v }); }  // 윤곽·색=DNA
    else pts.push({ cx: e.cx, cy: e.cy, r: sr, v: -1 });       // 병합 전 알=회색
  }
  return { pts };
}
let es = build();
const marks = [1, 2, 4, 10], frames = [];
let counts = [];
for (let s = 1; s <= 10; s++) {
  es = En.coalesceSettled(es, 1, mopt).entities;
  if (marks.includes(s)) { frames.push(snap(es)); counts.push(es.length); }
}
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N: Nc, color: (v) => v < 0 ? [70, 76, 92] : hsv(v) });

const K = Object.keys(wdict).length;
// 마지막 프레임의 그려진 점 수 = 합친 개체들의 구성원 수 합(민둥 구면 7, 윤곽이면 26).
const drawnPts = frames[frames.length - 1].pts.length;
const ok = fs.existsSync(outPath) && es.length === 7 && K === 3 && drawnPts === 26;
console.log('\n=== 눈 검증: M3 DNA 로 렌더(합친 개체가 원래 윤곽으로 — 민둥 구 아님) ===');
console.log(`  클러스터 7개(L 3·직선 2·삼각 2) → 병합. 개체 수: ${counts.join(' → ')}`);
console.log(`  합친 개체를 shapeHash→사전→윤곽으로 그림: 마지막 프레임 점 ${drawnPts}개(=구성원 합·민둥 구면 7개일 것)`);
console.log(`  같은 모양=같은 윤곽·같은 색(L 윤곽 ×3 크림슨·직선 ×2 마젠타·삼각 ×2 초록)·사전 K=${K}종`);
console.log('  4 패널: 회색 알 → 정착 → 합쳐지며 *원래 윤곽*으로(큰 원 아님=지형 모양 복원)');
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 합친 개체가 민둥 구가 아니라 원래 윤곽으로 그려진다' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

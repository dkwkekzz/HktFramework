// step_0062/capture.js — 눈 검증: M2 형태 DNA. 같은 모양 클러스터는 합쳐지면 같은 hash(=같은 색),
//   다른 모양은 다른 색 → "형태 DNA 팔레트". design/merge-dna.md §4 M2. 여러 클러스터(L 3개·직선 2개·삼각 2개)가
//   제자리서 정착→병합되며, 합친 개체를 shapeHash(hashToUnit)로 색칠한다 → 같은 모양=같은 색(dedup·K≪N).
//   4 패널(시간)·top-down(x-y). 회색 작은 알=병합 전·색 큰 원=합친 개체(색=형태 DNA). PNG=tools/htj-capture.js.
//   실행: node HTJ/steps/step_0062/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const DNA = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const SS = 2.4, sr = 1.2;                                       // 클러스터 내 간격·구체 반경(닿음)
const L = [[0, 0], [1, 0], [2, 0], [2, 1]], LINE = [[0, 0], [1, 0], [2, 0], [3, 0]], TRI = [[0, 0], [1, 0], [0.5, 1]];
function mk(cx, cy) { return { cx, cy, cz: 0, mass: 100, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalKE: 0, internalE: 5, energy: 5, cells: 100, radius: sr, temp: 0, peak: 1 }; }
function cluster(shape, ox, oy) { return shape.map(([x, y]) => mk(ox + x * SS, oy + y * SS)); }
// 클러스터 배치: L 3개·직선 2개·삼각 2개 = 7 클러스터 → 합치면 7 개체·형태 3종(K=3).
function build() {
  let es = [];
  es = es.concat(cluster(L, 8, 10), cluster(L, 30, 10), cluster(L, 52, 10));
  es = es.concat(cluster(LINE, 8, 34), cluster(LINE, 34, 34));
  es = es.concat(cluster(TRI, 12, 54), cluster(TRI, 40, 54));
  return es;
}

const wdict = {};                                              // 세계 형태 사전(dedup)
const mopt = { dwell: 3, vSettle: 0.1, vstick: 0.5, pad: 0.6, tagMerge: (mem) => DNA.registerShape(wdict, mem) };

const Nc = 64;
// 형태 DNA → 뚜렷이 구별되는 hue(HSV) — 같은 hash=같은 색·다른 hash=다른 색(heat 와 달리 고채도 전 스펙트럼).
function hsv(u) {
  const h = u * 6, c = 235, x = c * (1 - Math.abs(h % 2 - 1)); let r, g, b;
  if (h < 1) [r, g, b] = [c, x, 0]; else if (h < 2) [r, g, b] = [x, c, 0]; else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c]; else if (h < 5) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [(r + 20) | 0, (g + 20) | 0, (b + 20) | 0];
}
function snap(es) {
  const pts = [];
  for (const e of es) {
    const merged = typeof e.shapeHash === 'string';
    pts.push({ cx: e.cx, cy: e.cy, r: merged ? e.radius : sr, v: merged ? DNA.hashToUnit(e.shapeHash) : -1 });   // v=DNA(0..1)·병합 전=-1
  }
  return { pts };
}
let es = build();
const marks = [1, 2, 4, 10], frames = [];
let counts = [];
for (let s = 1; s <= 10; s++) {
  es = En.coalesceSettled(es, 1, mopt).entities;               // 정지·닿음 → dwell 후 제자리 병합
  if (marks.includes(s)) { frames.push(snap(es)); counts.push(es.length); }
}
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N: Nc, color: (v) => v < 0 ? [70, 76, 92] : hsv(v) });   // 병합 전=회색·합친 개체=DNA hue

const K = Object.keys(wdict).length;
const ok = fs.existsSync(outPath) && counts[0] > 7 && es.length === 7 && K === 3;
console.log('\n=== 눈 검증: M2 형태 DNA 팔레트(같은 모양=같은 hash=같은 색·K≪N) ===');
console.log(`  클러스터 7개(L 3·직선 2·삼각 2) → 제자리 정착·병합. 개체 수: ${counts.join(' → ')}`);
console.log(`  세계 형태 사전 K=${K}종(L·직선·삼각) ≪ 합친 개체 N=${es.length}개 = dedup`);
console.log('  합친 개체 색 = shapeHash(DNA) → 같은 모양끼리 같은 색(L 3개 동색·직선 2개 동색·삼각 2개 동색)');
console.log('  4 패널: 회색 알들 → 정착 → 형태별 색으로 병합(형태 DNA 팔레트)');
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 같은 모양은 같은 DNA(색)로 합쳐지고 사전은 K종만(K≪N)' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

// step_0061/capture.js — 눈 검증: M1 신뢰성 병합. 닿아 정착한 알맹이들이 한 개체로 coalesce(수박게임).
//   design/merge-dna.md §4 M1. 지면(앵커) 위로 작은 구체 16알이 떨어져 — 접촉(0037)으로 쌓이고 정착한 뒤,
//   `coalesceSettled` 가 정착(dwell)한 인접 덩어리를 *한 개체*로 합친다(반경↑·수박게임). "복잡한 알맹이
//   클러스터"가 큰 개체로 정리된다. 4 패널(시간 경과)·x-z 단면. 색=크기 tier(작은 알=파랑·합친 큰 개체=노랑).
//   PNG=tools/htj-capture.js. 실행: node HTJ/steps/step_0061/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const GR = 10, sr = 1.2;
const gopt = { G: 5e-6, soft: 2 }, copt = { k: 15, cDamp: 40 }, fopt = { k: 15, mu: 0.9 };
const mopt = { dwell: 40, vSettle: 0.25, vstick: 0.6, pad: 0.6 };
function mk(cx, cy, cz, m, r, anc) { return { cx, cy, cz, mass: m, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalKE: 0, internalE: 5, energy: 5, cells: (4 * Math.PI / 3) * r * r * r, radius: r, temp: 0, peak: 1, anchored: !!anc }; }
function build() {
  const es = [mk(0, 0, 0, 1e6, GR, true)];                     // 지면(앵커)
  const gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 16; i++) { const yf = (i + 0.5) / 16, rr = Math.sqrt(Math.max(0, 1 - yf * yf)), th = gold * i;
    es.push(mk(Math.cos(th) * rr * 5, Math.sin(th) * rr * 5, GR + 5 + (i % 6) * 0.7, 100, sr)); }
  return es;
}

// x-z 단면(옆에서) — 지면=어둡게·구체 색=크기 tier(반경 sr..3*sr → 0.15..1).
const Nc = 56, OX = Nc / 2, OZb = Nc * 0.62, sc = Nc * 0.85 / 28;
function snap(es) {
  const pts = [];
  for (const e of es) {
    if (Math.abs(e.cy) > 5) continue;                          // 가운데 단면만
    const tier = e.anchored ? 0.08 : Math.max(0.15, Math.min(1, (e.radius - sr) / (2 * sr) * 0.85 + 0.15));
    pts.push({ cx: OX + e.cx * sc, cy: OZb - (e.cz - GR) * sc, r: e.anchored ? GR * sc * 1.0 : Math.max(0.8, e.radius * sc * 1.5), v: tier });
  }
  return { pts };
}
let es = build();
const saved = es.map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz }));
const marks = [1, 800, 2500, 6000], frames = [];
let counts = [];
for (let s = 1; s <= 6000; s++) {
  En.applyEntityGravity(es, 0.02, gopt); En.applyEntityContact(es, 0.02, copt); En.applyEntityFriction(es, 0.02, fopt);
  En.stepEntities(es, 0.02);
  es = En.coalesceSettled(es, 0.02, mopt).entities;
  for (let i = 0; i < es.length; i++) if (es[i].anchored) { es[i].cx = saved[i].cx; es[i].cy = saved[i].cy; es[i].cz = saved[i].cz; es[i].px = es[i].py = es[i].pz = 0; }
  if (marks.includes(s)) { frames.push(snap(es)); counts.push(es.filter(e => !e.anchored).length); }
}
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N: Nc });

const free = es.filter(e => !e.anchored);
const maxR = Math.max(...free.map(e => e.radius));
const ok = fs.existsSync(outPath) && counts[0] === 16 && free.length < 4 && maxR > 2 * sr;
console.log('\n=== 눈 검증: M1 신뢰성 병합(정착한 알맹이들이 한 개체로 coalesce·수박게임) ===');
console.log(`  지면(앵커) 위 작은 구체 16알 → 쌓여 정착 → 합쳐짐. 개체 수: ${counts.join(' → ')}`);
console.log(`  합친 개체 최대 반경 ${maxR.toFixed(2)}(시작 ${sr}=작은 알·↑=수박게임 큰 개체)`);
console.log('  4 패널: 16알이 떨어져 → 쌓이고 → 정착해 합쳐지며 → 큰 개체로(색=크기 tier·파랑 작음→노랑 큼)');
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 정착한 알맹이들이 한 개체로 coalesce(복잡 클러스터→큰 개체)' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);

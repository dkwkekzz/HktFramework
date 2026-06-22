// step_0030/capture.js — 눈 검증(engine 직접 PNG): 안정 별이 *자동으로* 개체(구체)로 승격된다.
//
//   별이 중력으로 붕괴·정착하면, 활동도 추적기(0025)가 그 코어 블록을 *동결*(안정)로 판정 → 자동 승격
//   (0026)이 코어를 격자에서 빼내 개체 1개로 올린다. 0026 이 *explicit* 승격이었다면, 이건 *자동 트리거*
//   (동결→승격)다. 좌: 승격 전(별 코어 = 셀로 가득) · 우: 자동 승격 후(코어 빠져 구멍 + 개체 구체 1개,
//   주변 가스는 유체로 남음) = 사용자가 본 "안정 별=구체 개체로 시뮬·나머지 가스만 유체로".
//
//   정직한 발견: 단일 자기중력 블롭은 거친 격자에서 *계속 미세 진동*(breathing)해 exact-quiet 동결이 잘
//   안 걸린다 → 손실 허용 임계(threshold>0=근사 LOD·design §5)로 "거의 안 변함"을 동결로 봐야 코어가 올라간다.
//
//   실행: node HTJ/steps/step_0030/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const In = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));
const Ac = require(path.resolve(__dirname, '../../engine/htj-activity.js'));
const Hy = require(path.resolve(__dirname, '../../engine/htj-hybrid.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
function heat(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; const f = t * 4, i = Math.min(3, f | 0), u = f - i, a = HEAT[i], b = HEAT[i + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }

const N = 32, BS = 8, DT = 0.2;
const w = W.createWorld(N); w.addField('therm');
for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
Th.seedWarmBlob(w, { sigma: N * 0.13, M0: 3000, T0: 1 });
const set = Sp.createActiveSet(N, BS), tr = Ac.createActivityTracker(N, BS);
const zc = N >> 1;
function sliceOf() { const s = new Float64Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) s[y * N + x] = w.fields.energy[(zc * N + y) * N + x]; return s; }

let sliceBefore = null, ent = null, promotedAt = -1, removed = 0, activeBefore = 0, activeAfter = 0;
for (let t = 0; t < 150; t++) {
  Gr.applyGravity(w, DT, { G: 0.15, iters: 40 }); Pr.applyPressure(w, DT, { K: 0.3, gamma: 2 });
  Th.applyThermalPressure(w, DT, { Kth: 0.2, gamma: 5 / 3 }); Vi.applyViscosity(w, DT, { Kvisc: 1.5 });
  In.advect(w, DT, { scalars: ['therm'] });
  set.rebuildFromField(w.fields.energy);
  const mean = w.total('energy') / w.fields.energy.length;
  tr.measure(w.fields.energy, set.origins(), { threshold: mean * 2 });  // 손실 허용 임계(근사 LOD)
  if (t > 40) {
    const eps = Math.max(mean * 1.5, 1e-9);
    sliceBefore = sliceOf();
    activeBefore = Hy.activeCellCount(w);
    const res = Hy.autoPromoteStable(w, tr, { hold: 4, eps });   // 동결 코어 자동 승격
    if (res.promoted > 0) { ent = res.entities[0]; promotedAt = t; removed = res.removedCells; activeAfter = Hy.activeCellCount(w); break; }
  }
}
const sliceAfter = sliceOf();
let emax = 0; for (let i = 0; i < sliceBefore.length; i++) if (sliceBefore[i] > emax) emax = sliceBefore[i];

const cellPx = 9, panel = N * cellPx, gap = 40, pad = 24;
const Wd = pad * 2 + panel * 2 + gap, Hd = pad + 30 + panel + 50;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
function fillCell(px0, py0, r, g, b) { for (let dy = 0; dy < cellPx; dy++) for (let dx = 0; dx < cellPx; dx++) px(px0 + dx, py0 + dy, r, g, b); }
function ring(cx, cy, rad, r, g, b) { for (let a = 0; a < 360; a += 1) { px(cx + rad * Math.cos(a * Math.PI / 180), cy + rad * Math.sin(a * Math.PI / 180), r, g, b); } }
function drawSlice(ox, oy, slice) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = slice[y * N + x]; const c = v > 1e-9 ? heat(v / (emax || 1)) : [18, 20, 28]; fillCell(ox + x * cellPx, oy + y * cellPx, c[0] | 0, c[1] | 0, c[2] | 0); } }
const oxL = pad, oxR = pad + panel + gap, oy = pad + 30;
drawSlice(oxL, oy, sliceBefore);
drawSlice(oxR, oy, sliceAfter);
if (ent) { const cx = oxR + ent.cx * cellPx + cellPx / 2, cy = oy + ent.cy * cellPx + cellPx / 2, rp = Math.max(ent.radius, 1.5) * cellPx; ring(cx, cy, rp, 245, 245, 255); ring(cx, cy, rp - 1, 245, 245, 255); }

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

console.log('\n=== 눈 검증: 안정 별이 *자동으로* 개체(구체)로 승격된다(동결→승격) ===');
console.log(`    별 붕괴·정착 → step ${promotedAt} 에 코어 블록 동결 판정 → 자동 승격(explicit 아님).`);
console.log(`    좌(승격 전): 별 코어 셀로 가득 → 우(자동 승격 후): 코어 빠져 구멍 + 개체 구체 1개(흰 링, r=${ent ? ent.radius.toFixed(2) : 'NA'}), 주변 가스 유체로 남음`);
console.log(`    레버2 실현: 활성 칸 ${activeBefore} → ${activeAfter} (−${activeBefore - activeAfter} = 코어 ${removed}칸이 개체로)`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = pngOk && ent && removed > 100 && activeAfter === activeBefore - removed;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

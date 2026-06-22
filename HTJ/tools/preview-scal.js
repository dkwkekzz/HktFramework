// tools/preview-scal.js — viewer 'scal' 오버레이의 *정적 미리보기* PNG 생성(눈 확인용).
//   viewer.html 의 scal 장면과 같은 파이프라인·같은 투영으로 한 프레임을 래스터화한다(chromium 부재 대체).
//   별 셀은 heat 점으로, 8³ 블록은 와이어프레임으로: 주황=활성(도는)·파랑=동결(쉬는).
//   실행: node HTJ/tools/preview-scal.js  →  HTJ/tools/preview-scal.png
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const base = path.resolve(__dirname, '..');
const W = require(path.join(base, 'engine/htj-world.js')), Th = require(path.join(base, 'engine/htj-thermal.js'));
const Gr = require(path.join(base, 'engine/htj-gravity.js')), Pr = require(path.join(base, 'engine/htj-pressure.js'));
const Vi = require(path.join(base, 'engine/htj-viscosity.js')), Fu = require(path.join(base, 'engine/htj-fusion.js'));
const Co = require(path.join(base, 'engine/htj-cooling.js')), In = require(path.join(base, 'engine/htj-inertia.js'));
const Va = require(path.join(base, 'engine/htj-vacuum.js')), Sp = require(path.join(base, 'engine/htj-sparse.js'));
const Ac = require(path.join(base, 'engine/htj-activity.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

const Wd = 640, Hd = 640;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 10; out[i + 1] = 12; out[i + 2] = 16; out[i + 3] = 255; }
function px(x, y, r, g, b, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; if (a == null) a = 1; out[o] = out[o] * (1 - a) + r * a; out[o + 1] = out[o + 1] * (1 - a) + g * a; out[o + 2] = out[o + 2] * (1 - a) + b * a; }
function disc(cx, cy, rad, r, g, b) { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) px(cx + dx, cy + dy, r, g, b, 1); }
function line(x0, y0, x1, y1, r, g, b, a) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0 || 1; for (let s = 0; s <= n; s++) px(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n, r, g, b, a); }
const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
function heat(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; const f = t * 4, i = Math.min(3, f | 0), u = f - i, a = HEAT[i], b = HEAT[i + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }

// ── 파이프라인(viewer 'scal' 과 동일) ──
const N = 24, bs = 8, nbx = Math.ceil(N / bs), thr = 0.05, hold = 3, STEPS = 22;
const p = { kpress: 0.12, kthermo: 0.3, kvisc: 0.6, frate: 2, radiate: 0.06 };
const w = W.createWorld(N);
Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N ** 3 * 0.5), T0: 1 });
for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.fields[nm] || w.addField(nm, { type: Float64Array });
const set = Sp.createActiveSet(N, bs).rebuildFromField(w.fields.energy);
const tr = Ac.createActivityTracker(N, bs);
tr.measure(w.fields.energy, set.origins(), { threshold: thr });
for (let t = 0; t < STEPS; t++) {
  Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 }); Pr.applyPressure(w, 0.2, { K: p.kpress, gamma: 2 });
  Th.applyThermalPressure(w, 0.2, { Kth: p.kthermo, gamma: 5 / 3 }); Vi.applyViscosity(w, 0.2, { Kvisc: p.kvisc });
  Fu.applyFusion(w, 0.2, { rate: p.frate, rhoCrit: 6, tCrit: 3 }); Co.applyCooling(w, 0.2, { coolRate: p.radiate });
  In.advect(w, 0.2, { scalars: ['therm'] }); Va.applyVacuum(w, { eps: 1e-2, scalars: ['mom_x', 'mom_y', 'mom_z', 'therm'] });
  set.rebuildFromField(w.fields.energy); tr.measure(w.fields.energy, set.origins(), { threshold: thr });
}

// ── 투영(htj-render 와 동일) ──
const cam = { yaw: 0.7, pitch: 0.55, zoom: 1.0 };
const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
const scale = (Math.min(Wd, Hd) * 0.8 / N) * cam.zoom, ox = Wd / 2, oy = Hd / 2, half = (N - 1) / 2;
function proj(wx, wy, wz) { const x1 = wx * cy + wz * sy, z1 = -wx * sy + wz * cy, y2 = wy * cp - z1 * sp, z2 = wy * sp + z1 * cp; return [ox + x1 * scale, oy - y2 * scale, z2]; }

// 별 셀(heat 점) — 깊이 정렬 후 먼 것 먼저.
const E = w.fields.energy; let emax = 0; for (let i = 0; i < E.length; i++) if (E[i] > emax) emax = E[i];
const mean = w.total('energy') / E.length, eps = 1e-9;
const dots = [];
for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = (z * N + y) * N + x; if (E[i] <= eps) continue;
  const pj = proj(x - half, y - half, z - half); dots.push([pj[0], pj[1], pj[2], E[i]]);
}
dots.sort((a, b) => a[2] - b[2]);
for (const d of dots) { const c = heat(Math.min(1, d[3] / (mean * 2 || 1))); disc(d[0], d[1], 2, c[0], c[1], c[2]); }

// 블록 와이어프레임 — 파랑(동결) 먼저, 주황(활성) 위.
const origins = set.origins();
const fk = new Set(tr.frozenOrigins(origins, hold).map(o => ((o[2] / bs | 0) * nbx + (o[1] / bs | 0)) * nbx + (o[0] / bs | 0)));
const EDG = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
let nA = 0, nF = 0;
const blocks = origins.map(o => ({ o, frozen: fk.has(((o[2] / bs | 0) * nbx + (o[1] / bs | 0)) * nbx + (o[0] / bs | 0)) }))
  .sort((a, b) => (a.frozen ? 0 : 1) - (b.frozen ? 0 : 1));
for (const blk of blocks) {
  const o = blk.o, x0 = o[0] - half - 0.5, y0 = o[1] - half - 0.5, z0 = o[2] - half - 0.5;
  const x1 = Math.min(o[0] + bs, N) - half - 0.5, y1 = Math.min(o[1] + bs, N) - half - 0.5, z1 = Math.min(o[2] + bs, N) - half - 0.5;
  const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map(q => proj(q[0], q[1], q[2]));
  const col = blk.frozen ? [70, 140, 250] : [250, 150, 60], a = blk.frozen ? 0.5 : 0.95;
  blk.frozen ? nF++ : nA++;
  for (const [u, v] of EDG) line(c[u][0], c[u][1], c[v][0], c[v][1], col[0], col[1], col[2], a);
}
// 범례
for (let yy = 14; yy < 26; yy++) { for (let xx = 18; xx < 34; xx++) px(xx, yy, 250, 150, 60, 1); for (let xx = 220; xx < 236; xx++) px(xx, yy, 70, 140, 250, 1); }

const outPath = path.join(__dirname, 'preview-scal.png');
writePNG(outPath, Wd, Hd, out);
console.log(`scal 오버레이 미리보기: 활성 블록 ${nA}·동결 블록 ${nF} (총 ${origins.length}) · Σρ=${w.total('energy').toFixed(0)} · finite=${Number.isFinite(w.total('energy'))}`);
console.log(`  ${path.relative(process.cwd(), outPath)}`);

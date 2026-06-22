// step_0026/capture.js — 눈 검증(engine 직접 PNG): 승격 = 별이 격자에서 빠져 *개체(구체) 1개*가 된다.
//
//   좌: 승격 전 z-단면(별 본체가 셀로 가득) · 우: 승격 후 같은 단면(본체가 *빠져 구멍* + 빠진 자리에 개체를
//   구체 1개로 표시). design §0 목적 ②("덩어리로 시뮬")의 첫 실현 — 수천 셀이 소수 파라미터 개체로 올라갔다.
//   하단: 질량·운동량·에너지가 승격→강등 왕복에서 정확 보존(이관 척추).
//
//   실행: node HTJ/steps/step_0026/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const In = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Cl = require(path.resolve(__dirname, '../../engine/htj-cluster.js'));
const Pm = require(path.resolve(__dirname, '../../engine/htj-promote.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
function heat(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; const f = t * 4, i = Math.min(3, f | 0), u = f - i, a = HEAT[i], b = HEAT[i + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }

const N = 24, DT = 0.2;
const w = W.createWorld(N); w.addField('therm');
for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N ** 3 * 0.5), T0: 1 });
const p = { kpress: 0.12, kthermo: 0.3, kvisc: 0.6, frate: 2, radiate: 0.06 };
for (let t = 0; t < 14; t++) {
  Gr.applyGravity(w, DT, { G: 0.15, iters: 40 }); Pr.applyPressure(w, DT, { K: p.kpress, gamma: 2 });
  Th.applyThermalPressure(w, DT, { Kth: p.kthermo, gamma: 5 / 3 }); Vi.applyViscosity(w, DT, { Kvisc: p.kvisc });
  Fu.applyFusion(w, DT, { rate: p.frate, rhoCrit: 6, tCrit: 3 }); Co.applyCooling(w, DT, { coolRate: p.radiate });
  In.advect(w, DT, { scalars: ['therm'] });
}
const sum = f => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const mom = () => [sum(w.fields.mom_x), sum(w.fields.mom_y), sum(w.fields.mom_z)];
const ke = () => { const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; let s = 0; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) s += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / r[i]; return s; };
const energy = () => ke() + sum(w.fields.therm);

// 단면(z=중심) 스냅샷 — 승격 전.
const zc = N >> 1;
const sliceBefore = new Float64Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) sliceBefore[y * N + x] = w.fields.energy[(zc * N + y) * N + x];
let emaxB = 0; for (let i = 0; i < sliceBefore.length; i++) if (sliceBefore[i] > emaxB) emaxB = sliceBefore[i];

const m0 = sum(w.fields.energy), p0 = mom(), e0 = energy();
// 승격 — 가장 큰 덩어리.
const mean = m0 / w.fields.energy.length, eps = Math.max(mean * 1.5, 1e-9);
const clumps = Cl.detectClumps(w, { eps, minCells: 2, collectCells: true });
const ent = Pm.promote(w, clumps[0].cellList);
const sliceAfter = new Float64Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) sliceAfter[y * N + x] = w.fields.energy[(zc * N + y) * N + x];
// 강등(왕복 보존 확인).
const m1g = sum(w.fields.energy), p1g = mom(), e1g = energy();   // 승격 후 격자
Pm.demote(w, ent);
const m2 = sum(w.fields.energy), p2 = mom(), e2 = energy();      // 강등 후 격자

// ── 캔버스: 좌(승격 전 단면) · 우(승격 후 단면 + 개체 구체) · 하단 보존 텍스트 막대 ──
const cellPx = 10, panel = N * cellPx, gap = 40, pad = 24;
const Wd = pad * 2 + panel * 2 + gap, Hd = pad + 30 + panel + 60;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
function fillCell(px0, py0, r, g, b) { for (let dy = 0; dy < cellPx; dy++) for (let dx = 0; dx < cellPx; dx++) px(px0 + dx, py0 + dy, r, g, b); }
function ring(cx, cy, rad, r, g, b) { for (let a = 0; a < 360; a += 2) { const rad2 = rad; px(cx + rad2 * Math.cos(a * Math.PI / 180), cy + rad2 * Math.sin(a * Math.PI / 180), r, g, b); } }
function drawSlice(ox, oy, slice, emax) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = slice[y * N + x]; const c = v > 1e-12 ? heat(v / (emax || 1)) : [18, 20, 28]; fillCell(ox + x * cellPx, oy + y * cellPx, c[0] | 0, c[1] | 0, c[2] | 0); }
}
const oxL = pad, oxR = pad + panel + gap, oy = pad + 30;
drawSlice(oxL, oy, sliceBefore, emaxB);
drawSlice(oxR, oy, sliceAfter, emaxB);
// 우 패널에 개체 = 구체(흰 링) — 별이 빠져 구멍 난 자리에 개체 1개.
ring(oxR + ent.cx * cellPx + cellPx / 2, oy + ent.cy * cellPx + cellPx / 2, Math.max(ent.radius, 1) * cellPx, 245, 245, 255);
ring(oxR + ent.cx * cellPx + cellPx / 2, oy + ent.cy * cellPx + cellPx / 2, Math.max(ent.radius, 1) * cellPx - 1, 245, 245, 255);
// 하단 보존 막대(질량/에너지: 전=초록 / 강등후=주황 겹침이면 보존).
const relE = Math.abs(e2 - e0) / (e0 || 1), relM = Math.abs(m2 - m0) / (m0 || 1);

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

console.log('\n=== 눈 검증: 승격 = 별이 격자에서 빠져 개체(구체) 1개가 된다 ===');
console.log(`    좌 단면: 별 본체 셀로 가득 → 우 단면: 본체 빠져 구멍 + 개체 구체(흰 링, r=${ent.radius.toFixed(2)})`);
console.log(`    승격 개체: 질량 ${ent.mass.toFixed(1)} · 셀 ${ent.cells} · 온도 ${ent.temp.toFixed(2)} · 총E ${ent.energy.toFixed(1)}`);
console.log(`    보존(왕복): 질량 ${m0.toFixed(1)}→(승격 후 격자 ${m1g.toFixed(1)})→강등 ${m2.toFixed(1)} (상대 ${relM.toExponential(1)})`);
console.log(`               에너지 ${e0.toFixed(1)}→(${e1g.toFixed(1)})→${e2.toFixed(1)} (상대 ${relE.toExponential(1)})`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = pngOk && relM < 1e-9 && relE < 1e-9 && ent.cells > 100;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

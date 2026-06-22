// step_0031/capture.js — 눈 검증(engine 직접 PNG): 충돌한 개체가 *자동으로* 유체로 풀린다(역승격).
//
//   두 개체(승격된 별)가 가까워져 접촉하면, autoDemoteOnDisturbance 가 둘을 다시 격자 유체로 강등한다 —
//   0030 의 자동 *승격*(동결→개체)의 역(충돌→유체). 좌: 강등 전(개체 구체 2개, 격자 비어 있음) ·
//   우: 강등 후(격자에 유체 덩어리 2개 = 셀로 풀림, 개체 0개). 레버2 의 왕복(승격↔강등)이 자동으로 닫힌다.
//
//   실행: node HTJ/steps/step_0031/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Hy = require(path.resolve(__dirname, '../../engine/htj-hybrid.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
function heat(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; const f = t * 4, i = Math.min(3, f | 0), u = f - i, a = HEAT[i], b = HEAT[i + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }

const N = 24;
const w = W.createWorld(N); w.addField('therm');
for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
function ent(cx, mass, r) { const KEcm = 0; return { cx, cy: 12, cz: 12, mass, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm, internalE: mass * 0.5, energy: mass * 0.5, radius: r, temp: 1, peak: 1, cells: Math.round(4 / 3 * Math.PI * r * r * r) }; }
let entities = [ent(9, 120, 3), ent(15, 120, 3)];   // 거리 6, r+r+pad=3+3+1=7 → 접촉(충돌)

const zc = N >> 1;
function slice() { const s = new Float64Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) s[y * N + x] = w.fields.energy[(zc * N + y) * N + x]; return s; }
const before = entities.map(e => ({ cx: e.cx, cy: e.cy, r: e.radius }));   // 강등 전 개체 위치
const res = Hy.autoDemoteOnDisturbance(w, entities, { contactPad: 1 });
const after = slice();
let emax = 0; for (let i = 0; i < after.length; i++) if (after[i] > emax) emax = after[i];

const cellPx = 11, panel = N * cellPx, gap = 40, pad = 24;
const Wd = pad * 2 + panel * 2 + gap, Hd = pad + 30 + panel + 50;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
function fillCell(px0, py0, r, g, b) { for (let dy = 0; dy < cellPx; dy++) for (let dx = 0; dx < cellPx; dx++) px(px0 + dx, py0 + dy, r, g, b); }
function box(ox, oy) { for (let x = 0; x <= panel; x++) { px(ox + x, oy, 42, 50, 66); px(ox + x, oy + panel, 42, 50, 66); } for (let y = 0; y <= panel; y++) { px(ox, oy + y, 42, 50, 66); px(ox + panel, oy + y, 42, 50, 66); } }
function disc(ox, oy, cx, cy, rad, col) { const sx = ox + cx * cellPx, sy = oy + cy * cellPx, rp = rad * cellPx, r2 = rp * rp; for (let dy = -rp; dy <= rp; dy++) for (let dx = -rp; dx <= rp; dx++) { const d2 = dx * dx + dy * dy; if (d2 > r2) continue; const f = 0.45 + 0.55 * (1 - Math.sqrt(d2) / rp); px(sx + dx, sy + dy, (col[0] * f) | 0, (col[1] * f) | 0, (col[2] * f) | 0); } }
const oxL = pad, oxR = pad + panel + gap, oy = pad + 30;
// 좌: 강등 전 = 개체 구체 2개(격자 빈 다크).
box(oxL, oy);
for (const e of before) disc(oxL, oy, e.cx, e.cy, e.r, [250, 200, 120]);
// 우: 강등 후 = 격자 유체 슬라이스(셀로 풀림).
box(oxR, oy);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = after[y * N + x]; if (v > 1e-9) { const c = heat(v / (emax || 1)); fillCell(oxR + x * cellPx, oy + y * cellPx, c[0] | 0, c[1] | 0, c[2] | 0); } }

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
let active = 0; for (let i = 0; i < w.fields.energy.length; i++) if (w.fields.energy[i] !== 0) active++;
console.log('\n=== 눈 검증: 충돌한 개체가 자동으로 유체로 풀린다(역승격·강등 트리거) ===');
console.log(`    두 개체(거리 6 < 접촉 7) 충돌 → autoDemoteOnDisturbance 가 둘 다 강등.`);
console.log(`    좌(강등 전): 개체 구체 2개(격자 빈) → 우(강등 후): 격자 유체 ${active}칸(셀로 풀림)·개체 ${res.survivors.length}개`);
console.log(`    강등 ${res.demoted}개 · 격자에 더해진 칸 ${res.addedCells} · Σ질량 ${w.total('energy').toFixed(1)}`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = pngOk && res.demoted === 2 && res.survivors.length === 0 && active > 100;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

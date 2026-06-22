// step_0033/capture.js — 눈 검증(engine 직접 PNG): 개체↔유체 결합 중력 — 서로를 향한 가속(속도장).
//
//   무거운 승격 개체(구체) + 유체 가스 덩어리에 통합 중력(applyUnifiedGravity) 한 스텝을 가한 *직후*의
//   유체 속도장을 본다 — 화살표가 모두 개체 쪽을 가리킨다(유체가 개체를 느낌). 개체는 유체 쪽으로 운동량을
//   얻는다(개체가 유체를 느낌·빨간 화살표). = 0028(개체끼리)·격자 Poisson(유체끼리)이 놓친 *개체↔유체*
//   결합을 0032 트리로 채움 = 레버2 완전 실현(개체와 유체가 한 무대에서 서로 끈다·design §3). 시간 전개의
//   조석 전단 없이 *순간 가속 방향*만 보여 결합을 또렷이 — verify 의 작용-반작용을 화살표로 확인.
//
//   실행: node HTJ/steps/step_0033/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Hy = require(path.resolve(__dirname, '../../engine/htj-hybrid.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

const N = 28, DT = 0.5;
const w = W.createWorld(N); w.addField('therm');
for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
const gcx = 19, gcy = 14, gcz = 14, grad = 4;
for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x - gcx, dy = y - gcy, dz = z - gcz; if (dx * dx + dy * dy + dz * dz <= grad * grad) { const i = (z * N + y) * N + x; w.fields.energy[i] = 6; w.fields.therm[i] = 3; } }
const ent = { cx: 7, cy: 14, cz: 14, mass: 800, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalE: 50, energy: 50, radius: 2.8, temp: 1, peak: 1, cells: 90 };
// 통합 중력 한 스텝 — 속도장(가속 방향)만 본다(시간 전개 X).
Hy.applyUnifiedGravity(w, [ent], { G: 1, soft: 3, theta: 0.4, dt: DT });

const zc = gcz;
const cellPx = 16, panel = N * cellPx, pad = 26;
const Wd = pad * 2 + panel, Hd = pad + 34 + panel + 30;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; const al = a == null ? 1 : a; out[o] = (out[o] * (1 - al) + r * al) | 0; out[o + 1] = (out[o + 1] * (1 - al) + g * al) | 0; out[o + 2] = (out[o + 2] * (1 - al) + b * al) | 0; }
function line(x0, y0, x1, y1, r, g, b) { const dx = x1 - x0, dy = y1 - y0, st = Math.max(1, Math.ceil(Math.hypot(dx, dy))); for (let s = 0; s <= st; s++) px(x0 + dx * s / st, y0 + dy * s / st, r, g, b); }
function arrow(cx, cy, vx, vy, col, hl) { const L = Math.hypot(vx, vy); if (L < 0.3) return; const ex = cx + vx, ey = cy + vy; line(cx, cy, ex, ey, col[0], col[1], col[2]); const ang = Math.atan2(vy, vx), ah = hl || 3; line(ex, ey, ex - ah * Math.cos(ang - 0.5), ey - ah * Math.sin(ang - 0.5), col[0], col[1], col[2]); line(ex, ey, ex - ah * Math.cos(ang + 0.5), ey - ah * Math.sin(ang + 0.5), col[0], col[1], col[2]); }
function disc(cx, cy, rad, col) { const r2 = rad * rad; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const d2 = dx * dx + dy * dy; if (d2 > r2) continue; const f = 0.5 + 0.5 * (1 - Math.sqrt(d2) / rad); px(cx + dx, cy + dy, (col[0] * f) | 0, (col[1] * f) | 0, (col[2] * f) | 0); } }
const ox = pad, oy = pad + 34;
for (let x = 0; x <= panel; x++) { px(ox + x, oy, 42, 50, 66); px(ox + x, oy + panel, 42, 50, 66); }
for (let y = 0; y <= panel; y++) { px(ox, oy + y, 42, 50, 66); px(ox + panel, oy + y, 42, 50, 66); }
// 유체 밀도(흐린 청) + 속도장 화살표(개체 쪽).
const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y;
let vmax = 1e-9; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) { const v = Math.hypot(gx[i] / r[i], gy[i] / r[i]); if (v > vmax) vmax = v; }
const sc = (cellPx * 1.4) / vmax;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = (zc * N + y) * N + x; if (r[i] <= 1e-12) continue;
  const sx = ox + (x + 0.5) * cellPx, sy = oy + (y + 0.5) * cellPx;
  px(sx, sy, 70, 110, 180, 0.7);
  arrow(sx, sy, (gx[i] / r[i]) * sc, (gy[i] / r[i]) * sc, [120, 200, 255]);
}
// 개체 = 구체 + 운동량 화살표(유체 쪽=+x).
const ecx = ox + (ent.cx + 0.5) * cellPx, ecy = oy + (ent.cy + 0.5) * cellPx;
disc(ecx, ecy, ent.radius * cellPx * 0.7, [250, 200, 120]);
for (let a = 0; a < 360; a += 1) px(ecx + ent.radius * cellPx * 0.7 * Math.cos(a * Math.PI / 180), ecy + ent.radius * cellPx * 0.7 * Math.sin(a * Math.PI / 180), 245, 245, 255);
const ev = Math.hypot(ent.px, ent.py) / ent.mass;
arrow(ecx, ecy, (ent.px / ent.mass) / (ev || 1) * cellPx * 3, (ent.py / ent.mass) / (ev || 1) * cellPx * 3, [250, 120, 90], 5);

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
// 유체 평균 속도 x(개체 쪽=−x) + 개체 운동량 x(유체 쪽=+x) 확인.
let avx = 0, cnt = 0; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) { avx += gx[i] / r[i]; cnt++; } avx /= cnt;
console.log('\n=== 눈 검증: 개체↔유체 결합 중력 — 서로를 향한 가속(속도장) ===');
console.log(`    무거운 개체(왼쪽 x=7) + 유체 가스(오른쪽 x≈19), 통합 중력 한 스텝 직후:`);
console.log(`    유체 평균 v_x ${avx.toFixed(3)} (−x=개체 쪽 화살표) · 개체 px ${ent.px.toFixed(1)} (+x=유체 쪽)`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = pngOk && avx < 0 && ent.px > 0;   // 유체→개체(−x)·개체→유체(+x) = 서로 끈다
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

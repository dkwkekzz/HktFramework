// step_0029/capture.js — 눈 검증(engine 직접 PNG): demote 의 회전 복원 — 균일(정지) vs 스핀(소용돌이).
//
//   같은 개체(P=0·Lz>0=순수 스핀)를 강등한다. 좌: spin off(기존 0026~0028) = 속도장 0(정지·화살표 없음).
//   우: spin on(이 step) = 기록된 각운동량 L 이 *강체 회전장*으로 복원 → 셀 속도가 중심 둘레로 *소용돌이*.
//   밀도(구)는 둘 다 같다(회전은 *속도*에 있음). z=중심 단면의 속도 화살표로 회전을 눈으로 본다.
//
//   실행: node HTJ/steps/step_0029/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Pm = require(path.resolve(__dirname, '../../engine/htj-promote.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

const N = 24;
const ent = { cx: 12, cy: 12, cz: 12, mass: 200, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 80, KEcm: 0, internalE: 500, energy: 500, radius: 4, temp: 1, cells: 200 };
function newWorld() { const w = W.createWorld(N); w.addField('therm'); for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array }); return w; }
const wU = newWorld(), wS = newWorld();
Pm.demote(wU, ent);                 // 균일(spin off) — P=0 이라 정지
Pm.demote(wS, ent, { spin: true }); // 회전 복원

// 격자 L(검증 공유).
function gridL(w) { const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; let m = 0, cx = 0, cy = 0, cz = 0; for (let i = 0; i < r.length; i++) { const v = r[i]; if (v === 0) continue; const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / (N * N); m += v; cx += v * x; cy += v * y; cz += v * z; } if (m > 1e-12) { cx /= m; cy /= m; cz /= m; } let Lz = 0; for (let i = 0; i < r.length; i++) { if (r[i] === 0) continue; const x = i % N, y = ((i - x) / N) % N; const rx = x - cx, ry = y - cy; Lz += rx * gy[i] - ry * gx[i]; } return Lz; }
const sum = f => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };

// ── 캔버스: 좌(균일=정지) · 우(회전=소용돌이) — z=중심 단면 밀도 + 속도 화살표 ──
const cellPx = 13, panel = N * cellPx, gap = 36, pad = 24;
const Wd = pad * 2 + panel * 2 + gap, Hd = pad + 34 + panel + 40;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; const al = a == null ? 1 : a; out[o] = (out[o] * (1 - al) + r * al) | 0; out[o + 1] = (out[o + 1] * (1 - al) + g * al) | 0; out[o + 2] = (out[o + 2] * (1 - al) + b * al) | 0; }
function line(x0, y0, x1, y1, r, g, b) { const dx = x1 - x0, dy = y1 - y0, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy))); for (let s = 0; s <= steps; s++) { px(x0 + dx * s / steps, y0 + dy * s / steps, r, g, b); } }
function arrow(cx, cy, vx, vy, col) { const L = Math.hypot(vx, vy); if (L < 1e-6) return; const ex = cx + vx, ey = cy + vy; line(cx, cy, ex, ey, col[0], col[1], col[2]); const ang = Math.atan2(vy, vx), ah = 3; line(ex, ey, ex - ah * Math.cos(ang - 0.5), ey - ah * Math.sin(ang - 0.5), col[0], col[1], col[2]); line(ex, ey, ex - ah * Math.cos(ang + 0.5), ey - ah * Math.sin(ang + 0.5), col[0], col[1], col[2]); }
function drawPanel(ox, oy, w) {
  for (let x = 0; x <= panel; x++) { px(ox + x, oy, 42, 50, 66); px(ox + x, oy + panel, 42, 50, 66); }
  for (let y = 0; y <= panel; y++) { px(ox, oy + y, 42, 50, 66); px(ox + panel, oy + y, 42, 50, 66); }
  const zc = N >> 1, r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y;
  // 밀도(흐린 점) + 속도 화살표(스케일).
  let vmax = 1e-9; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) { const v = Math.hypot(gx[i] / r[i], gy[i] / r[i]); if (v > vmax) vmax = v; }
  const sc = (cellPx * 0.9) / vmax;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (zc * N + y) * N + x; if (r[i] <= 1e-12) continue;
    const sx = ox + (x + 0.5) * cellPx, sy = oy + (y + 0.5) * cellPx;
    px(sx, sy, 90, 110, 150, 0.6); px(sx + 1, sy, 90, 110, 150, 0.6);
    arrow(sx, sy, (gx[i] / r[i]) * sc, (gy[i] / r[i]) * sc, [250, 180, 90]);
  }
}
const oy = pad + 34;
drawPanel(pad, oy, wU);
drawPanel(pad + panel + gap, oy, wS);

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

const LzU = gridL(wU), LzS = gridL(wS);
const eU = sum(wU.fields.therm), eS = sum(wS.fields.therm);
console.log('\n=== 눈 검증: demote 회전 복원 — 균일(정지) vs 스핀(소용돌이) ===');
console.log(`    같은 개체(P=0·Lz=${ent.Lz}=순수 스핀) 강등:`);
console.log(`    좌 spin off(기존): 격자 Lz ${LzU.toFixed(2)}(정지·화살표 없음) · Σ열 ${eU.toFixed(1)}`);
console.log(`    우 spin on(0029): 격자 Lz ${LzS.toFixed(2)}=entity.Lz ${ent.Lz}(소용돌이 복원) · Σ열 ${eS.toFixed(1)}(KE_rot 만큼 감소)`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = pngOk && Math.abs(LzU) < 1e-6 && Math.abs(LzS - ent.Lz) < 1e-3 && eS < eU;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

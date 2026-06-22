// step_0028/capture.js — 눈 검증(engine 직접 PNG): 개체간 중력 → 자유 직진이 *휘는 궤적*이 된다.
//
//   두 개체(같은 질량)를 접선 속도와 함께 놓으면 서로 끌려 *곡선 궤적*을 그린다 — step_0007 격자 자기중력의
//   개체-공간 거울짝. 한 패널에 두 개체의 *자취(trail)*를 겹쳐 그려 직선이 아니라 휘는 길을 본다(밝은 구 =
//   끝 위치). 격자는 텅 비어 있고(셀 0개) 개체 2개만 굴린다 = 비용이 개체 수에 묶임. 순 운동량 정확 보존.
//
//   실행: node HTJ/steps/step_0028/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

function ent(cx, cy, mass, vx, vy) {
  const px = mass * vx, py = mass * vy, KEcm = 0.5 * (px * px + py * py) / mass;
  return { cx, cy, cz: 12, mass, px, py, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm, internalE: 10, energy: KEcm + 10, radius: 1.8, temp: 1, peak: 1 };
}
const N = 24, DT = 0.05, G = 1, soft = 1.5, opt = { G, soft };
// 접선 속도를 준 두 개체 — 서로 끌려 곡선으로 감긴다.
const a = ent(6, 12, 6, 0, 0.55), b = ent(18, 12, 6, 0, -0.55);
const sumP = () => [a.px + b.px, a.py + b.py];
const mech = () => a.KEcm + b.KEcm + En.pairPotentialEnergy([a, b], opt);
const P0 = sumP(), E0 = mech();

// 자취 기록.
const trailA = [[a.cx, a.cy]], trailB = [[b.cx, b.cy]];
let emin = E0, emax = E0;
for (let t = 0; t < 320; t++) {
  En.applyEntityGravity([a, b], DT, opt); En.stepEntities([a, b], DT);
  trailA.push([a.cx, a.cy]); trailB.push([b.cx, b.cy]);
  const E = mech(); if (E < emin) emin = E; if (E > emax) emax = E;
}
const P1 = sumP();

// ── 캔버스: 한 패널(top-down x-y) — 두 곡선 자취 + 끝 위치 구 ──
const cellPx = 18, panel = N * cellPx, pad = 26;
const Wd = pad * 2 + panel, Hd = pad + 34 + panel + 44;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b, aa) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; const al = aa == null ? 1 : aa; out[o] = (out[o] * (1 - al) + r * al) | 0; out[o + 1] = (out[o + 1] * (1 - al) + g * al) | 0; out[o + 2] = (out[o + 2] * (1 - al) + b * al) | 0; }
const ox = pad, oy = pad + 34;
function frameBox() { for (let x = 0; x <= panel; x++) { px(ox + x, oy, 42, 50, 66); px(ox + x, oy + panel, 42, 50, 66); } for (let y = 0; y <= panel; y++) { px(ox, oy + y, 42, 50, 66); px(ox + panel, oy + y, 42, 50, 66); } }
function dot(cx, cy, rad, col, aa) { const sx = ox + cx * cellPx, sy = oy + cy * cellPx, r2 = rad * rad; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= r2) px(sx + dx, sy + dy, col[0], col[1], col[2], aa); }
function disc(cx, cy, rad, col) { const sx = ox + cx * cellPx, sy = oy + cy * cellPx, rp = rad * cellPx, r2 = rp * rp; for (let dy = -rp; dy <= rp; dy++) for (let dx = -rp; dx <= rp; dx++) { const d2 = dx * dx + dy * dy; if (d2 > r2) continue; const f = 0.45 + 0.55 * (1 - Math.sqrt(d2) / rp); px(sx + dx, sy + dy, (col[0] * f) | 0, (col[1] * f) | 0, (col[2] * f) | 0); } }
frameBox();
const COLA = [250, 180, 90], COLB = [90, 180, 250];
// 자취(흐린 점) — 휘는 길.
for (let k = 0; k < trailA.length; k += 2) { const aa = 0.12 + 0.5 * (k / trailA.length); dot(trailA[k][0], trailA[k][1], 1, COLA, aa); dot(trailB[k][0], trailB[k][1], 1, COLB, aa); }
// 끝 위치(밝은 구).
disc(a.cx, a.cy, a.radius, COLA); disc(b.cx, b.cy, b.radius, COLB);

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

const relP = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
const drift = Math.abs(emax - emin) / Math.abs(E0);
// 직선이 아님(휘었다): 자취가 출발-끝 직선에서 벗어난 최대 거리.
function curveMax(trail) { const x0 = trail[0][0], y0 = trail[0][1], x1 = trail[trail.length - 1][0], y1 = trail[trail.length - 1][1]; const L = Math.hypot(x1 - x0, y1 - y0) || 1; let m = 0; for (const p of trail) { const d = Math.abs((y1 - y0) * p[0] - (x1 - x0) * p[1] + x1 * y0 - y1 * x0) / L; if (d > m) m = d; } return m; }
const curved = Math.max(curveMax(trailA), curveMax(trailB));
console.log('\n=== 눈 검증: 개체간 중력 → 자유 직진이 *휘는 궤적*이 된다 ===');
console.log(`    두 개체(같은 질량 6, 접선 속도 ±0.55) — 서로 끌려 곡선으로 감긴다(격자 셀 0개, 개체 2개만 굴림).`);
console.log(`    궤적 휨(직선 이탈 최대): ${curved.toFixed(2)} 셀 (>0 = 직진 아님, 끌려 휘었다)`);
console.log(`    순 운동량 보존: |ΔP| ${relP.toExponential(1)} · 역학E 진폭/|E0| ${(drift * 100).toFixed(2)}%`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = pngOk && relP < 1e-12 && curved > 1 && drift < 0.05;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

// step_0032/capture.js — 눈 검증(차트 PNG): Barnes-Hut 가 O(N log N), 직접합산이 O(N²).
//
//   design §4 S6 검증 포인트 "O(N log N) 스케일 곡선". N 을 키우며 *총 상호작용 수*를 잰다 — 직접합산은
//   N² 로 폭주(가파른 곡선), Barnes-Hut 은 N log N 로 완만. 큰 세계에서 전역 중력이 굴러가는 이유를 눈으로.
//   (산출물이 벤치마크 차트라 viewer 시뮬 장면 아님 → check-viewer EXEMPT, 0015/0023 류.)
//
//   실행: node HTJ/steps/step_0032/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const BH = require(path.resolve(__dirname, '../../engine/htj-bhtree.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function makeBodies(n, box) { const r = rng(99), b = []; for (let i = 0; i < n; i++) b.push({ x: r() * box, y: r() * box, z: r() * box, mass: 1 }); return b; }

const Ns = [100, 200, 400, 800, 1600, 3200, 6400];
const bh = [], direct = [];
for (const n of Ns) { const bodies = makeBodies(n, 100); const res = BH.computeAccelerations(bodies, { G: 1, theta: 0.6, soft: 1 }); bh.push(res.interactions); direct.push(n * (n - 1)); }

// ── 로그-로그 차트 ──
const Wd = 620, Hd = 420, pad = 60;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 14; out[i + 1] = 16; out[i + 2] = 24; out[i + 3] = 255; }
function px(x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
function line(x0, y0, x1, y1, r, g, b) { const dx = x1 - x0, dy = y1 - y0, st = Math.max(1, Math.ceil(Math.hypot(dx, dy))); for (let s = 0; s <= st; s++) px(x0 + dx * s / st, y0 + dy * s / st, r, g, b); }
function disc(cx, cy, rad, r, g, b) { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) px(cx + dx, cy + dy, r, g, b); }
// 축(로그10).
const allV = bh.concat(direct), lminN = Math.log10(Ns[0]), lmaxN = Math.log10(Ns[Ns.length - 1]);
const lminV = Math.log10(Math.min(...allV)), lmaxV = Math.log10(Math.max(...allV));
const X = (n) => pad + (Math.log10(n) - lminN) / (lmaxN - lminN) * (Wd - pad - 20);
const Y = (v) => (Hd - pad) - (Math.log10(v) - lminV) / (lmaxV - lminV) * (Hd - pad - 30);
for (let x = pad; x < Wd - 20; x++) px(x, Hd - pad, 60, 70, 90);
for (let y = 30; y < Hd - pad; y++) px(pad, y, 60, 70, 90);
function plot(vals, r, g, b) { for (let i = 0; i < Ns.length; i++) { const x = X(Ns[i]), y = Y(vals[i]); disc(x, y, 3, r, g, b); if (i) line(X(Ns[i - 1]), Y(vals[i - 1]), x, y, r, g, b); } }
plot(direct, 250, 95, 60);   // 직접합산 O(N²) — 빨강(가파름)
plot(bh, 80, 200, 140);      // Barnes-Hut O(N log N) — 초록(완만)

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

const ratio = direct[Ns.length - 1] / bh[Ns.length - 1];
console.log('\n=== 눈 검증: Barnes-Hut O(N log N) vs 직접합산 O(N²) (로그-로그) ===');
console.log(`    N: ${Ns.join(', ')}`);
console.log(`    직접합산 상호작용(빨강): ${direct.map(v => v.toExponential(1)).join(', ')}`);
console.log(`    Barnes-Hut 상호작용(초록): ${bh.map(v => v.toExponential(1)).join(', ')}`);
console.log(`    N=${Ns[Ns.length - 1]} 에서 BH 가 직접합산보다 ${ratio.toFixed(0)}× 적은 상호작용`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = pngOk && bh[Ns.length - 1] < direct[Ns.length - 1] / 20;   // 큰 N 에서 BH 가 훨씬 적음
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

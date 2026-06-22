// step_0034/capture.js — 눈 검증(차트 PNG): 공간 LOD 가 비용을 세계 크기에서 분리한다.
//
//   design §4 S7. 관찰자 국소 fine 예산을 고정하고 세계 N 을 키우며 *유효 셀 수*(fine 셀 + coarse 블록)를
//   조밀 N³ 과 비교한다 — 조밀은 N³ 로 폭주(가파름), LOD 는 거의 평탄(관찰되는 국소에만 비용). 큰 세계에서
//   시뮬이 굴러가는 레버3 의 핵심. (산출물이 벤치마크 차트라 viewer 시뮬 장면 아님 → EXEMPT, 0015/0032 류.)
//
//   실행: node HTJ/steps/step_0034/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const LOD = require(path.resolve(__dirname, '../../engine/htj-lod.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

const BS = 8, radius = 1.5;
const Ns = [16, 32, 48, 64, 96, 128];
const eff = [], dense = [];
for (const N of Ns) { const c = LOD.effectiveCellCount(N, BS, [N / 2, N / 2, N / 2], radius); eff.push(c.effective); dense.push(c.dense); }

const Wd = 620, Hd = 420, pad = 60;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 14; out[i + 1] = 16; out[i + 2] = 24; out[i + 3] = 255; }
function px(x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
function line(x0, y0, x1, y1, r, g, b) { const dx = x1 - x0, dy = y1 - y0, st = Math.max(1, Math.ceil(Math.hypot(dx, dy))); for (let s = 0; s <= st; s++) px(x0 + dx * s / st, y0 + dy * s / st, r, g, b); }
function disc(cx, cy, rad, r, g, b) { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) px(cx + dx, cy + dy, r, g, b); }
const all = eff.concat(dense), lminN = Math.log10(Ns[0]), lmaxN = Math.log10(Ns[Ns.length - 1]);
const lminV = Math.log10(Math.min(...all)), lmaxV = Math.log10(Math.max(...all));
const X = (n) => pad + (Math.log10(n) - lminN) / (lmaxN - lminN) * (Wd - pad - 20);
const Y = (v) => (Hd - pad) - (Math.log10(v) - lminV) / (lmaxV - lminV) * (Hd - pad - 30);
for (let x = pad; x < Wd - 20; x++) px(x, Hd - pad, 60, 70, 90);
for (let y = 30; y < Hd - pad; y++) px(pad, y, 60, 70, 90);
function plot(vals, r, g, b) { for (let i = 0; i < Ns.length; i++) { const x = X(Ns[i]), y = Y(vals[i]); disc(x, y, 3, r, g, b); if (i) line(X(Ns[i - 1]), Y(vals[i - 1]), x, y, r, g, b); } }
plot(dense, 250, 95, 60);   // 조밀 N³ — 빨강(가파름)
plot(eff, 80, 200, 140);    // LOD 유효 — 초록(평탄)

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
console.log('\n=== 눈 검증: 공간 LOD — 비용을 세계 크기에서 분리(로그-로그) ===');
console.log(`    관찰자 국소 fine(radius=${radius} 블록) 고정, N 키움:`);
console.log(`    N: ${Ns.join(', ')}`);
console.log(`    조밀 N³(빨강): ${dense.map(v => v.toExponential(1)).join(', ')}`);
console.log(`    LOD 유효 셀(초록): ${eff.join(', ')}`);
console.log(`    N=${Ns[Ns.length - 1]}: 조밀 ${dense[Ns.length - 1].toExponential(1)} vs LOD ${eff[Ns.length - 1]} (${(dense[Ns.length - 1] / eff[Ns.length - 1]).toFixed(0)}× 절감)`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = pngOk && eff[Ns.length - 1] < dense[Ns.length - 1] / 100;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

// step_0024/capture.js — 눈 검증(engine 직접 PNG): 셀 희소화 vs 블록 희소화 — 레버1 의 granularity 천장.
//
//   진공(+동반 수송)을 가우시안 별에 반복하면 *셀* 비-영 점유는 내려간다(꼬리가 벗겨짐). 그러나 활성 집합의
//   단위인 *8³ 블록* 점유는 ~100% 그대로 — 옅은 꼬리가 모든 블록에 한 셀이라도 남기 때문. 두 곡선의 *간극*이
//   이 step 의 정직한 발견이다: 셀 희소화는 블록 희소화로 안 이어지고 → 블록 단위 활성 순회 절감은 여전히 0.
//   결론: 진짜 지렛대는 객체를 격자에서 *빼내는* S5 승격(레버2).
//
//   실행: node HTJ/steps/step_0024/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Va = require(path.resolve(__dirname, '../../engine/htj-vacuum.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

const N = 32, BS = 8, EPS = 1e-2, K = 20, nb = Math.ceil(N / BS), SCAL = ['mom_x', 'mom_y', 'mom_z', 'therm'];
function makeStar() { const w = W.createWorld(N); Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N ** 3 * 0.5), T0: 1 }); if (!w.fields.temperature) w.addField('temperature'); for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.fields[nm] || w.addField(nm, { type: Float64Array }); return w; }
function cellOcc(w) { const E = w.fields.energy; let c = 0; for (let i = 0; i < E.length; i++) if (E[i] !== 0) c++; return c / E.length; }
function blockOcc(w) { const E = w.fields.energy, seen = new Set(); for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (E[(z * N + y) * N + x] !== 0) seen.add(((z / BS | 0) * nb + (y / BS | 0)) * nb + (x / BS | 0)); return seen.size / (nb * nb * nb); }

const w = makeStar();
const cell = [cellOcc(w)], block = [blockOcc(w)];
for (let k = 0; k < K; k++) { Va.applyVacuum(w, { eps: EPS, scalars: SCAL }); cell.push(cellOcc(w)); block.push(blockOcc(w)); }

// ── 선 차트: x=진공 패스, y=점유율(%) — 셀(주황 내림) vs 블록(파랑 평탄) ──
const Wd = 600, Hd = 380, mL = 70, mR = 30, mT = 50, mB = 50, pw = Wd - mL - mR, ph = Hd - mT - mB;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
function dot(cx, cy, r, g, b) { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px(cx + dx, cy + dy, r, g, b); }
function line(x0, y0, x1, y1, r, g, b) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let s = 0; s <= n; s++) px((x0 + (x1 - x0) * s / n) | 0, (y0 + (y1 - y0) * s / n) | 0, r, g, b); }
const X = k => mL + pw * k / K, Y = v => mT + ph * (1 - v);     // v in [0,1]
for (let gy = 0; gy <= 4; gy++) { const yy = mT + ph * gy / 4; for (let x = mL; x < mL + pw; x++) px(x, yy | 0, 38, 42, 54); }  // 0·25·50·75·100% 격자
for (let k = 0; k < K; k++) {
  line(X(k), Y(block[k]), X(k + 1), Y(block[k + 1]), 70, 140, 250);   // 파랑 = 블록(평탄 100%)
  line(X(k), Y(cell[k]), X(k + 1), Y(cell[k + 1]), 250, 150, 60);     // 주황 = 셀(내림)
}
for (let k = 0; k <= K; k++) { dot(X(k) | 0, Y(block[k]) | 0, 70, 140, 250); dot(X(k) | 0, Y(cell[k]) | 0, 250, 150, 60); }
// 범례
for (let y = 16; y < 26; y++) { for (let x = mL; x < mL + 12; x++) px(x, y, 250, 150, 60); for (let x = mL + 180; x < mL + 192; x++) px(x, y, 70, 140, 250); }

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
const cellDrop = cell[0] - cell[K], blockDrop = block[0] - block[K];

console.log('\n=== 눈 검증: 셀 희소화 vs 블록 희소화 — 레버1 granularity 천장 ===');
console.log(`    주황(셀 점유) ${(cell[0] * 100).toFixed(0)}%→${(cell[K] * 100).toFixed(0)}%(내림) · 파랑(블록 점유) ${(block[0] * 100).toFixed(0)}%→${(block[K] * 100).toFixed(0)}%(평탄)`);
console.log(`    간극 = 정직한 발견: 셀은 희소화돼도(Δ${(cellDrop * 100).toFixed(0)}%p) 블록은 안 됨(Δ${(blockDrop * 100).toFixed(0)}%p) → 활성 집합 안 줄음 → 진짜 지렛대=S5 승격.`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = cellDrop > 0.05 && blockDrop < 0.05 && pngOk;   // 셀은 내려가고 블록은 거의 안 내려간다(천장)
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

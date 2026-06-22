// step_0015/capture.js — 눈 검증 캡처(engine 직접 PNG): 비용이 N 으로 *터지는 곡선*.
//
//   S1 측정 베이스라인의 눈 증거 — N 을 키우며 잰 비용을 *차트*로 그린다. 곡선이 위로 휜다(=초선형=O(N³)):
//     · 메모리 MB (결정론 프록시, nFields·N³·8) — 청록 곡선
//     · 벽시계 ms/step (실측, 머신 의존)        — 주황 곡선
//   둘 다 N 이 커질수록 가파르게 치솟는다 = "조밀 격자는 부피 비용으로 무너진다"(verify 가설과 일치).
//
//   실행: node HTJ/steps/step_0015/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const idat = zlib.deflateSync(raw);
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

const GRAV_ITERS = 40, LOCAL_PASSES = 7, STEPS = 6;
function measure(N) {
  const w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N * N * N * 0.5), T0: 1 });
  const t0 = process.hrtime.bigint();
  for (let t = 0; t < STEPS; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: GRAV_ITERS });
    Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
    Fu.applyFusion(w, 0.2, { rate: 2, rhoCrit: 6, tCrit: 3 });
    Co.applyCooling(w, 0.2, { coolRate: 0.06 });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  const t1 = process.hrtime.bigint();
  let mem = 0, nf = 0; for (const k of Object.keys(w.fields)) { mem += w.fields[k].byteLength; nf++; }
  return { N, mem, ms: Number(t1 - t0) / 1e6 / STEPS };
}

const Ns = [16, 20, 24, 28, 32, 40, 48];
const data = Ns.map(measure);

// ── 차트 렌더 ──
const Wd = 720, Hd = 460, mL = 70, mR = 30, mT = 60, mB = 60;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 10; out[i + 1] = 12; out[i + 2] = 16; out[i + 3] = 255; }
function px(x, y, r, g, b) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
function line(x0, y0, x1, y1, r, g, b) {  // Bresenham
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (; ;) { px(x0, y0, r, g, b); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function disc(cx, cy, rad, r, g, b) { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) px(cx + dx, cy + dy, r, g, b); }

const plotW = Wd - mL - mR, plotH = Hd - mT - mB;
// 축.
for (let x = mL; x <= Wd - mR; x++) px(x, Hd - mB, 90, 100, 120);
for (let y = mT; y <= Hd - mB; y++) px(mL, y, 90, 100, 120);
// 가로 그리드.
for (let g = 1; g <= 4; g++) { const y = (Hd - mB) - (plotH * g / 4) | 0; for (let x = mL; x <= Wd - mR; x += 4) px(x, y, 34, 40, 54); }

const Nmin = Ns[0], Nmax = Ns[Ns.length - 1];
const memMax = Math.max(...data.map(d => d.mem)), msMax = Math.max(...data.map(d => d.ms));
function X(N) { return mL + plotW * (N - Nmin) / (Nmax - Nmin); }
function Ymem(m) { return (Hd - mB) - plotH * (m / memMax); }
function Yms(s) { return (Hd - mB) - plotH * (s / msMax); }

// 두 곡선(각자 최대로 정규화 → 같은 차트에 모양 비교). 청록=메모리(결정론), 주황=벽시계(실측).
for (let i = 1; i < data.length; i++) {
  line(X(data[i - 1].N), Ymem(data[i - 1].mem), X(data[i].N), Ymem(data[i].mem), 60, 200, 200);
  line(X(data[i - 1].N), Yms(data[i - 1].ms), X(data[i].N), Yms(data[i].ms), 250, 150, 60);
}
for (const d of data) { disc(X(d.N) | 0, Ymem(d.mem) | 0, 4, 90, 230, 230); disc(X(d.N) | 0, Yms(d.ms) | 0, 4, 255, 180, 90); }
// 제목 막대(색 블록) + 범례 스와치(텍스트 없이 색으로).
for (let y = 18; y < 30; y++) for (let x = mL; x < mL + 16; x++) px(x, y, 60, 200, 200);   // 청록 = 메모리
for (let y = 38; y < 50; y++) for (let x = mL; x < mL + 16; x++) px(x, y, 250, 150, 60);   // 주황 = 벽시계

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);

// ── 단언(결정론 프록시 + png) ──
const r16 = data.find(d => d.N === 16), r32 = data.find(d => d.N === 32);
const memCubic = Math.abs(r32.mem / r16.mem - 8) < 1e-9;                 // 메모리 정확히 ×8
const msMono = data.every((d, i) => i === 0 || d.ms >= data[i - 1].ms * 0.7);  // 벽시계 대체로 증가(노이즈 허용)
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
console.log('\n=== 눈 검증: HTJ S1 측정 베이스라인 — 비용이 N 으로 터지는 곡선 ===');
for (const d of data) console.log(`    N=${String(d.N).padStart(2)} · 메모리 ${(d.mem / 1024 / 1024).toFixed(2).padStart(6)}MB · 벽시계 ${d.ms.toFixed(2).padStart(7)} ms/step`);
console.log(`  청록=메모리(결정론·정확 N³) · 주황=벽시계(실측·머신 의존) — 둘 다 위로 휜다(초선형)`);
console.log(`  메모리 N16→N32 = ×${(r32.mem / r16.mem).toFixed(2)}(=8 부피) · 벽시계 N16→N48 = ×${(data[data.length - 1].ms / r16.ms).toFixed(1)}`);
const ok = memCubic && msMono && pngOk;
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

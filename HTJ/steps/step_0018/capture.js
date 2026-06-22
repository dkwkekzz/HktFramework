// step_0018/capture.js — 눈 검증 캡처(engine 직접 PNG): 계산이 부피→활성으로 *실제로* 꺾인다.
//
//   step_0016 캡처는 *메모리*가 점유에 비례함을 보였다(그러나 법칙 미연결 = 잠재력). 이 캡처는 그
//   **계산 판**이자 *실현*이다 — 고정 N=64 에서 점유(별 반지름)를 키우며 `applyCooling` 의 **실제 방문
//   셀 수**(작업량)를 잰다:
//     · 조밀(청록) — *수평선*. 점유 무관 N³ 고정(빈 칸도 다 순회) = step_0014~0017 의 방식.
//     · 활성(주황) — *우상향*. 점유한 블록만 순회 → 작업량이 점유에 비례(빈 공간 건너뜀) = 첫 실현 절감.
//   조밀과 결과는 비트 동일(verify)인데 작업량만 점유로 꺾인다. 가득 차면 합류한다.
//
//   실행: node HTJ/steps/step_0018/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

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

const N = 64, BS = 8;
const radii = [0, 4, 8, 12, 16, 20, 26, 34, 44, 55];
const data = radii.map(r => {
  const w = W.createWorld(N);
  if (r > 0) W.seedBall(w, { r });
  const u = w.addField('therm', { type: Float64Array });
  for (let i = 0; i < u.length; i++) u[i] = w.fields.energy[i] * 5;
  const active = Sp.activeBlockOrigins(u, N, BS);
  const sa = {}; Co.applyCooling(w, 0.2, { coolRate: 0.06, active, blockSize: BS, stats: sa });
  return { r, occ: active.length / (Math.ceil(N / BS) ** 3), denseWork: N * N * N, activeWork: sa.cellsVisited };
});

// ── 차트 렌더 ──
const Wd = 720, Hd = 460, mL = 70, mR = 30, mT = 60, mB = 60;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 10; out[i + 1] = 12; out[i + 2] = 16; out[i + 3] = 255; }
function px(x, y, r, g, b) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
function line(x0, y0, x1, y1, r, g, b) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (; ;) { px(x0, y0, r, g, b); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function disc(cx, cy, rad, r, g, b) { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) px(cx + dx, cy + dy, r, g, b); }

const plotW = Wd - mL - mR, plotH = Hd - mT - mB;
for (let x = mL; x <= Wd - mR; x++) px(x, Hd - mB, 90, 100, 120);
for (let y = mT; y <= Hd - mB; y++) px(mL, y, 90, 100, 120);
for (let g = 1; g <= 4; g++) { const y = (Hd - mB) - (plotH * g / 4) | 0; for (let x = mL; x <= Wd - mR; x += 4) px(x, y, 34, 40, 54); }

const wmax = data[0].denseWork;
function X(occ) { return mL + plotW * occ; }
function Y(w) { return (Hd - mB) - plotH * (w / wmax); }
for (let i = 1; i < data.length; i++) {
  line(X(data[i - 1].occ), Y(data[i - 1].denseWork), X(data[i].occ), Y(data[i].denseWork), 60, 200, 200);
  line(X(data[i - 1].occ), Y(data[i - 1].activeWork), X(data[i].occ), Y(data[i].activeWork), 250, 150, 60);
}
for (const d of data) { disc(X(d.occ) | 0, Y(d.denseWork) | 0, 4, 90, 230, 230); disc(X(d.occ) | 0, Y(d.activeWork) | 0, 4, 255, 180, 90); }
for (let y = 18; y < 30; y++) for (let x = mL; x < mL + 16; x++) px(x, y, 60, 200, 200);   // 청록 = 조밀(점유 무관)
for (let y = 38; y < 50; y++) for (let x = mL; x < mL + 16; x++) px(x, y, 250, 150, 60);   // 주황 = 활성(점유 비례)

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);

const flat = data.every(d => d.denseWork === data[0].denseWork);
const rises = data[data.length - 1].activeWork > data[1].activeWork;
const small = data.find(d => d.r === 8);
const win = small.activeWork < small.denseWork * 0.25;
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
console.log('\n=== 눈 검증: HTJ S2 첫 실현 절감 — 계산이 부피→활성으로 꺾인다(조밀과 비트 동일) ===');
for (const d of data) console.log(`    r=${String(d.r).padStart(2)} · 점유 ${(100 * d.occ).toFixed(1).padStart(5)}% · 조밀 ${d.denseWork}셀 · 활성 ${String(d.activeWork).padStart(6)}셀`);
console.log(`  청록=조밀(수평=점유 무관 N³) · 주황=활성(우상향=점유 비례, 실현 절감) · 작은 별 r=8: 활성 = 조밀의 ${(100 * small.activeWork / small.denseWork).toFixed(0)}%`);
const ok = flat && rises && win && pngOk;
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

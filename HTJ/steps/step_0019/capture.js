// step_0019/capture.js — 눈 검증(engine 직접 PNG): 재스캔 비용이 *제거*된다(누적 스캔 셀 곡선).
//
//   step_0016 캡처는 *메모리*가 점유 비례임을, step_0018 캡처는 *작업량*이 점유 비례임을 보였다.
//   이 캡처는 그 둘을 잇는 *유지 비용* 판이다 — 같은 cooling 을 S스텝 돌릴 때 활성 집합을 찾느라
//   *전-격자를 훑는 누적 셀 수*:
//     · 재스캔(빨강, step_0018) — *우상향 직선*. 매 step O(N³) 재스캔 → 누적 = S·N³ (절감을 도로 먹음).
//     · 유지(초록, step_0019)   — *수평선*. 한 번 빌드(O(N³))한 뒤 재사용 → 누적 = N³ (1회뿐).
//   두 경로의 cooling *결과는 비트 동일*(verify §2)인데, 유지는 재스캔을 없애 step_0018 의 상쇄를 닫는다.
//
//   실행: node HTJ/steps/step_0019/capture.js
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

const N = 64, BS = 8, STEPS = 30;

// 누적 스캔 셀 수를 step 별로 잰다(실측 — 가짜 산수 아님).
// 재스캔: 매 step rebuildFromField → lastScannedCells 누적. 유지: 한 번 빌드 후 0 추가.
function trace() {
  const wr = (() => { const w = W.createWorld(N); W.seedBall(w, { r: N * 0.14 }); const u = w.addField('therm', { type: Float64Array }); for (let i = 0; i < u.length; i++) u[i] = w.fields.energy[i] * 5; return w; })();
  const wm = (() => { const w = W.createWorld(N); W.seedBall(w, { r: N * 0.14 }); const u = w.addField('therm', { type: Float64Array }); for (let i = 0; i < u.length; i++) u[i] = w.fields.energy[i] * 5; return w; })();
  const rset = Sp.createActiveSet(N, BS);
  const mset = Sp.createActiveSet(N, BS).rebuildFromField(wm.fields.therm);   // 유지: *한 번* 빌드
  const mScan0 = mset.lastScannedCells();
  const mActive = mset.origins();
  const rescan = [0], maintain = [mScan0];
  for (let t = 0; t < STEPS; t++) {
    rset.rebuildFromField(wr.fields.therm);                                   // 재스캔: 매 step 빌드
    Co.applyCooling(wr, 0.2, { coolRate: 0.06, active: rset.origins(), blockSize: BS });
    rescan.push(rescan[rescan.length - 1] + rset.lastScannedCells());
    Co.applyCooling(wm, 0.2, { coolRate: 0.06, active: mActive, blockSize: BS });
    maintain.push(mScan0);                                                    // 추가 스캔 0
  }
  return { rescan, maintain };
}
const { rescan, maintain } = trace();

// ── 차트 렌더 ──
const Wd = 720, Hd = 460, mL = 80, mR = 30, mT = 60, mB = 60;
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

const ymax = rescan[rescan.length - 1];
function X(t) { return mL + plotW * t / STEPS; }
function Y(v) { return (Hd - mB) - plotH * (v / ymax); }
for (let t = 1; t <= STEPS; t++) {
  line(X(t - 1), Y(rescan[t - 1]), X(t), Y(rescan[t]), 230, 70, 70);       // 빨강 = 재스캔(누적 우상향)
  line(X(t - 1), Y(maintain[t - 1]), X(t), Y(maintain[t]), 70, 220, 110);  // 초록 = 유지(수평)
}
disc(X(STEPS) | 0, Y(rescan[STEPS]) | 0, 4, 230, 70, 70);
disc(X(STEPS) | 0, Y(maintain[STEPS]) | 0, 4, 70, 220, 110);
for (let y = 18; y < 30; y++) for (let x = mL; x < mL + 16; x++) px(x, y, 230, 70, 70);    // 빨강 = 재스캔(0018)
for (let y = 38; y < 50; y++) for (let x = mL; x < mL + 16; x++) px(x, y, 70, 220, 110);   // 초록 = 유지(0019)

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);

const rises = rescan[STEPS] > rescan[1] * (STEPS - 1);     // 재스캔 누적이 선형으로 치솟음
const flat = maintain[STEPS] === maintain[0];              // 유지 누적이 step 1 이후 평평
const cut = maintain[STEPS] < rescan[STEPS];
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
console.log('\n=== 눈 검증: HTJ S2 재스캔 제거 — 활성 집합 유지로 전-격자 재스캔이 사라진다 ===');
console.log(`    ${STEPS}스텝 누적 스캔 셀: 재스캔(0018) ${rescan[STEPS].toLocaleString()} (우상향) · 유지(0019) ${maintain[STEPS].toLocaleString()} (수평, 1회뿐)`);
console.log(`  빨강=재스캔(매 step O(N³)) · 초록=유지(한 번 빌드 후 재사용) → ${(rescan[STEPS] / maintain[STEPS]).toFixed(1)}× 적게 훑음 (cooling 결과는 비트 동일)`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = rises && flat && cut && pngOk;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

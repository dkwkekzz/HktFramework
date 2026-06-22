// step_0020/capture.js — 눈 검증(engine 직접 PNG): 활성 전선이 *번지며 자라고*, 재스캔 없이 정확히 추적된다.
//
//   step_0019 캡처는 활성 집합이 *줄기만* 하는(cooling) 유지 비용을 보였다. 이 step 은 그 *반대* —
//   확산은 *번진다*. 활성 블록이 번짐 전선을 따라 step 마다 자라난다. 두 곡선:
//     · 활성(초록, 증분 추적) — originsWithHalo 로 halo 돌고 비-영이 된 블록을 깨운다(이웃 깨움).
//     · 조밀 지원(흰 점선, ground truth) — 매 step 조밀 배열의 *실제* 비-영 블록 수.
//   둘이 *정확히 겹친다* → 증분 활성화가 전-격자 재스캔 없이 전선을 한 치 오차 없이 따라간다.
//   (확산 결과 자체는 조밀과 비트 동일 — verify §1.)
//
//   실행: node HTJ/steps/step_0020/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-energy.js'));
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

const N = 64, BS = 8, ALPHA = 1 / 7, STEPS = 40;

// 활성(증분 추적) vs 조밀 지원(ground truth) 블록 수를 step 별로 잰다(실측).
const w = W.createWorld(N); En.seedHotSpot(w, { E0: 1000, half: 3 });
const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.energy);
const activeTrace = [set.size()];
const denseTrace = [Sp.activeBlockOrigins(w.fields.energy, N, BS).length];
let bitOk = true;
const wd = W.createWorld(N); En.seedHotSpot(wd, { E0: 1000, half: 3 });   // 조밀 대조(비트 동일 확인)
for (let t = 0; t < STEPS; t++) {
  const iter = set.originsWithHalo();
  En.diffuseEnergy(w, ALPHA, 'energy', { active: iter, blockSize: BS });
  set.activateFrom(w.fields.energy, iter);
  En.diffuseEnergy(wd, ALPHA);
  if (w.fingerprint('energy') !== wd.fingerprint('energy')) bitOk = false;
  activeTrace.push(set.size());
  denseTrace.push(Sp.activeBlockOrigins(w.fields.energy, N, BS).length);
}

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

const totalBlocks = Math.ceil(N / BS) ** 3;
function X(t) { return mL + plotW * t / STEPS; }
function Y(v) { return (Hd - mB) - plotH * (v / totalBlocks); }
// 조밀 지원(흰 점선, ground truth) — 점 찍어 점선.
for (let t = 1; t <= STEPS; t++) {
  const x0 = X(t - 1) | 0, y0 = Y(denseTrace[t - 1]) | 0, x1 = X(t) | 0, y1 = Y(denseTrace[t]) | 0;
  for (let s = 0; s <= 10; s += 2) px((x0 + (x1 - x0) * s / 10) | 0, (y0 + (y1 - y0) * s / 10) | 0, 230, 230, 240);
}
// 활성(초록, 증분 추적) — 실선.
for (let t = 1; t <= STEPS; t++) line(X(t - 1), Y(activeTrace[t - 1]), X(t), Y(activeTrace[t]), 70, 220, 110);
for (let t = 0; t <= STEPS; t += 5) disc(X(t) | 0, Y(activeTrace[t]) | 0, 3, 70, 220, 110);
for (let y = 18; y < 30; y++) for (let x = mL; x < mL + 16; x++) px(x, y, 70, 220, 110);      // 초록 = 활성(증분)
for (let y = 38; y < 50; y++) for (let x = mL; x < mL + 16; x += 3) px(x, y, 230, 230, 240);   // 흰 점선 = 조밀 지원

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);

const grew = activeTrace[STEPS] > activeTrace[0];
let coincide = true; for (let t = 0; t <= STEPS; t++) if (activeTrace[t] !== denseTrace[t]) coincide = false;
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
console.log('\n=== 눈 검증: HTJ S2 번지는 stencil 일반화 — 활성 전선이 자라며 재스캔 없이 정확 추적 ===');
console.log(`    활성 블록: ${activeTrace[0]} → ${activeTrace[STEPS]} (번짐 따라 자라남, ${STEPS}스텝) · 조밀 지원과 매 step 정확 일치=${coincide}`);
console.log(`  초록=활성(증분 추적) · 흰 점선=조밀 지원(ground truth) → 정확히 겹침 · 확산 결과 비트 동일=${bitOk}`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = grew && coincide && bitOk && pngOk;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

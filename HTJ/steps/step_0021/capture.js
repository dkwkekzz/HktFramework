// step_0021/capture.js — 눈 검증(engine 직접 PNG): 활성 전선이 *흐름 방향으로 이동*하며 재스캔 없이 정확 추적.
//
//   step_0020 캡처는 확산 전선이 *사방 대칭*으로 자람을 보였다. advect 는 *방향성 수송* — 활성 전선이
//   흐름(+x)을 따라 *옮겨간다*. 한 슬라이스(z=중앙)의 활성 블록 점유를 두 시점(초기·후기)에 그린다:
//     · 초기(파랑) — 덩어리가 왼쪽(cx≈0.3N)에 있고 활성 블록이 거기 모여 있다.
//     · 후기(주황) — 흐름 따라 *오른쪽으로 이동*한 활성 블록(전선이 따라감, prune 로 지나온 자리는 비움).
//   활성 집합이 조밀 지원과 매 step 정확 일치(텍스트 출력) · advect 결과는 조밀과 비트 동일.
//
//   실행: node HTJ/steps/step_0021/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const In = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
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

const N = 64, BS = 8, dt = 0.5, NB = Math.ceil(N / BS);

function makeWorld() {
  const w = W.createWorld(N);
  In.seedMovingBlob(w, { cx: N * 0.22, sigma: N * 0.06, M0: 1000, vx: 0.5 });
  const rho = w.fields.energy;
  let peak = 0; for (let i = 0; i < rho.length; i++) if (rho[i] > peak) peak = rho[i];
  const cut = peak * 1e-4;
  for (let i = 0; i < rho.length; i++) if (rho[i] < cut) { rho[i] = 0; w.fields.mom_x[i] = 0; w.fields.mom_y[i] = 0; w.fields.mom_z[i] = 0; }
  return w;
}

// 한 z-슬라이스(중앙)의 활성 블록 (bx,by) 점유 맵을 뽑는다(set 기반).
function sliceBlocks(set) {
  const bz = (N / 2 / BS) | 0;
  const map = [];
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) if (set.has(bx, by, bz)) map.push([bx, by]);
  return map;
}

const w = makeWorld();
const set = Sp.createActiveSet(N, BS).rebuildFromField(w.fields.energy);
const wd = makeWorld();   // 조밀 대조
const early = sliceBlocks(set);
let coincide = true, bitOk = true;
const STEPS = 36;
for (let t = 0; t < STEPS; t++) {
  const iter = set.originsWithHalo();
  In.advect(w, dt, { active: iter, blockSize: BS });
  set.activateFrom(w.fields.energy, iter); set.prune(w.fields.energy);
  In.advect(wd, dt);
  if (w.fingerprint('energy') !== wd.fingerprint('energy')) bitOk = false;
  if (set.size() !== Sp.activeBlockOrigins(w.fields.energy, N, BS).length) coincide = false;
}
const late = sliceBlocks(set);
const com1 = In.centerOfMass(w)[0];

// ── 슬라이스 블록 점유 렌더(왼→오 흐름) ──
const cell = 40, mL = 50, mT = 60, Wd = mL * 2 + NB * cell, Hd = mT + NB * cell + 50;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 10; out[i + 1] = 12; out[i + 2] = 16; out[i + 3] = 255; }
function px(x, y, r, g, b) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
function rect(bx, by, r, g, b, inset) {
  const x0 = mL + bx * cell + inset, y0 = mT + by * cell + inset;
  for (let dy = 0; dy < cell - 2 * inset; dy++) for (let dx = 0; dx < cell - 2 * inset; dx++) px(x0 + dx, y0 + dy, r, g, b);
}
// 격자선
for (let g = 0; g <= NB; g++) { for (let y = mT; y <= mT + NB * cell; y++) px(mL + g * cell, y, 40, 46, 60); for (let x = mL; x <= mL + NB * cell; x++) px(x, mT + g * cell, 40, 46, 60); }
// 후기(주황, 넓게) 먼저 → 초기(파랑, 작게 위에) — 둘 다 보이게(초기 자리 위에 후기가 흐름 따라 확장·이동).
for (const [bx, by] of late) rect(bx, by, 250, 150, 60, 3);
for (const [bx, by] of early) rect(bx, by, 70, 130, 240, 12);
// 흐름 방향 화살표(상단)
for (let x = mL; x < mL + NB * cell; x++) px(x, 30, 200, 210, 220);
for (let s = 0; s < 10; s++) { px(mL + NB * cell - 1 - s, 30 - s, 200, 210, 220); px(mL + NB * cell - 1 - s, 30 + s, 200, 210, 220); }
// 범례
for (let y = 8; y < 18; y++) for (let x = mL; x < mL + 12; x++) px(x, y, 60, 110, 230);        // 파랑 = 초기
for (let y = 8; y < 18; y++) for (let x = mL + 120; x < mL + 132; x++) px(x, y, 250, 150, 60);  // 주황 = 후기

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);

// 후기 활성 블록의 평균 bx 가 초기보다 오른쪽(흐름 방향 이동)인가?
const avg = arr => arr.reduce((s, b) => s + b[0], 0) / arr.length;
const moved = avg(late) > avg(early) + 0.5;
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
console.log('\n=== 눈 검증: HTJ S2 수송 stencil 일반화 — 활성 전선이 흐름 따라 이동하며 정확 추적 ===');
console.log(`    슬라이스 활성 블록 평균 bx: 초기 ${avg(early).toFixed(2)} → 후기 ${avg(late).toFixed(2)} (흐름 +x 따라 이동) · CoM_x→${com1.toFixed(1)}`);
console.log(`  파랑=초기 활성 · 주황=후기 활성(오른쪽 이동) · 조밀 지원과 매 step 정확 일치=${coincide} · advect 결과 비트 동일=${bitOk}`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = moved && coincide && bitOk && pngOk;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

// step_0025/capture.js — 눈 검증(engine 직접 PNG): 동결로 0연산 — 활성 순회가 정착 후 코어만 돈다.
//
//   fusion-only 세계: 가운데 점화 코어(계속 데워짐=활성) + 둘레 돌 가스(게이트 off=안 변함). 활동도 추적기가
//   안 변하는 둘레 블록을 holdSteps 연속 quiet 후 *동결*로 판정 → 법칙이 건너뛴다. 주황(활성 순회 방문 셀)이
//   초반 100%에서 *코어 한 줌*(~4%)으로 떨어지고, 파랑(조밀 전-격자)은 100% 평탄 — 두 곡선의 간극이 동결
//   절감이다. 그리고 그 절감은 *비트 동일*(조밀과 byte 동일)이다 — 동결 블록은 어차피 0 변화라 건너뛰어도 같다.
//   step_0024 의 "블록 100% 천장"과 대비: 거기선 못 줄였고, 여기선 *변화가 멎은* 블록을 알아채 줄인다.
//
//   실행: node HTJ/steps/step_0025/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));
const Ac = require(path.resolve(__dirname, '../../engine/htj-activity.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

const N = 24, BS = 8, DT = 0.1, RATE = 1.0, RHO_CRIT = 5, T_CRIT = 1, HOLD = 3, S = 14;
function makeWorld() {
  const w = W.createWorld(N); w.addField('therm');
  const E = w.fields.energy, U = w.fields.therm, c = (N - 1) / 2;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x, dr = Math.hypot(x - c, y - c, z - c);
    if (dr < 3) { E[i] = 10; U[i] = 20; } else { E[i] = 2; U[i] = 1; }
  }
  return w;
}

const wd = makeWorld(), wa = makeWorld();
const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
const tr = Ac.createActivityTracker(N, BS);
const allCells = set.origins().length * BS * BS * BS;
const denseV = [], activeV = []; let same = true;
for (let t = 0; t < S; t++) {
  Fu.applyFusion(wd, DT, { rate: RATE, rhoCrit: RHO_CRIT, tCrit: T_CRIT });
  const origins = set.origins(), active = tr.activeOrigins(origins, HOLD), stats = {};
  Fu.applyFusion(wa, DT, { rate: RATE, rhoCrit: RHO_CRIT, tCrit: T_CRIT, active, blockSize: BS, stats });
  tr.measure(wa.fields.therm, origins, { threshold: 0 });
  denseV.push(1.0); activeV.push(stats.cellsVisited / allCells);
  if (wd.fingerprint('therm') !== wa.fingerprint('therm')) same = false;
}

// ── 선 차트: x=step, y=방문 셀 비율(%) — 조밀(파랑 평탄 100%) vs 활성+동결(주황 내림 →코어) ──
const Wd = 600, Hd = 380, mL = 70, mR = 30, mT = 50, mB = 50, pw = Wd - mL - mR, ph = Hd - mT - mB;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
function dot(cx, cy, r, g, b) { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px(cx + dx, cy + dy, r, g, b); }
function line(x0, y0, x1, y1, r, g, b) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let s = 0; s <= n; s++) px((x0 + (x1 - x0) * s / n) | 0, (y0 + (y1 - y0) * s / n) | 0, r, g, b); }
const X = k => mL + pw * k / (S - 1), Y = v => mT + ph * (1 - v);
for (let gy = 0; gy <= 4; gy++) { const yy = mT + ph * gy / 4; for (let x = mL; x < mL + pw; x++) px(x, yy | 0, 38, 42, 54); }
for (let k = 0; k < S - 1; k++) {
  line(X(k), Y(denseV[k]), X(k + 1), Y(denseV[k + 1]), 70, 140, 250);     // 파랑 = 조밀(평탄 100%)
  line(X(k), Y(activeV[k]), X(k + 1), Y(activeV[k + 1]), 250, 150, 60);   // 주황 = 활성+동결(내림)
}
for (let k = 0; k < S; k++) { dot(X(k) | 0, Y(denseV[k]) | 0, 70, 140, 250); dot(X(k) | 0, Y(activeV[k]) | 0, 250, 150, 60); }
for (let y = 16; y < 26; y++) { for (let x = mL; x < mL + 12; x++) px(x, y, 250, 150, 60); for (let x = mL + 200; x < mL + 212; x++) px(x, y, 70, 140, 250); }

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
const drop = activeV[0] - activeV[S - 1];

console.log('\n=== 눈 검증: 동결로 0연산 — 활성 순회가 정착 후 코어만 돈다 ===');
console.log(`    주황(활성+동결 방문) ${(activeV[0] * 100).toFixed(0)}% → ${(activeV[S - 1] * 100).toFixed(0)}%(내림) · 파랑(조밀) 100% 평탄`);
console.log(`    간극 = 동결 절감(둘레 돌 가스가 quiet→동결→0연산) · 비트 동일=${same}(조밀과 byte 동일)`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = drop > 0.5 && same && pngOk;   // 활성 방문이 절반 넘게 떨어지고 + 여전히 비트 동일
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

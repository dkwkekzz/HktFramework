// step_0017/capture.js — 눈 검증 캡처(engine 직접 PNG): 진공 전후 — 꼬리가 0 으로, 코어는 남는다.
//
//   작은 가우시안 별의 중앙면(z=N/2) 슬라이스를 진공 규칙 전/후로 나란히 그린다(heat 램프):
//     · 좌(BEFORE) — 가우시안 글로우가 *전 격자에 옅게 깔림*(점유 512/512블록, 희소 이득 0 = step_0016 한계).
//     · 우(AFTER)  — 옅은 꼬리가 *정확한 0(검정)* 으로 흡수되고 밝은 코어만 남음(점유 ~32/512블록).
//   8³ 블록 격자선을 겹쳐 *통째로 빈 블록*(희소가 회수하는 곳)을 눈으로 본다. 질량은 보존(제목줄 수치).
//
//   실행: node HTJ/steps/step_0017/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Va = require(path.resolve(__dirname, '../../engine/htj-vacuum.js'));
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

// heat 램프: t=0(검정·진공) → 빨강 → 주황 → 노랑 → 흰색(코어). 정확한 0 은 완전 검정.
function heat(t) {
  if (t <= 0) return [4, 4, 8];
  t = Math.min(1, t);
  const r = Math.min(1, t * 3), g = Math.min(1, Math.max(0, t * 3 - 1)), b = Math.min(1, Math.max(0, t * 3 - 2));
  return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0];
}

const N = 64, EPS = 0.05, BS = 8;
const w = W.createWorld(N);
Th.seedWarmBlob(w, { sigma: N * 0.06, M0: 4000, T0: 1 });
const massBefore = w.total('energy');
const before = Float64Array.from(w.fields.energy);
const blocksBefore = Sp.fromDense(N, w.fields.energy).activeBlocks();
for (let k = 0; k < 80; k++) Va.applyVacuum(w, { eps: EPS });
const after = Float64Array.from(w.fields.energy);
const massAfter = w.total('energy');
const blocksAfter = Sp.fromDense(N, w.fields.energy).activeBlocks();

// 두 패널 공유 색 스케일(같은 max 로 정규화 → 코어 밝기 비교 공정).
let vmax = 0; for (let i = 0; i < before.length; i++) { if (before[i] > vmax) vmax = before[i]; if (after[i] > vmax) vmax = after[i]; }

const scale = 5, panel = N * scale, gap = 30, mT = 50, mB = 16, mL = 16;
const Wd = mL * 2 + panel * 2 + gap, Hd = mT + panel + mB;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 14; out[i + 1] = 16; out[i + 2] = 22; out[i + 3] = 255; }
function px(x, y, r, g, b) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }

// 한 슬라이스(z=N/2) 를 ox 에서 시작해 그린다 + 8³ 블록 격자선.
function drawSlice(field, ox) {
  const z = N >> 1;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = field[(z * N + y) * N + x];
      // 강한 감마(0.28) — 옅은 꼬리(max 대비 ≪1)도 눈에 보이게 끌어올린다(진공 차이를 드러냄). 0 은 검정 유지.
      const t = vmax > 0 && v > 0 ? Math.pow(v / vmax, 0.28) : 0;
      const [r, g, b] = heat(t);
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) px(ox + x * scale + dx, mT + y * scale + dy, r, g, b);
    }
  // 블록 격자선(8칸마다) — 통째로 빈 블록(검정)이 회수 대상.
  for (let bx = 0; bx <= N; bx += BS) for (let yy = 0; yy < panel; yy++) px(ox + bx * scale, mT + yy, 40, 46, 60);
  for (let by = 0; by <= N; by += BS) for (let xx = 0; xx < panel; xx++) px(ox + xx, mT + by * scale, 40, 46, 60);
}
drawSlice(before, mL);
drawSlice(after, mL + panel + gap);
// 제목 스와치(좌=before 청록, 우=after 주황).
for (let yy = 18; yy < 34; yy++) for (let xx = mL; xx < mL + 24; xx++) px(xx, yy, 90, 160, 200);
for (let yy = 18; yy < 34; yy++) for (let xx = mL + panel + gap; xx < mL + panel + gap + 24; xx++) px(xx, yy, 250, 150, 60);

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);

// ── 단언(결정론 값만) ──
const massOk = Math.abs(massAfter - massBefore) <= 1e-9 * Math.abs(massBefore);  // 질량 보존
const sparser = blocksAfter < blocksBefore * 0.2;                                // 점유 블록 급감
let zerosCreated = 0; for (let i = 0; i < after.length; i++) if (after[i] === 0 && before[i] !== 0) zerosCreated++;
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
console.log('\n=== 눈 검증: HTJ S2 진공 전이 규칙 — 꼬리가 0 으로, 코어는 남는다(질량 보존) ===');
console.log(`  좌 BEFORE: 점유 ${blocksBefore}/512블록(가우시안 꼬리가 전 격자에 깔림) · 우 AFTER: ${blocksAfter}/512블록(진공 80패스)`);
console.log(`  정확한 0 으로 흡수된 셀 ${zerosCreated}개 · 질량 ${massBefore.toFixed(1)}→${massAfter.toFixed(1)}(Δ=${Math.abs(massAfter - massBefore).toExponential(1)}, 보존)`);
const ok = massOk && sparser && zerosCreated > 0 && pngOk;
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

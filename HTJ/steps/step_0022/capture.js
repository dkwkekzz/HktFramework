// step_0022/capture.js — 눈 검증(engine 직접 PNG): 압력 힘 ∇P 가 rim 으로 번져 *halo 블록*에 정확히 안착.
//
//   step_0020(확산)은 ρ 장이 사방 대칭으로 번짐을, step_0021(advect)은 활성 전선이 흐름 따라 이동함을 보였다.
//   이 step 은 *힘* 법칙(압력) — ∇P 가 g(운동량)에 번진다. 한 z-슬라이스에 |Δg|(압력이 바꾼 운동량 크기)를
//   heat 으로, 그 위에 활성 블록(파랑 테두리)·halo 블록(주황 테두리)을 겹쳐 그린다:
//     · |Δg| 가 핫큐브 *표면*에서 가장 세고, ρ=0 인 rim(블록 경계 밖)으로 한 칸 *번진다*.
//     · 그 rim 이 *빈 이웃 블록*(주황 halo)에 떨어진다 → 그래서 halo 가 필요(없으면 그 g 를 놓침).
//     · |Δg|>0 셀이 *모두* 파랑∪주황 안(active∪halo) = 조밀과 비트 동일하게 덮인다(텍스트: missed=0).
//
//   실행: node HTJ/steps/step_0022/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
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

const N = 64, BS = 8, K = 0.5, GAMMA = 2, DT = 0.2, NB = Math.ceil(N / BS);
const POPT = { K, gamma: GAMMA };

// verify 와 같은 핫큐브 — 블록 경계(31|32)에 딱 붙여 rim 이 빈 이웃 블록(halo)으로 넘치게.
function seededWorld() {
  const w = W.createWorld(N);
  const E = w.fields.energy; E.fill(0);
  const lo = 26, hi = 31, per = 1000 / ((hi - lo + 1) ** 3);
  for (let z = lo; z <= hi; z++) for (let y = lo; y <= hi; y++) for (let x = lo; x <= hi; x++) E[(z * N + y) * N + x] = per;
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.fields[nm] || w.addField(nm, { type: Float64Array });
  return w;
}

// |Δg| 슬라이스 — 조밀 압력 한 step 전후의 운동량 변화 크기(z=zc).
const zc = 29;
const wd = seededWorld();
const b = ['mom_x', 'mom_y', 'mom_z'].map(nm => Float64Array.from(wd.fields[nm]));
Pr.applyPressure(wd, DT, POPT);
const a = ['mom_x', 'mom_y', 'mom_z'].map(nm => wd.fields[nm]);
const dmag = new Float64Array(N * N);
let dmax = 0;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = (zc * N + y) * N + x;
  const m = Math.hypot(a[0][i] - b[0][i], a[1][i] - b[1][i], a[2][i] - b[2][i]);
  dmag[y * N + x] = m; if (m > dmax) dmax = m;
}

// active/halo 블록(슬라이스 bz) + 커버리지 검사(missed=0) + 비트 동일.
const set = Sp.createActiveSet(N, BS).rebuildFromField(seededWorld().fields.energy);
const iter = set.originsWithHalo();
const haloKeys = new Set(iter.map(([ox, oy, oz]) => `${ox / BS | 0},${oy / BS | 0},${oz / BS | 0}`));
const bz = (zc / BS) | 0;
let missed = 0, rimInHalo = 0;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  if (dmag[y * N + x] <= 0) continue;
  const bx = x / BS | 0, by = y / BS | 0;
  const inActive = set.has(bx, by, bz);
  if (!haloKeys.has(`${bx},${by},${bz}`)) missed++;        // 바뀌었는데 active∪halo 밖 = 누락
  else if (!inActive) rimInHalo++;                         // halo(비-활성) 블록에 떨어진 rim
}
// 비트 동일(전 격자 — 슬라이스뿐 아니라 전체)
const wa = seededWorld();
Pr.applyPressure(wa, DT, Object.assign({ active: iter, blockSize: BS }, POPT));
const bitOk = ['mom_x', 'mom_y', 'mom_z'].every(nm => wa.fingerprint(nm) === wd.fingerprint(nm));

// ── 렌더: |Δg| heat + 블록 테두리(파랑=활성·주황=halo) ──
const cell = 8, mL = 40, mT = 56, Wd = mL * 2 + N * cell, Hd = mT + N * cell + 20;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 8; out[i + 1] = 10; out[i + 2] = 14; out[i + 3] = 255; }
function px(x, y, r, g, bl) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = 255; }
// heat ramp: 0=검정 → 빨강 → 노랑 → 흰색
function heat(v) {
  v = Math.max(0, Math.min(1, v));
  const r = Math.min(1, v * 3), g = Math.min(1, Math.max(0, v * 3 - 1)), b = Math.min(1, Math.max(0, v * 3 - 2));
  return [r * 255 | 0, g * 255 | 0, b * 255 | 0];
}
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const v = dmax > 0 ? dmag[y * N + x] / dmax : 0;
  const [r, g, bl] = heat(Math.sqrt(v));                   // sqrt = 약한 값도 보이게
  for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) px(mL + x * cell + dx, mT + y * cell + dy, r, g, bl);
}
// 블록 테두리 — 활성(파랑)·halo(주황)
function border(bx, by, r, g, bl) {
  const x0 = mL + bx * BS * cell, y0 = mT + by * BS * cell, s = BS * cell;
  for (let d = 0; d < s; d++) { px(x0 + d, y0, r, g, bl); px(x0 + d, y0 + s - 1, r, g, bl); px(x0, y0 + d, r, g, bl); px(x0 + s - 1, y0 + d, r, g, bl); }
}
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
  const k = `${bx},${by},${bz}`;
  if (set.has(bx, by, bz)) border(bx, by, 70, 140, 250);   // 파랑 = 활성(ρ>0)
  else if (haloKeys.has(k)) border(bx, by, 250, 150, 60);  // 주황 = halo(빈 이웃, rim 받는 곳)
}
// 범례
for (let y = 8; y < 18; y++) { for (let x = mL; x < mL + 12; x++) px(x, y, 70, 140, 250); for (let x = mL + 150; x < mL + 162; x++) px(x, y, 250, 150, 60); }

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

console.log('\n=== 눈 검증: HTJ S2 *힘* stencil 일반화 — ∇P 가 rim 으로 번져 halo 블록에 안착 ===');
console.log(`    파랑=활성 블록(ρ>0) · 주황=halo 블록(빈 이웃) · heat=|Δg|(압력이 바꾼 운동량) · 슬라이스 z=${zc}`);
console.log(`  rim 이 halo 블록에 떨어진 셀 ${rimInHalo}개(>0 → halo 필요) · |Δg|>0 셀이 active∪halo 밖 ${missed}개(=0 커버) · 전-격자 비트 동일=${bitOk}`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
const ok = rimInHalo > 0 && missed === 0 && bitOk && pngOk;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

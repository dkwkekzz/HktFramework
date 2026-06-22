// step_0027/capture.js — 눈 검증(engine 직접 PNG): 승격된 개체가 격자를 가로질러 등속 직진한다.
//
//   조밀한 구를 *승격*해 격자에서 빼낸 뒤(격자 텅 빔), 개체를 개체-공간에서 굴린다. 힘이 없으니 제 속도로
//   등속 직진 — 개체판 뉴턴 1법칙. 3 프레임(t=0·중간·끝)을 좌→우로 늘어놓아 *구체 1개*가 +x 로 옮겨가는
//   것을 본다. 격자는 한 칸도 안 도는데(셀 0개) 개체는 움직인다 = 비용이 부피 아닌 개체 수에 묶임.
//   하단: 드리프트 내내 질량·운동량·에너지가 정확 보존(위치만 변함).
//
//   실행: node HTJ/steps/step_0027/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Cl = require(path.resolve(__dirname, '../../engine/htj-cluster.js'));
const Pm = require(path.resolve(__dirname, '../../engine/htj-promote.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }

const N = 24, DT = 0.3;
const w = W.createWorld(N); w.addField('therm');
for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
// 조밀한 균일 구 + bulk 속도 vx.
const cx0 = N * 0.2, cy0 = (N - 1) / 2, cz0 = (N - 1) / 2, rad = 3, rho0 = 4, vx0 = 0.5;
for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = x - cx0, dy = y - cy0, dz = z - cz0;
  if (dx * dx + dy * dy + dz * dz <= rad * rad) { const i = (z * N + y) * N + x; w.fields.energy[i] = rho0; w.fields.mom_x[i] = rho0 * vx0; w.fields.therm[i] = rho0 * 0.5; }
}
const sum = f => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const mom = () => [sum(w.fields.mom_x), sum(w.fields.mom_y), sum(w.fields.mom_z)];
const ke = () => { const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; let s = 0; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) s += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / r[i]; return s; };
const energy = () => ke() + sum(w.fields.therm);

// 승격 — 구 전체를 개체 1개로(격자 비움).
const m0 = sum(w.fields.energy), p0 = mom(), e0 = energy();
const clumps = Cl.detectClumps(w, { eps: 1e-9, minCells: 2, collectCells: true });
const ent = Pm.promote(w, clumps[0].cellList);
let nzAfter = 0; for (let i = 0; i < w.fields.energy.length; i++) if (w.fields.energy[i] !== 0) nzAfter++;
const vx = ent.px / ent.mass;

// 3 프레임의 개체 위치(드리프트). 위치만 적분 — 격자는 안 돈다.
const frames = [];
const snap = () => ({ cx: ent.cx, cy: ent.cy, cz: ent.cz, r: ent.radius, mass: ent.mass, P: [ent.px, ent.py, ent.pz], E: ent.energy });
frames.push(snap());
for (let t = 0; t < 22; t++) { En.stepEntity(ent, DT, { N }); if (t === 10) frames.push(snap()); }
frames.push(snap());

// ── 캔버스: 3 패널(top-down x-y 투영) — 구체가 +x 로 옮겨감 ──
const cellPx = 9, panel = N * cellPx, gap = 26, pad = 22;
const Wd = pad * 2 + panel * 3 + gap * 2, Hd = pad + 30 + panel + 50;
const out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; }
function frameBox(ox, oy) { for (let x = 0; x <= panel; x++) { px(ox + x, oy, 42, 50, 66); px(ox + x, oy + panel, 42, 50, 66); } for (let y = 0; y <= panel; y++) { px(ox, oy + y, 42, 50, 66); px(ox + panel, oy + y, 42, 50, 66); } }
// 채워진 원반(구체) — 방사 감쇠로 입체감.
function disc(ox, oy, cx, cy, rad, col) {
  const sx = ox + cx * cellPx, sy = oy + cy * cellPx, rp = Math.max(cellPx, rad * cellPx);
  const r2 = rp * rp;
  for (let dy = -rp; dy <= rp; dy++) for (let dx = -rp; dx <= rp; dx++) {
    const d2 = dx * dx + dy * dy; if (d2 > r2) continue;
    const f = 0.45 + 0.55 * (1 - Math.sqrt(d2) / rp);
    px(sx + dx, sy + dy, (col[0] * f) | 0, (col[1] * f) | 0, (col[2] * f) | 0);
  }
}
const oy = pad + 30;
const HOT = [250, 180, 90];
for (let k = 0; k < 3; k++) {
  const ox = pad + k * (panel + gap);
  frameBox(ox, oy);
  const f = frames[k];
  disc(ox, oy, f.cx, f.cy, f.r, HOT);
}

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

const relM = Math.abs(frames[2].mass - m0) / (m0 || 1);
const relE = Math.abs(frames[2].E - e0) / (e0 || 1);
console.log('\n=== 눈 검증: 승격된 개체가 격자를 가로질러 등속 직진한다 ===');
console.log(`    구를 승격 → 격자 비-영 셀 ${nzAfter}개(격자 텅 빔) · 개체 1개(질량 ${ent.mass.toFixed(1)}·반지름 ${ent.radius.toFixed(2)}·v_x ${vx.toFixed(2)})`);
console.log(`    개체 위치 x: ${frames.map(f => f.cx.toFixed(1)).join(' → ')} (격자 순회 0 — 위치만 적분)`);
console.log(`    보존(드리프트 내내): 질량 ${frames.map(f => f.mass.toFixed(1)).join('=')} (상대 ${relM.toExponential(1)}) · 에너지 ${frames.map(f => f.E.toFixed(1)).join('=')} (상대 ${relE.toExponential(1)})`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
// 검증: 격자 텅 빔 + 개체가 +x 로 실제 이동(끝>시작) + 보존(위치만 변함).
const moved = frames[2].cx - frames[0].cx > 2;
const ok = pngOk && nzAfter === 0 && moved && relM < 1e-12 && relE < 1e-12;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

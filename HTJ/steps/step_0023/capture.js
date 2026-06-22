// step_0023/capture.js — 눈 검증(engine 직접 PNG): 마이크로벤치 47× vs *실제 별* 1.03× — 실현 이득의 정직한 천장.
//
//   step_0018~0022 의 화려한 벽시계(47×·30×…)는 인위적 희소 시드(핫큐브)에서 잰 *단일 법칙* 마이크로벤치다.
//   이 게이트는 *실제 붕괴 별 전체 파이프라인*에서 활성 배선의 실현 속도를 잰다. 두 막대를 나란히:
//     · 왼쪽(주황) — 마이크로벤치 47×(step_0022 pressure, 희소 시드)
//     · 오른쪽(파랑) — 실제 별 파이프라인 측정값(점유 100%·gravity 전역+thermal/viscosity/fusion 조밀)
//   메시지: 활성 순회 절감의 실현 천장은 *세계가 실제로 희소할 때*만 열린다(진공 in-loop·S5 승격 필요).
//
//   실행: node HTJ/steps/step_0023/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const In = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }
function writePNG(file, w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13);
  ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const N = 32, BS = 8, DT = 0.2, P = { kpress: 0.12, kthermo: 0.3, kvisc: 0.6, frate: 2, radiate: 0.06 };
function updateTemp(w) { if (!w.fields.therm) return; if (!w.fields.temperature) w.addField('temperature'); w.fields.temperature.set(Th.temperature(w)); }
function makeStar() { const w = W.createWorld(N); Th.seedWarmBlob(w, { sigma: N * 0.16, M0: Math.max(2500, N * N * N * 0.5), T0: 1 }); updateTemp(w); for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.fields[nm] || w.addField(nm, { type: Float64Array }); return w; }
function advanceDense(w) { Gr.applyGravity(w, DT, { G: 0.15, iters: 40 }); Pr.applyPressure(w, DT, { K: P.kpress, gamma: 2 }); Th.applyThermalPressure(w, DT, { Kth: P.kthermo, gamma: 5 / 3 }); Vi.applyViscosity(w, DT, { Kvisc: P.kvisc }); Fu.applyFusion(w, DT, { rate: P.frate, rhoCrit: 6, tCrit: 3 }); Co.applyCooling(w, DT, { coolRate: P.radiate }); In.advect(w, DT, { scalars: ['therm'] }); updateTemp(w); }
function advanceActive(w, set, occ) {
  const halo = set.originsWithHalo();
  Gr.applyGravity(w, DT, { G: 0.15, iters: 40 }); Pr.applyPressure(w, DT, { K: P.kpress, gamma: 2, active: halo, blockSize: BS });
  Th.applyThermalPressure(w, DT, { Kth: P.kthermo, gamma: 5 / 3 }); Vi.applyViscosity(w, DT, { Kvisc: P.kvisc });
  Fu.applyFusion(w, DT, { rate: P.frate, rhoCrit: 6, tCrit: 3 }); Co.applyCooling(w, DT, { coolRate: P.radiate, active: set.origins(), blockSize: BS });
  In.advect(w, DT, { scalars: ['therm'], active: halo, blockSize: BS }); set.activateFrom(w.fields.energy, halo); set.prune(w.fields.energy); updateTemp(w);
  if (occ) { const nb = Math.ceil(N / BS); occ.push(set.size() / (nb * nb * nb)); }
}

const S = 20, occ = [];
const wd = makeStar(), wa = makeStar();
const set = Sp.createActiveSet(N, BS).rebuildFromField(wa.fields.energy);
let t0 = process.hrtime.bigint(); for (let t = 0; t < S; t++) advanceDense(wd); const msDense = Number(process.hrtime.bigint() - t0) / 1e6 / S;
t0 = process.hrtime.bigint(); for (let t = 0; t < S; t++) advanceActive(wa, set, occ); const msActive = Number(process.hrtime.bigint() - t0) / 1e6 / S;
const realSpeedup = msDense / msActive;
const avgOcc = occ.reduce((s, r) => s + r, 0) / occ.length;
const microSpeedup = 47.7;   // step_0022 pressure 마이크로벤치(희소 핫큐브)

// ── 막대 차트 ──
const Wd = 560, Hd = 380, out = Buffer.alloc(Wd * Hd * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 12; out[i + 1] = 14; out[i + 2] = 20; out[i + 3] = 255; }
function px(x, y, r, g, b) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
function bar(x0, w, hpx, r, g, b) { const base = 320; for (let y = base - hpx; y < base; y++) for (let x = x0; x < x0 + w; x++) px(x, y, r, g, b); }
function tick(y, r, g, b) { for (let x = 70; x < 490; x++) px(x, y, r, g, b); }
// log 스케일 높이(1×=0, 47×≈ 만큼) — base 320, 축 상단 60.
const H = 250; const lmax = Math.log10(microSpeedup);
const h = (v) => Math.max(2, (Math.log10(Math.max(1, v)) / lmax) * H | 0);
// 기준선 1× (절감 없음)
tick(320, 50, 55, 70);                          // base = 1×
for (let x = 70; x < 490; x++) px(x, 320 - h(2), 40, 44, 56);    // 2× 보조선
bar(120, 90, h(microSpeedup), 250, 150, 60);    // 주황 = 마이크로벤치 47×
bar(340, 90, h(realSpeedup), 70, 140, 250);     // 파랑 = 실제 별 1.03×
// 범례 점
for (let y = 18; y < 30; y++) { for (let x = 40; x < 52; x++) px(x, y, 250, 150, 60); for (let x = 300; x < 312; x++) px(x, y, 70, 140, 250); }

const outPath = path.join(__dirname, 'capture.png');
writePNG(outPath, Wd, Hd, out);
const pngOk = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;

console.log('\n=== 눈 검증: 마이크로벤치 vs 실제 별 — 활성 순회 절감의 정직한 천장 ===');
console.log(`    주황 막대 = 마이크로벤치 ${microSpeedup}×(단일 법칙·희소 핫큐브) · 파랑 막대 = 실제 별 파이프라인 ${realSpeedup.toFixed(2)}×`);
console.log(`    실제 별 활성 점유 평균 ${(avgOcc * 100).toFixed(0)}%(격자 꽉 참=희소 안 됨) · 활성 법칙 3/7(gravity 전역+thermal/viscosity/fusion 조밀)`);
console.log(`  메시지: 실현 절감은 *세계가 실제로 희소할 때*(진공 in-loop·S5 승격)만 열린다. 현 별 파이프라인엔 거의 없음.`);
console.log(`  스크린샷: ${path.relative(process.cwd(), outPath)}`);
// 눈 검증 통과 조건: 두 막대가 *크게 다르다*(마이크로벤치 ≫ 실제) + 점유 높음 + PNG.
const ok = microSpeedup > realSpeedup * 5 && avgOcc > 0.5 && pngOk;
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

// step_0014/capture.js — 눈 검증 캡처(engine 직접 PNG 렌더 폴백).
//
//   chromium 부재 → engine 상태를 Node 에서 직접 PNG 로 렌더(step_0006~0013 동일). heat 램프 재사용.
//   같은 별(0013 붕괴, M0=4000)을 두 가지로 그린다 — 2패널:
//     ① 셀(voxel) ρ 투영 — 별이 *수천 셀*로 그려진다(지금까지의 렌더).
//     ② 덩어리 → 구체   — 검출한 덩어리를 *구체 하나*로 그린다(중심=CoM·반지름=등가 구·색=정점밀도).
//   핵심: **같은 별이 ①에선 수천 셀, ②에선 구체 1개** — design/scalability.md §0 목적 ①(덩어리=구체로 보임).
//   환원은 *읽기 전용*(별을 안 건드림)이라 ①②는 같은 세계의 두 표현일 뿐이다.
//
//   실행: node HTJ/steps/step_0014/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Cl = require(path.resolve(__dirname, '../../engine/htj-cluster.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
function heat(t) {
  t = t < 0 || Number.isNaN(t) ? 0 : t > 1 ? 1 : t;
  const f = t * (HEAT.length - 1), i = Math.min(HEAT.length - 2, f | 0), u = f - i;
  const a = HEAT[i], b = HEAT[i + 1];
  return [a[0] + (b[0] - a[0]) * u | 0, a[1] + (b[1] - a[1]) * u | 0, a[2] + (b[2] - a[2]) * u | 0];
}
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
// 셀 ρ 의 z-최대 투영.
function projRho(world) {
  const N = world.N, r = world.fields.energy, proj = new Float64Array(N * N); let mx = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let m = 0; for (let z = 0; z < N; z++) { const v = r[(z * N + y) * N + x]; if (v > m) m = v; }
    proj[y * N + x] = m; if (m > mx) mx = m;
  }
  return { proj, mx };
}
// ① 셀 패널 — voxel ρ 투영을 heat 으로.
function cellPanel(proj, N, cell, scaleMax) {
  const S = N * cell, out = Buffer.alloc(S * S * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 10; out[i + 1] = 12; out[i + 2] = 16; out[i + 3] = 255; }
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const v = proj[((py / cell) | 0) * N + ((px / cell) | 0)];
    if (v <= 1e-9) continue;
    const [R, G, B] = heat(scaleMax > 0 ? v / scaleMax : 0);
    const o = (py * S + px) * 4; out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = 255;
  }
  return { rgba: out, S };
}
// ② 구체 패널 — 검출 덩어리를 그림자 진 원반(구체)으로. 중심=CoM(x,y), 반지름=등가 구, 색=정점밀도.
function spherePanel(clumps, N, cell, peakMax) {
  const S = N * cell, out = Buffer.alloc(S * S * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 10; out[i + 1] = 12; out[i + 2] = 16; out[i + 3] = 255; }
  for (const c of clumps) {
    const cxp = (c.cx + 0.5) * cell, cyp = (c.cy + 0.5) * cell, rp = Math.max(cell * 0.6, c.radius * cell);
    const [R, G, B] = heat(peakMax > 0 ? c.peak / peakMax : 0);
    const x0 = Math.max(0, (cxp - rp) | 0), x1 = Math.min(S - 1, (cxp + rp) | 0);
    const y0 = Math.max(0, (cyp - rp) | 0), y1 = Math.min(S - 1, (cyp + rp) | 0);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const dx = (px - cxp) / rp, dy = (py - cyp) / rp, d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const sh = 0.35 + 0.65 * Math.sqrt(1 - d2);   // 반구 음영(중심 밝고 가장자리 어둡다 = 구체감)
      const o = (py * S + px) * 4;
      out[o] = (R * sh) | 0; out[o + 1] = (G * sh) | 0; out[o + 2] = (B * sh) | 0; out[o + 3] = 255;
    }
  }
  return { rgba: out, S };
}
function compose(panels, gap) {
  const S = panels[0].S, n = panels.length;
  const W2 = S * n + gap * (n + 1), H2 = S + gap * 2;
  const out = Buffer.alloc(W2 * H2 * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 10; out[i + 1] = 12; out[i + 2] = 16; out[i + 3] = 255; }
  panels.forEach((p, k) => {
    const ox = gap + k * (S + gap), oy = gap;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const si = (y * S + x) * 4, di = ((oy + y) * W2 + ox + x) * 4;
      out[di] = p.rgba[si]; out[di + 1] = p.rgba[si + 1]; out[di + 2] = p.rgba[si + 2]; out[di + 3] = 255;
    }
  });
  return { rgba: out, W: W2, H: H2 };
}

const N = 20, cell = 14, gap = 8, rhoCrit = 6, tCrit = 3, STEPS = 120, bodyEps = 2.0;
const w = W.createWorld(N);
Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 4000, T0: 1 });
for (let t = 0; t < STEPS; t++) {
  Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });
  Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
  Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
  Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
  Fu.applyFusion(w, 0.2, { rate: 2, rhoCrit, tCrit });
  Co.applyCooling(w, 0.2, { coolRate: 0.06 });
  Ine.advect(w, 0.2, { scalars: ['therm'] });
}
const fpBefore = w.fingerprint('energy');
const rho = projRho(w);
const clumps = Cl.detectClumps(w, { eps: bodyEps, minCells: 2 });
const peakMax = clumps.reduce((m, c) => Math.max(m, c.peak), 0);
const cellsDrawn = rho.proj.reduce((n, v) => n + (v > bodyEps ? 1 : 0), 0);   // 투영서 본체 셀 수(시각 규모감)
const panels = [
  cellPanel(rho.proj, N, cell, rho.mx),          // ① 별 = 수천 셀
  spherePanel(clumps, N, cell, peakMax),         // ② 별 = 구체 1개
];
const img = compose(panels, gap);
const out = path.join(__dirname, 'capture.png');
writePNG(out, img.W, img.H, img.rgba);

const dominant = clumps[0], total = w.total('energy');
const bodyMass = Cl.totalClumpMass(w, { eps: bodyEps });
const readOnly = w.fingerprint('energy') === fpBefore;
console.log('\n=== 눈 검증: HTJ 덩어리 검출 — 같은 별이 수천 셀(①) vs 구체 1개(②) (N=' + N + '·' + STEPS + '스텝·M0=4000) ===');
console.log(`  ① 셀 렌더 : 본체(ρ>${bodyEps}) 투영 셀 ${cellsDrawn}개 — 별이 수많은 voxel 로 그려진다`);
console.log(`  ② 구체 렌더: 검출 개체 ${clumps.length}개 · 지배 질량 ${dominant ? dominant.mass.toFixed(0) : 0}(본체 ${bodyMass.toFixed(0)}의 ${dominant ? (100 * dominant.mass / bodyMass).toFixed(0) : 0}%) · r=${dominant ? dominant.radius.toFixed(2) : 0} · 중심=(${dominant ? dominant.cx.toFixed(1) : 0},${dominant ? dominant.cy.toFixed(1) : 0})`);
console.log(`  읽기 전용 : 검출이 별을 안 건드림(fp 불변=${readOnly}) · 질량보존 Σρ=${total.toFixed(0)}(=4000)`);
const ok = clumps.length >= 1 && dominant && dominant.mass / bodyMass > 0.8 && readOnly && Math.abs(total - 4000) < 1e-6 && !Number.isNaN(total);
console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

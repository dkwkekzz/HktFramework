// step_0010/capture.js — 눈 검증 캡처(engine 직접 PNG 렌더 폴백).
//
//   chromium 부재 → engine 상태를 Node 에서 직접 PNG 로 렌더(step_0006~0009 동일). heat 램프 재사용.
//   그리는 장 = **질량 밀도 ρ(energy)**(z-최대 투영, 패널별 상대 색). 3패널:
//     ① 초기      — 작고 *뜨거운* 압축 덩어리(정지)
//     ② 열압력 ON — 열이 *능동적으로 밀어* 덩어리가 팽창(u→KE→바깥으로 질량 이동) = 넓게 퍼진 구름
//     ③ 열압력 OFF(Kth=0) — 같은 덩어리, 안 밀림(불활성) = 그대로
//   대비가 핵심: **열은 *능동* 압력**이다 — 내부에너지가 *역학적 일*을 해 물질을 민다(KE↔u 교환). OFF 는 죽은 채.
//
//   실행: node HTJ/steps/step_0010/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));

const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
function heat(t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
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
function panel(world, cell) {
  const N = world.N, r = world.fields.energy;
  const proj = new Float64Array(N * N); let mx = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let m = 0; for (let z = 0; z < N; z++) { const v = r[(z * N + y) * N + x]; if (v > m) m = v; }
    proj[y * N + x] = m; if (m > mx) mx = m;
  }
  const S = N * cell, out = Buffer.alloc(S * S * 4);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const [R, G, B] = heat(mx > 0 ? proj[((py / cell) | 0) * N + ((px / cell) | 0)] / mx : 0);
    const o = (py * S + px) * 4; out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = 255;
  }
  return { rgba: out, S, peak: mx, occ: proj.filter(v => v > mx * 0.3).length };
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

const NGRID = 24, GAMMA = 5 / 3, STEPS = 16, cell = 10, gap = 8;
function evolve(Kth) {
  const N = NGRID, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.10, M0: 1000, T0: 3 });   // 작고 뜨거운 압축 덩어리
  for (let t = 0; t < STEPS; t++) { Th.applyThermalPressure(w, 0.15, { Kth, gamma: GAMMA }); Ine.advect(w, 0.15, { scalars: ['therm'] }); }
  return w;
}
const w0 = (() => { const w = W.createWorld(NGRID); Th.seedWarmBlob(w, { sigma: NGRID * 0.10, M0: 1000, T0: 3 }); return w; })();
const wOn = evolve(0.5), wOff = evolve(0.0);

const p0 = panel(w0, cell), pOn = panel(wOn, cell), pOff = panel(wOff, cell);
const KEon = Th.kineticEnergy(wOn), uOn = Th.totalInternal(wOn), u0 = Th.totalInternal(w0);
const img = compose([p0, pOn, pOff], gap);
const out = path.join(__dirname, 'capture.png');
writePNG(out, img.W, img.H, img.rgba);

console.log('\n=== 눈 검증: HTJ 열압력 되먹임(능동 압력) — 열이 물질을 민다 (N=' + NGRID + '·' + STEPS + '스텝·γ=5/3) ===');
console.log(`  ① 초기 뜨거운 덩어리 : 점유(>.3peak)=${p0.occ}cell  peakρ=${p0.peak.toFixed(2)}  (u=${u0.toFixed(0)})`);
console.log(`  ② 열압력 ON(Kth=0.5) : 점유=${pOn.occ}cell  peakρ=${pOn.peak.toFixed(2)}  → 열이 *밀어* 팽창 (u ${u0.toFixed(0)}→${uOn.toFixed(0)}, KE 0→${KEon.toFixed(0)})`);
console.log(`  ③ 열압력 OFF(Kth=0)  : 점유=${pOff.occ}cell  peakρ=${pOff.peak.toFixed(2)}  → 안 밀림(불활성)`);
const ok = pOn.occ > pOff.occ * 2 && KEon > 100 && uOn < u0;
console.log(`  → ON 이 OFF 보다 ${(pOn.occ / Math.max(1, pOff.occ)).toFixed(1)}× 넓게 퍼짐(열=능동 압력, 내부E→운동E).`);
console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

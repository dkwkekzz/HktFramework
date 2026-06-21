// step_0013/capture.js — 눈 검증 캡처(engine 직접 PNG 렌더 폴백).
//
//   chromium 부재 → engine 상태를 Node 에서 직접 PNG 로 렌더(step_0006~0012 동일). heat 램프 재사용.
//   같은 별(M0=4000)을 120스텝 붕괴시키되 **복사 냉각만 켜고/끈** 두 결과 — 4패널:
//     ① 냉각 OFF ρ(=0012)  ② 냉각 ON ρ  ③ 냉각 OFF T  ④ 냉각 ON T
//   대비가 핵심: **냉각 OFF 별은 제 발열로 *부풀어 흩어진다*(peakρ↓·확산), 냉각 ON 별은 열을 빛으로
//   버려 *조밀하게 뭉친 채 점화를 지속*한다(peakρ↑·밝은 코어).** 복사가 별을 *유지*시킨다 — author 안 함.
//   온도(③④)는 공유 절대 스케일, 밀도(①②)는 패널별 상대(흩어진 OFF 도 형태가 보이게).
//
//   실행: node HTJ/steps/step_0013/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
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
// field='energy'(질량) 또는 'T'(온도, u/ρ). z-최대 투영.
function projField(world, field) {
  const N = world.N, r = world.fields.energy, u = world.fields.therm;
  const proj = new Float64Array(N * N); let mx = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let m = 0;
    for (let z = 0; z < N; z++) {
      const i = (z * N + y) * N + x;
      const v = field === 'T' ? (r[i] > 1e-12 ? u[i] / r[i] : 0) : r[i];
      if (v > m) m = v;
    }
    proj[y * N + x] = m; if (m > mx) mx = m;
  }
  return { proj, mx };
}
function panel(proj, N, cell, scaleMax) {
  const S = N * cell, out = Buffer.alloc(S * S * 4);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const v = proj[((py / cell) | 0) * N + ((px / cell) | 0)];
    const [R, G, B] = heat(scaleMax > 0 ? v / scaleMax : 0);
    const o = (py * S + px) * 4; out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = 255;
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

const N = 20, cell = 11, gap = 8, rhoCrit = 6, tCrit = 3, STEPS = 120;
function collapse(coolRate) {
  const w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 4000, T0: 1 });
  for (let t = 0; t < STEPS; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });
    Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
    Fu.applyFusion(w, 0.2, { rate: 2, rhoCrit, tCrit });
    Co.applyCooling(w, 0.2, { coolRate });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  return w;
}
const off = collapse(0), on = collapse(0.06);   // OFF=0012(과열·흩어짐) vs ON(빛·조밀)
const offRho = projField(off, 'energy'), onRho = projField(on, 'energy');
const offT = projField(off, 'T'), onT = projField(on, 'T');
const Tmax = Math.max(offT.mx, onT.mx);          // 온도 공유 절대 스케일
const panels = [
  panel(offRho.proj, N, cell, offRho.mx),        // ① 냉각 OFF ρ(상대) — 흩어짐
  panel(onRho.proj, N, cell, onRho.mx),          // ② 냉각 ON ρ(상대)  — 조밀
  panel(offT.proj, N, cell, Tmax),               // ③ 냉각 OFF T(절대 공유)
  panel(onT.proj, N, cell, Tmax),                // ④ 냉각 ON T(절대 공유)
];
const img = compose(panels, gap);
const out = path.join(__dirname, 'capture.png');
writePNG(out, img.W, img.H, img.rgba);

console.log('\n=== 눈 검증: HTJ 복사 냉각 — 빛으로 식어야 별이 뭉친 채 빛난다 (N=' + N + '·' + STEPS + '스텝·같은 별 M0=4000) ===');
console.log(`  냉각 OFF(=0012): peakρ=${offRho.mx.toFixed(1)}  maxT=${offT.mx.toFixed(1)}  점화=${Fu.ignitedCount(off, { rhoCrit, tCrit })}셀  빛=0          → 제 발열로 *부풀어 흩어짐*`);
console.log(`  냉각 ON         : peakρ=${onRho.mx.toFixed(1)}  maxT=${onT.mx.toFixed(1)}  점화=${Fu.ignitedCount(on, { rhoCrit, tCrit })}셀  빛=${on.radiated.toFixed(0)}  → 열을 빛으로 버려 *조밀·점화 지속*`);
console.log(`  → 밀도 패널: ON peakρ ${onRho.mx.toFixed(1)} ≫ OFF ${offRho.mx.toFixed(1)} (${(onRho.mx / offRho.mx).toFixed(0)}× 조밀). 복사가 별을 *유지*시킨다(author 안 함).`);
console.log(`  질량보존: OFF Σρ=${off.total('energy').toFixed(0)}·ON Σρ=${on.total('energy').toFixed(0)}(=4000), NaN=${Number.isNaN(on.total('energy'))}`);
const ok = onRho.mx > offRho.mx * 3 && Fu.ignitedCount(on, { rhoCrit, tCrit }) > 0 && on.radiated > 0 && !Number.isNaN(on.total('energy'));
console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

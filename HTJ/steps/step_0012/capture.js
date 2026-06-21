// step_0012/capture.js — 눈 검증 캡처(engine 직접 PNG 렌더 폴백).
//
//   chromium 부재 → engine 상태를 Node 에서 직접 PNG 로 렌더(step_0006~0011 동일). heat 램프 재사용.
//   같은 법칙·같은 임계로 *질량만 다른* 두 덩어리를 붕괴시킨 결과 — 4패널:
//     ① 돌 ρ(가벼움)  ② 별 ρ(무거움)  ③ 돌 T(온도)  ④ 별 T(온도)
//   온도(③④)는 **공유 절대 스케일** — 별(점화·발열)은 *밝게 뜨겁고*, 돌(미점화)은 *어둡게 차갑다*.
//   밀도(①②)는 패널별 상대 — 별은 발열·열압력으로 *부풀고*(peak↓·넓음), 돌은 *조밀하게* 정착(peak↑).
//   대비가 핵심: **같은 법칙에서 별과 돌이 임계로 갈린다**(author 안 함) — 무거우면 별, 가벼우면 돌.
//
//   실행: node HTJ/steps/step_0012/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

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
// field='energy'(질량) 또는 'T'(온도, u/ρ). sharedMax>0 이면 절대 스케일(패널 간 비교).
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

const N = 20, cell = 11, gap = 8, rhoCrit = 6, tCrit = 3;
function collapse(M0) {
  const w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0, T0: 1 });
  for (let t = 0; t < 80; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });
    Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
    Fu.applyFusion(w, 0.2, { rate: 2, rhoCrit, tCrit });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  return w;
}
const rock = collapse(1000), star = collapse(4000);
const rRho = projField(rock, 'energy'), sRho = projField(star, 'energy');
const rT = projField(rock, 'T'), sT = projField(star, 'T');
const Tmax = Math.max(rT.mx, sT.mx);     // 온도 공유 절대 스케일
const panels = [
  panel(rRho.proj, N, cell, rRho.mx),    // ① 돌 ρ(상대)
  panel(sRho.proj, N, cell, sRho.mx),    // ② 별 ρ(상대)
  panel(rT.proj, N, cell, Tmax),         // ③ 돌 T(절대 공유)
  panel(sT.proj, N, cell, Tmax),         // ④ 별 T(절대 공유)
];
const img = compose(panels, gap);
const out = path.join(__dirname, 'capture.png');
writePNG(out, img.W, img.H, img.rgba);

console.log('\n=== 눈 검증: HTJ 내부 발열(별의 점화) — 같은 법칙에서 별과 돌이 갈린다 (N=' + N + '·80스텝·질량만 다름) ===');
console.log(`  돌(M0=1000) : peakρ=${rRho.mx.toFixed(1)}  maxT=${rT.mx.toFixed(1)}  점화셀=${Fu.ignitedCount(rock, { rhoCrit, tCrit })}  → 임계 미달 = *차가운 조밀 덩어리*(돌)`);
console.log(`  별(M0=4000) : peakρ=${sRho.mx.toFixed(1)}  maxT=${sT.mx.toFixed(1)}  u=${Fu.totalInternal(star).toFixed(0)}  → 점화·자기발열 = *뜨겁게 부푼 별*`);
console.log(`  → 온도 패널(공유 절대 스케일): 별은 *밝게 뜨겁고*(maxT ${sT.mx.toFixed(1)}) 돌은 *어둡게 차갑다*(maxT ${rT.mx.toFixed(1)}) — 질량이 별/돌을 가른다(author 안 함).`);
console.log(`  질량보존: 돌 Σρ=${rock.total('energy').toFixed(0)}(=1000)·별 Σρ=${star.total('energy').toFixed(0)}(=4000), NaN=${Number.isNaN(star.total('energy'))}`);
const ok = sT.mx > rT.mx * 2 && sT.mx > tCrit && rT.mx < tCrit && !Number.isNaN(star.total('energy'));
console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

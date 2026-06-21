// step_0011/capture.js — 눈 검증 캡처(engine 직접 PNG 렌더 폴백).
//
//   chromium 부재 → engine 상태를 Node 에서 직접 PNG 로 렌더(step_0006~0010 동일). heat 램프 재사용.
//   그리는 장 = **질량 밀도 ρ(energy)**(z-최대 투영, 패널별 상대 색). 3패널 — 같은 중력+열압력 진동을
//   같은 스텝 굴린 뒤:
//     ① 초기        — 정지한 뜨거운 덩어리(가우시안)
//     ② 점성 OFF    — *무감쇠*: 가역 열압력↔중력이 계속 진동/튕겨 운동E가 크게 남고 흐트러진다
//     ③ 점성 ON     — *감쇠/정착*: bulk KE 가 열로 일방 빠져 진동이 잦아들고 코어가 *가만히 선다*
//   대비가 핵심: **비가역 소산**이 있어야 별이 *정착*한다(잔류 KE 가 OFF≫ON). OFF 는 영영 출렁인다.
//
//   실행: node HTJ/steps/step_0011/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));

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

const NGRID = 16, GAMMA = 5 / 3, STEPS = 60, cell = 14, gap = 8;
function seed() { const w = W.createWorld(NGRID); Th.seedWarmBlob(w, { sigma: NGRID * 0.16, M0: 1000, T0: 1 }); return w; }
function evolve(Kvisc) {
  const w = seed();
  let keMax = 0;
  for (let t = 0; t < STEPS; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });            // 끌어모음(복원력)
    Th.applyThermalPressure(w, 0.2, { Kth: 0.4, gamma: GAMMA }); // 가역 열압력 되밀기 → 진동
    Vi.applyViscosity(w, 0.2, { Kvisc });                       // 비가역 점성 소산(ON/OFF)
    Ine.advect(w, 0.2, { scalars: ['therm'] });
    const ke = Vi.kineticEnergy(w); if (ke > keMax) keMax = ke;
  }
  return { w, keMax };
}
const w0 = seed();
const off = evolve(0.0), on = evolve(0.8);

const p0 = panel(w0, cell), pOff = panel(off.w, cell), pOn = panel(on.w, cell);
const keOff = Vi.kineticEnergy(off.w), keOn = Vi.kineticEnergy(on.w);
const img = compose([p0, pOff, pOn], gap);
const out = path.join(__dirname, 'capture.png');
writePNG(out, img.W, img.H, img.rgba);

console.log('\n=== 눈 검증: HTJ 비가역 소산(인공 점성) — 진동이 *정착*한다 (N=' + NGRID + '·' + STEPS + '스텝·중력+열압력 진동) ===');
console.log(`  ① 초기 뜨거운 덩어리 : 점유(>.3peak)=${p0.occ}cell  peakρ=${p0.peak.toFixed(2)}  (정지, KE=0)`);
console.log(`  ② 점성 OFF(Kvisc=0)  : 점유=${pOff.occ}cell  peakρ=${pOff.peak.toFixed(2)}  → *무감쇠* 진동(잔류 KE=${keOff.toFixed(0)}, peak KE=${off.keMax.toFixed(0)})`);
console.log(`  ③ 점성 ON(Kvisc=0.8) : 점유=${pOn.occ}cell  peakρ=${pOn.peak.toFixed(2)}  → *감쇠/정착*(잔류 KE=${keOn.toFixed(0)}, peak KE=${on.keMax.toFixed(0)})`);
const ok = keOn < keOff * 0.6 && on.keMax < off.keMax;
console.log(`  → 점성 ON 의 잔류 KE 가 OFF 의 ${(keOn / Math.max(1e-9, keOff) * 100).toFixed(0)}% — *비가역 소산이 진동을 정착*시킨다.`);
console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

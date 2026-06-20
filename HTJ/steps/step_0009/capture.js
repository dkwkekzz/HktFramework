// step_0009/capture.js — 눈 검증 캡처(engine 직접 PNG 렌더 폴백).
//
//   정식 경로는 viewer.html 을 headless 브라우저로 띄워 캡처하는 것이지만(viewer/capture.js),
//   이 샌드박스엔 chromium 이 없다. engine 은 렌더러 독립(= 같은 세계)이므로 step_0006~0008 과 동일하게
//   engine 상태를 Node 에서 직접 PNG 로 렌더한다. viewer/htj-render.js 의 heat 램프를 그대로 쓴다.
//
//   그리는 장 = **온도 T=u/ρ**(z-최대 투영, 저밀 셀은 마스크). 3패널(패널별 상대 heat 색):
//     ① 초기      — 균일 온도 구름(T0, 평탄)
//     ② 가열 ON   — 중력↔반발이 구름을 수축시키며 *코어가 압축→가열* = 뜨거운 코어(T↑)
//     ③ 가열 OFF  — 같은 수축이지만 가열 법칙 없음 → T=u/ρ 가 코어에서 *떨어짐*(차가운 코어)
//   대비가 핵심: 압축 가열 법칙이 있어야 압축이 *데운다*. 없으면 (u 가 안 펌프돼) 코어가 식는다.
//
//   실행: node HTJ/steps/step_0009/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));

const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
function heat(t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const f = t * (HEAT.length - 1), i = Math.min(HEAT.length - 2, f | 0), u = f - i;
  const a = HEAT[i], b = HEAT[i + 1];
  return [a[0] + (b[0] - a[0]) * u | 0, a[1] + (b[1] - a[1]) * u | 0, a[2] + (b[2] - a[2]) * u | 0];
}

// ── 최소 PNG 인코더(RGBA, zlib 만) ──
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

// 온도 T=u/ρ 의 z-최대 투영(저밀 셀 마스크) → **공유 절대** 색 스케일(log, Tmax 고정) → RGBA 패널.
//   세 패널 같은 스케일이라야 "차가운 baseline(파랑) ↔ 뜨거운 코어(빨강)" 대비가 정직하게 읽힌다.
//   점유 셀은 최소 밝기(floor) 부여 → 균일 T 도 어둑한 파랑으로 *보인다*(빈 공간과 구분).
function panel(world, cell, Tmax) {
  const N = world.N, rho = world.fields.energy, u = world.fields.therm;
  const mean = world.total('energy') / rho.length, thr = mean * 0.2;   // 저밀 마스크(노이즈 억제)
  const proj = new Float64Array(N * N).fill(-1); let Tcore = 0;
  const c = (N - 1) / 2 | 0, floor = 0.10, lmax = Math.log(Tmax);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let m = -1;
    for (let z = 0; z < N; z++) { const i = (z * N + y) * N + x; if (rho[i] > thr) { const T = u[i] / rho[i]; if (T > m) m = T; } }
    proj[y * N + x] = m;
  }
  { let mc = 0; for (let z = 0; z < N; z++) { const i = (z * N + c) * N + c; if (rho[i] > thr) mc = Math.max(mc, u[i] / rho[i]); } Tcore = mc; }
  const S = N * cell, out = Buffer.alloc(S * S * 4);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const T = proj[((py / cell) | 0) * N + ((px / cell) | 0)];
    const o = (py * S + px) * 4;
    if (T < 0) { out[o] = 10; out[o + 1] = 12; out[o + 2] = 16; out[o + 3] = 255; continue; }  // 빈 공간
    const t = floor + (1 - floor) * Math.min(1, Math.max(0, Math.log(Math.max(1, T)) / lmax));   // 절대 log 스케일
    const [R, G, B] = heat(t);
    out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = 255;
  }
  return { rgba: out, S, Tcore };
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

const NGRID = 24, GRAV = 0.2, KPRESS = 0.2, GAMMA = 5 / 3;
function evolve(heatOn, steps) {
  const N = NGRID, w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 1000, T0: 1 });
  for (let t = 0; t < steps; t++) {
    Gr.applyGravity(w, 0.3, { G: GRAV, iters: 60 });
    Pr.applyPressure(w, 0.3, { K: KPRESS, gamma: 2 });
    Ine.advect(w, 0.3, { scalars: ['therm'] });             // 내부에너지도 질량처럼 흐름을 탄다
    if (heatOn) Th.applyHeating(w, 0.3, { gamma: GAMMA });   // 압축 가열(이 step 법칙)
  }
  return w;
}

const STEPS = 30, cell = 10, gap = 8;
const w0 = (() => { const w = W.createWorld(NGRID); Th.seedWarmBlob(w, { sigma: NGRID * 0.16, M0: 1000, T0: 1 }); return w; })();
const wHeat = evolve(true, STEPS);     // 가열 ON → 뜨거운 코어
const wCold = evolve(false, STEPS);    // 가열 OFF → 차가운 코어

// 공유 절대 스케일 = 가열 ON 코어 온도(가장 뜨거움). 세 패널을 같은 Tmax 로 색칠.
const coreOf = (w) => { const N = w.N, c = (N - 1) / 2 | 0, rho = w.fields.energy, u = w.fields.therm; const thr = w.total('energy') / rho.length * 0.2; let m = 0; for (let z = 0; z < N; z++) { const i = (z * N + c) * N + c; if (rho[i] > thr) m = Math.max(m, u[i] / rho[i]); } return m; };
const Tmax = Math.max(2, coreOf(wHeat));
const p0 = panel(w0, cell, Tmax), pH = panel(wHeat, cell, Tmax), pC = panel(wCold, cell, Tmax);
const img = compose([p0, pH, pC], gap);
const out = path.join(__dirname, 'capture.png');
writePNG(out, img.W, img.H, img.rgba);

console.log('\n=== 눈 검증: HTJ 내부에너지(온도) — 압축 가열 (N=' + NGRID + '·' + STEPS + '스텝·G=' + GRAV + '·K=' + KPRESS + '·γ=5/3) ===');
console.log(`  ① 초기 균일      : 코어 T=${p0.Tcore.toFixed(3)} (균일 T0)`);
console.log(`  ② 가열 ON        : 코어 T=${pH.Tcore.toFixed(3)}  → 압축→*가열* (뜨거운 코어)`);
console.log(`  ③ 가열 OFF       : 코어 T=${pC.Tcore.toFixed(3)}  → 가열 법칙 없음 (코어가 식음)`);
const ok = pH.Tcore > p0.Tcore * 1.2 && pH.Tcore > pC.Tcore * 1.5;
console.log(`  → 압축 가열로 코어가 ${(pH.Tcore / Math.max(1e-9, pC.Tcore)).toFixed(1)}× 더 뜨겁다(가열 ON vs OFF).`);
console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

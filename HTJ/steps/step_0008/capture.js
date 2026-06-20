// step_0008/capture.js — 눈 검증 캡처(engine 직접 PNG 렌더 폴백).
//
//   정식 경로는 viewer.html 을 headless 브라우저로 띄워 캡처하는 것이지만(viewer/capture.js),
//   이 샌드박스엔 chromium 이 없다. engine 은 렌더러 독립(= 같은 세계)이므로 step_0006·0007 과
//   동일하게 engine 상태를 Node 에서 직접 PNG 로 렌더한다. viewer/htj-render.js 의 heat 램프를 그대로 쓴다.
//
//   3패널(질량 밀도 z-최대 투영, heat 색, 패널별 상대 스케일):
//     ① 초기 과밀 구름  ② 중력+반발 → *유한 크기 안정 코어*(붕괴 멈춤)  ③ 중력만 → *한 점 붕괴*(점 스파이크)
//   대비가 핵심: 반발이 있으면 *퍼진 공*으로 서고, 없으면 *한 픽셀*로 무너진다.
//
//   실행: node HTJ/steps/step_0008/capture.js
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));

const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
function heat(t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const f = t * (HEAT.length - 1), i = Math.min(HEAT.length - 2, f | 0), u = f - i;
  const a = HEAT[i], b = HEAT[i + 1];
  return [a[0] + (b[0] - a[0]) * u | 0, a[1] + (b[1] - a[1]) * u | 0, a[2] + (b[2] - a[2]) * u | 0];
}

// ── 최소 PNG 인코더(RGBA, 무압축 의존 없음 — zlib 만) ──
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
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
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;                       // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw);
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

// z-최대 투영(N×N) → 패널별 상대 heat 색으로 cell 픽셀씩 확대 → RGBA 패널.
function panel(world, cell) {
  const N = world.N, r = world.fields.energy;
  const proj = new Float64Array(N * N); let mx = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let m = 0; for (let z = 0; z < N; z++) { const v = r[(z * N + y) * N + x]; if (v > m) m = v; }
    proj[y * N + x] = m; if (m > mx) mx = m;
  }
  const S = N * cell, out = Buffer.alloc(S * S * 4);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const gx = (px / cell) | 0, gy = (py / cell) | 0;
    const [R, G, B] = heat(mx > 0 ? proj[gy * N + gx] / mx : 0);
    const o = (py * S + px) * 4; out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = 255;
  }
  return { rgba: out, S, peak: mx, occ: proj.filter(v => v > mx * 0.3).length };
}

// 패널 여럿을 가로로 합성(간격 gap, 배경 #0a0c10).
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

const NGRID = 24, GRAV = 0.2, KPRESS = 0.2;
function evolve(G, K, steps) {
  const N = NGRID, w = W.createWorld(N);
  Pr.seedBlob(w, { sigma: N * 0.16, M0: 1000 });
  for (let t = 0; t < steps; t++) {
    Gr.applyGravity(w, 0.3, { G, iters: 60 });
    Pr.applyPressure(w, 0.3, { K, gamma: 2 });
    Ine.advect(w, 0.3);
  }
  return w;
}

const STEPS = 36, cell = 10, gap = 8;
const w0 = (() => { const w = W.createWorld(NGRID); Pr.seedBlob(w, { sigma: NGRID * 0.16, M0: 1000 }); return w; })();
const wBalanced = evolve(GRAV, KPRESS, STEPS);   // 중력+반발 → 유한 코어
const wCollapse = evolve(GRAV, 0.0, STEPS);      // 중력만 → 점 붕괴

const p0 = panel(w0, cell), pB = panel(wBalanced, cell), pC = panel(wCollapse, cell);
const img = compose([p0, pB, pC], gap);
const out = path.join(__dirname, 'capture.png');
writePNG(out, img.W, img.H, img.rgba);

console.log('\n=== 눈 검증: HTJ 단거리 반발 (N=' + NGRID + '·' + STEPS + '스텝·G=' + GRAV + '·K=' + KPRESS + '·γ=2) ===');
console.log(`  ① 초기 구름       : peak=${p0.peak.toFixed(2)}  점유(>.3peak)=${p0.occ}cell`);
console.log(`  ② 중력+반발(K=${KPRESS}): peak=${pB.peak.toFixed(2)}  점유=${pB.occ}cell  → 유한 크기 *퍼진 코어*`);
console.log(`  ③ 중력만(K=0)     : peak=${pC.peak.toExponential(2)}  점유=${pC.occ}cell  → *한 점* 붕괴`);
const ok = pB.peak < 1e3 && pC.peak > 10 * pB.peak && pB.occ > pC.occ * 2;
console.log(`  → 반발 코어가 붕괴 점보다 ${(pB.occ / Math.max(1, pC.occ)).toFixed(1)}× 넓게 퍼짐(유한 크기 안정 덩어리).`);
console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
process.exit(ok ? 0 : 1);

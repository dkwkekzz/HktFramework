// step_0107/verify.js — (조립) 바이옴 지형 3D 음영 표면: biome+terrain 높이장을 0074/0068 표면 파이프라인으로
//   점→면 환원(heights+normals)하고 *hillshade*(n·L)로 3D 입체 발현. 0090~0096 은 *평평한 top-down 색*이었다 —
//   여기선 같은 바이옴 지형을 *음영 표면*으로(산이 산처럼·골이 골처럼). 조립(engine 변경 0·viewer 표면 유틸+biomeField).
//   순수·독립·영구. 실행: node HTJ/steps/step_0107/verify.js
'use strict';
const path = require('path');
const Surf = require(path.resolve(__dirname, '../../viewer/htj-surface.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

const M = 28, SCALE = 0.10, AMP = 14;
const elevFn = (x, y) => AMP * Stream.fbm(x * SCALE, y * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
const elev01 = (x, y) => Stream.fbm(x * SCALE, y * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });   // [0,1] 고도축
const bf = Stream.biomeField({ scale: SCALE, nTemp: 3, nHum: 3, octaves: 4, gain: 0.55, lapse: 0.6, elevFn: elev01 });
const COLD = 0.30;                                                  // effTemp < COLD = 찬 바이옴(산)

// 빛 방향(좌상·위) — hillshade n·L.
const Lx = -0.5, Ly = -0.5, Lz = 1.0; const Lm = Math.hypot(Lx, Ly, Lz);
const lx = Lx / Lm, ly = Ly / Lm, lz = Lz / Lm;

function build() {
  const pts = [];
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) pts.push({ cx: x, cy: y, cz: elevFn(x, y), r: 1.3 });
  const surf = Surf.pointCloudSurface(pts, { res: 56, pad: 0.02 });
  return surf;
}
const surf = build();

// ① 표면 재구성 충실 — 점→면(0068) heights 가 입력 terrain 과 일치(샘플 corr > 0.9): 점 무리가 이어진 면.
(() => {
  const a = [], b = [];
  for (let J = 0; J < surf.ny; J += 2) for (let I = 0; I < surf.nx; I += 2) {
    const wx = surf.x0 + I * surf.dx, wy = surf.y0 + J * surf.dy;
    if (wx < 0 || wx > M - 1 || wy < 0 || wy > M - 1) continue;
    a.push(surf.heights[J * surf.nx + I]); b.push(elevFn(wx, wy));
  }
  const ma = mean(a), mb = mean(b); let cov = 0, va = 0, vb = 0;
  for (let k = 0; k < a.length; k++) { const da = a[k] - ma, db = b[k] - mb; cov += da * db; va += da * da; vb += db * db; }
  const corr = cov / (Math.sqrt(va * vb) || 1);
  ok(corr > 0.9, `표면 재구성 충실 — corr(표면 heights, terrain) = ${corr.toFixed(3)} > 0.9 (점→면 파이프라인)`);
})();

// ② 음영 입체감(hillshade) — 경사진 곳일수록 음영 변동이 크다(평평 색이 아니라 3D): 경사 셀 밝기 std > 평지 셀 std.
(() => {
  const bright = [], slope = [];
  for (let k = 0; k < surf.count; k++) {
    const n = surf.normals[k]; bright.push(Math.max(0, n.x * lx + n.y * ly + n.z * lz));
    slope.push(Math.hypot(n.x, n.y) / Math.max(n.z, 1e-6));         // |∇h| (경사)
  }
  const med = slope.slice().sort((a, b) => a - b)[slope.length >> 1];
  const flat = [], steep = [];
  for (let k = 0; k < slope.length; k++) (slope[k] <= med ? flat : steep).push(bright[k]);
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) * (v - m)))); };
  const sFlat = sd(flat), sSteep = sd(steep), rng = Math.max(...bright) - Math.min(...bright);
  ok(sSteep > sFlat * 1.5 && rng > 0.25, `음영 입체감 — 밝기 std 경사 ${sSteep.toFixed(3)} > 평지 ${sFlat.toFixed(3)}×1.5·대비 ${rng.toFixed(2)}>0.25 (3D 음영)`);
})();

// ③ 바이옴 결합 자기일관 — 표면 *높은 곳*(산)이 *찬 바이옴*(0095 elevFn 결합이 음영 표면에 보임).
(() => {
  const coldH = [], warmH = [];
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const b = bf(x, y), h = elevFn(x, y);
    if (b.effTemp < COLD) coldH.push(h); else warmH.push(h);
  }
  const mC = mean(coldH), mW = mean(warmH);
  ok(coldH.length >= 8 && mC > mW + 1.0, `바이옴 결합 — 찬 바이옴 평균 고도 ${mC.toFixed(1)} > 따뜻 ${mW.toFixed(1)}(산이 차다·relief 로 보임)`);
})();

// ④ 결정론 — 같은 지형 → 같은 표면.
show(L.deterministic('같은 지형 → 같은 음영 표면', () => { const s = build(); return [s.heights.slice(0, 50).map(v => Math.round(v * 1e3)), s.normals.slice(0, 50).map(n => Math.round(n.z * 1e3))]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);

// tools/htj-capture.js — HTJ 눈 검증 캡처 공유 헬퍼 (확인용 도구·engine 아님).
//
//   왜: step 마다 capture.js 가 PNG 인코더(crc32/writePNG)·heat 색·disc 그리기를 *매번 새로 구현*해 왔다
//   (~35줄 중복). 이 모듈이 그 보일러플레이트를 한 곳에 모은다 — 앞으로의 capture.js 는 *장면·프레임*만 짜고
//   여기 `writeFramesPNG` 한 번 호출하면 된다(~15줄). 닫은 step 의 capture.js 는 불변이라 소급 적용 안 함.
//
//   이건 viewer 쪽 확인용 도구다 — engine 은 이걸 절대 모른다(세계↔확인용 단방향 의존). Node 전용(fs/zlib).
//
//   API:
//     writePNG(file, w, h, rgbaBuffer)                      — 최소 PNG(RGBA8) 1장 쓰기.
//     heatColor(t) -> [r,g,b]                               — 0..1 → 파랑(차가움)→빨강→노랑(뜨거움) heat 색.
//     writeFramesPNG(outPath, frames, opts) -> {Wd,Hd}      — N-패널 top-down 디스크 그리드(0040~0044 공통 패턴).
//       frames: [{ pts: [{cx, cy, r?, v}] }]  (cx,cy=월드 좌표·r=반지름(옵션·기본 작은 점)·v=색값 0..1)
//       opts:   { N(월드 한 변·패널 스케일), cellPx=7, gap=18, pad=20, labelH=18, bg=[10,12,18],
//                 color=heatColor(기본·v→[r,g,b]) }
'use strict';
const fs = require('fs'), zlib = require('zlib');

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, cr]); }

// 최소 PNG(8비트 RGBA·필터 0) 1장 쓰기.
function writePNG(file, w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// heat 색: 0=어두운 파랑(차가움/옅음) → 0.5=빨강 → 1=노랑(뜨거움/밀집).
function heatColor(t) {
  t = Math.max(0, Math.min(1, t));
  const r = Math.min(255, t * 510), g = Math.min(255, Math.max(0, (t - 0.3) * 510)), b = Math.max(0, (0.4 - t) * 510) + t * 120;
  return [r | 0, g | 0, b | 0];
}

// N-패널 top-down 디스크 그리드 — frames 를 가로로 나란히 그린다(시간 경과). 각 점=반지름 디스크·색=v.
function writeFramesPNG(outPath, frames, opts) {
  opts = opts || {};
  const N = opts.N != null ? opts.N : 48, cellPx = opts.cellPx || 7, gap = opts.gap || 18;
  const pad = opts.pad || 20, lab = opts.labelH != null ? opts.labelH : 18, bg = opts.bg || [10, 12, 18];
  const color = opts.color || heatColor;
  const nF = frames.length, panel = N * cellPx;
  const Wd = pad * 2 + panel * nF + gap * (nF - 1), Hd = pad * 2 + lab + panel;
  const out = Buffer.alloc(Wd * Hd * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = bg[0]; out[i + 1] = bg[1]; out[i + 2] = bg[2]; out[i + 3] = 255; }
  const px = (x, y, r, g, b) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= Wd || y >= Hd) return; const o = (y * Wd + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; };
  const box = (ox, oy) => { for (let x = 0; x <= panel; x++) { px(ox + x, oy, 42, 50, 66); px(ox + x, oy + panel, 42, 50, 66); } for (let y = 0; y <= panel; y++) { px(ox, oy + y, 42, 50, 66); px(ox + panel, oy + y, 42, 50, 66); } };
  const disc = (ox, oy, cx, cy, rad, col) => {
    const sx = ox + cx * cellPx, sy = oy + cy * cellPx, rp = Math.max(cellPx * 0.6, (rad || 0) * cellPx * 0.9), r2 = rp * rp;
    for (let dy = -rp; dy <= rp; dy++) for (let dx = -rp; dx <= rp; dx++) { const d2 = dx * dx + dy * dy; if (d2 > r2) continue; const f = 0.5 + 0.5 * (1 - Math.sqrt(d2) / rp); px(sx + dx, sy + dy, (col[0] * f) | 0, (col[1] * f) | 0, (col[2] * f) | 0); }
  };
  for (let k = 0; k < nF; k++) {
    const ox = pad + k * (panel + gap), oy = pad + lab; box(ox, oy);
    for (const p of frames[k].pts) disc(ox, oy, p.cx, p.cy, p.r, color(p.v != null ? p.v : 0));
  }
  writePNG(outPath, Wd, Hd, out);
  return { Wd, Hd };
}

module.exports = { writePNG, heatColor, writeFramesPNG };

// ============================================================================
//  flesh-visualize.mjs — 살 DNA/필드를 **이미지로 렌더**해 직관적으로 보고한다.
//
//    node tools/flesh-visualize.mjs
//
//  CLAUDE.md 작업 방식: "검증은 캡처해 직관적으로 보고한다 — 수치 나열로 끝내지
//  말고 스크린샷·오버레이·비교 이미지로 남긴다. 샌드박스 headless Chromium 이
//  막혀도 Node 로 대체하되 **형태는 시각**이어야 한다."
//
//  브라우저 없이 순수 함수(buildSegs/fillField)만으로 합성 인간형 스켈레톤을 세우고
//  살 필드를 채운 뒤, 정사영 실루엣(정면·측면)과 프로파일 곡선을 SVG(+임베드 PNG)로
//  굽는다. 결과: docs/flesh-silhouette.svg · docs/flesh-profiles.svg
// ============================================================================
import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { defaultDna, compileDna, presetDna, samplePchip } from '../src/fleshdna.js';
import { buildSegs, fillField, HALF, CENTER_Y, ISO } from '../src/mcflesh.js';

// ---------------------------------------------------------------------------
//  최소 PNG(RGB8) 인코더 — node:zlib 사용, 외부 의존 없음.
// ---------------------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy ? rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3) : raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1); }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const pngDataUri = (w, h, rgb) => 'data:image/png;base64,' + encodePNG(w, h, rgb).toString('base64');

// ---------------------------------------------------------------------------
//  합성 인간형 T-포즈 스켈레톤 (키 ~1.7m, 정면 +z). 이름은 simpleName 그대로.
// ---------------------------------------------------------------------------
function humanoid() {
  // 자연스러운 A-포즈(팔 내림) + 실제 비율. T-포즈 막대인간을 피해 DNA 를 공정히 본다.
  const P = {
    hips: [0, 0.95, 0], spine: [0, 1.04, 0], spine1: [0, 1.14, 0], spine2: [0, 1.30, 0],
    neck: [0, 1.46, 0], head: [0, 1.54, 0], headtop_end: [0, 1.70, 0],
  };
  const side = (s, sx) => {
    // 팔은 어깨→아래 바깥 ~30° (A-포즈)
    P[`${s}shoulder`] = [0.045 * sx, 1.44, 0]; P[`${s}arm`] = [0.16 * sx, 1.40, 0.01];
    P[`${s}forearm`] = [0.30 * sx, 1.13, 0.02]; P[`${s}hand`] = [0.40 * sx, 0.92, 0.03]; P[`${s}handend`] = [0.43 * sx, 0.85, 0.03];
    P[`${s}upleg`] = [0.10 * sx, 0.90, 0]; P[`${s}leg`] = [0.11 * sx, 0.50, 0.01];
    P[`${s}foot`] = [0.11 * sx, 0.08, -0.02]; P[`${s}toe`] = [0.11 * sx, 0.025, 0.11]; P[`${s}toeend`] = [0.11 * sx, 0.02, 0.16];
  };
  side('left', 1); side('right', -1);
  const parent = {
    spine: 'hips', spine1: 'spine', spine2: 'spine1', neck: 'spine2', head: 'neck', headtop_end: 'head',
  };
  for (const s of ['left', 'right']) {
    parent[`${s}shoulder`] = 'spine2'; parent[`${s}arm`] = `${s}shoulder`; parent[`${s}forearm`] = `${s}arm`;
    parent[`${s}hand`] = `${s}forearm`; parent[`${s}handend`] = `${s}hand`;
    parent[`${s}upleg`] = 'hips'; parent[`${s}leg`] = `${s}upleg`; parent[`${s}foot`] = `${s}leg`;
    parent[`${s}toe`] = `${s}foot`; parent[`${s}toeend`] = `${s}toe`;
  }
  const root = new THREE.Object3D();
  const bones = {};
  // 부모 먼저 생성되도록 위상 정렬 순회
  const order = ['hips', 'spine', 'spine1', 'spine2', 'neck', 'head', 'headtop_end'];
  for (const s of ['left', 'right']) order.push(`${s}shoulder`, `${s}arm`, `${s}forearm`, `${s}hand`, `${s}handend`, `${s}upleg`, `${s}leg`, `${s}foot`, `${s}toe`, `${s}toeend`);
  for (const name of order) {
    const b = new THREE.Bone(); b.name = name;
    const par = parent[name] ? bones[parent[name]] : root;
    const pw = parent[name] ? P[parent[name]] : [0, 0, 0];
    b.position.set(P[name][0] - pw[0], P[name][1] - pw[1], P[name][2] - pw[2]);
    par.add(b); bones[name] = b;
  }
  root.updateMatrixWorld(true);
  const list = order.map(n => bones[n]);
  const ch = { root, bones: list, allBones: list, slotX: 0, dna: null, dnaCompiled: null, bindWorldQ: new Map() };
  const q = new THREE.Quaternion();
  for (const b of list) ch.bindWorldQ.set(b, b.getWorldQuaternion(q).clone());
  return ch;
}

// ---------------------------------------------------------------------------
//  DNA → 살 필드(res³) → 정사영 실루엣 RGB 버퍼(패널 하나).
//  view: 'front'(z 투영) | 'side'(x 투영). 각 픽셀 = 그 시선축에 iso 넘는 복셀 존재?
// ---------------------------------------------------------------------------
const RES = 150;
const half = RES / 2, gs = half / HALF;
function silhouette(dna, view, color) {
  const ch = humanoid();
  ch.dna = dna; ch.dnaCompiled = compileDna(dna);
  const { segs, cuts } = buildSegs(ch, n => n.toLowerCase(), gs, half);
  const field = new Float32Array(RES ** 3);
  fillField(field, { size: RES, yd: RES, zd: RES * RES }, segs, cuts);
  // 세로는 항상 y. 가로는 front→x, side→z. 깊이는 나머지 축.
  const W = RES, H = RES;
  const rgb = Buffer.alloc(W * H * 3);
  const [br, bg, bb] = [24, 26, 32];   // 배경
  const [fr, fg, fb] = color;          // 채움
  // 은은한 명암: 깊이 방향 최대 필드값으로 밝기 변조 (실루엣 + 볼륨감)
  for (let iy = 0; iy < H; iy++) {
    const gy = H - 1 - iy; // 이미지 위=높은 y
    for (let ix = 0; ix < W; ix++) {
      let maxF = 0;
      if (view === 'front') { for (let gz = 0; gz < RES; gz++) { const v = field[gz * RES * RES + gy * RES + ix]; if (v > maxF) maxF = v; } }
      else { for (let gx = 0; gx < RES; gx++) { const v = field[ix * RES * RES + gy * RES + gx]; if (v > maxF) maxF = v; } }
      const o = (iy * W + ix) * 3;
      if (maxF >= ISO) {
        const sh = 0.55 + 0.45 * Math.min(1, (maxF - ISO) / (1 - ISO)); // 안쪽일수록 밝게
        rgb[o] = fr * sh; rgb[o + 1] = fg * sh; rgb[o + 2] = fb * sh;
      } else { rgb[o] = br; rgb[o + 1] = bg; rgb[o + 2] = bb; }
    }
  }
  return pngDataUri(W, H, rgb);
}

// ---------------------------------------------------------------------------
//  실루엣 비교 SVG — 프리셋 정면 나란히 + humanlike 측면(flatten 확인).
// ---------------------------------------------------------------------------
function buildSilhouetteSVG() {
  const panels = [
    { label: 'humanlike · 정면', uri: silhouette(defaultDna(), 'front', [140, 200, 255]) },
    { label: 'humanlike · 측면(flatten)', uri: silhouette(defaultDna(), 'side', [140, 200, 255]) },
    { label: 'robot(상수)', uri: silhouette(presetDna('robot'), 'front', [150, 160, 170]) },
    { label: 'slim(허리 잘록)', uri: silhouette(presetDna('slim'), 'front', [160, 230, 180]) },
    { label: 'bulk(몸통·팔↑)', uri: silhouette(presetDna('bulk'), 'front', [255, 190, 140]) },
  ];
  const pw = 150, ph = 150, gap = 14, padT = 46, padB = 30, padX = 14;
  const W = padX * 2 + panels.length * pw + (panels.length - 1) * gap;
  const H = padT + ph + padB;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif">`;
  s += `<rect width="${W}" height="${H}" fill="#14161a"/>`;
  s += `<text x="${padX}" y="26" fill="#dfe3ea" font-size="16" font-weight="700">살 DNA 실루엣 검증 — 합성 인간형 T-포즈, Node 렌더 (res ${RES})</text>`;
  panels.forEach((p, i) => {
    const x = padX + i * (pw + gap);
    s += `<image x="${x}" y="${padT}" width="${pw}" height="${ph}" href="${p.uri}" style="image-rendering:pixelated"/>`;
    s += `<rect x="${x}" y="${padT}" width="${pw}" height="${ph}" fill="none" stroke="#2c333d"/>`;
    s += `<text x="${x + pw / 2}" y="${padT + ph + 18}" fill="#9fb4d0" font-size="12" text-anchor="middle">${p.label}</text>`;
  });
  s += `</svg>`;
  return s;
}

// ---------------------------------------------------------------------------
//  프로파일 곡선 SVG — 세그먼트별 PCHIP(부모0→자식1 축의 살 반지름).
//  "형태 DNA" 를 한눈에: 허리 잘록·종아리 볼록·상완 이두 등이 곡선으로 보인다.
// ---------------------------------------------------------------------------
function buildProfilesSVG() {
  const dna = defaultDna();
  const segs = dna.segments.filter(s => s.profile.some(p => p[1] > 0)); // r=0(손가락) 제외
  const cols = 5, cw = 150, chh = 110, gap = 10, padT = 44, padX = 14, padB = 14;
  const rows = Math.ceil(segs.length / cols);
  const W = padX * 2 + cols * cw + (cols - 1) * gap;
  const H = padT + rows * (chh + 26) + padB;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif">`;
  s += `<rect width="${W}" height="${H}" fill="#14161a"/>`;
  s += `<text x="${padX}" y="26" fill="#dfe3ea" font-size="16" font-weight="700">살 프로파일 곡선 (PCHIP) — x=부모0→자식1 축, y=살 반지름(m)</text>`;
  // 공통 y 스케일 (전 세그먼트 최대 반지름)
  let rMax = 0; for (const seg of segs) for (const p of seg.profile) rMax = Math.max(rMax, p[1]);
  rMax *= 1.1;
  segs.forEach((seg, i) => {
    const cx = padX + (i % cols) * (cw + gap), cy = padT + Math.floor(i / cols) * (chh + 26);
    s += `<rect x="${cx}" y="${cy}" width="${cw}" height="${chh}" fill="#181b21" stroke="#2c333d"/>`;
    const lut = samplePchip(seg.profile);
    const X = t => cx + 8 + t * (cw - 16);
    const Y = r => cy + chh - 8 - (r / rMax) * (chh - 16);
    // 곡선
    let d = '';
    for (let k = 0; k < lut.length; k++) d += `${k ? 'L' : 'M'}${X(k / (lut.length - 1)).toFixed(1)},${Y(lut[k]).toFixed(1)}`;
    s += `<path d="${d}" fill="none" stroke="#3b82f6" stroke-width="2"/>`;
    // 제어점
    for (const [t, r] of seg.profile) s += `<circle cx="${X(t).toFixed(1)}" cy="${Y(r).toFixed(1)}" r="2.5" fill="#ffd166"/>`;
    const flat = seg.flatten ? ` · flat ${seg.flatten.f}` : '';
    s += `<text x="${cx + cw / 2}" y="${cy + chh + 16}" fill="#9fb4d0" font-size="11" text-anchor="middle">${seg.match}${flat}</text>`;
  });
  s += `</svg>`;
  return s;
}

// 5패널을 한 장 PNG 로 합성 (SVG 미지원 뷰어·자기검증 공용).
function buildCombinedPNG() {
  const panels = [
    silRGB(defaultDna(), 'front', [140, 200, 255]),
    silRGB(defaultDna(), 'side', [140, 200, 255]),
    silRGB(presetDna('robot'), 'front', [150, 160, 170]),
    silRGB(presetDna('slim'), 'front', [160, 230, 180]),
    silRGB(presetDna('bulk'), 'front', [255, 190, 140]),
  ];
  const gap = 6, W = panels.length * RES + (panels.length - 1) * gap, H = RES;
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H * 3; i += 3) { out[i] = 20; out[i + 1] = 22; out[i + 2] = 27; }
  panels.forEach((p, pi) => {
    const x0 = pi * (RES + gap);
    for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
      const src = (y * RES + x) * 3, dst = (y * W + x0 + x) * 3;
      out[dst] = p[src]; out[dst + 1] = p[src + 1]; out[dst + 2] = p[src + 2];
    }
  });
  return encodePNG(W, H, out);
}
// 실루엣을 RGB 버퍼로 직접 (PNG 우회) — 위 silhouette 과 동일 로직, 합성용.
function silRGB(dna, view, color) {
  const ch = humanoid(); ch.dna = dna; ch.dnaCompiled = compileDna(dna);
  const { segs, cuts } = buildSegs(ch, n => n.toLowerCase(), gs, half);
  const field = new Float32Array(RES ** 3);
  fillField(field, { size: RES, yd: RES, zd: RES * RES }, segs, cuts);
  const rgb = Buffer.alloc(RES * RES * 3);
  const [fr, fg, fb] = color;
  for (let iy = 0; iy < RES; iy++) { const gy = RES - 1 - iy; for (let ix = 0; ix < RES; ix++) {
    let maxF = 0;
    if (view === 'front') { for (let gz = 0; gz < RES; gz++) { const v = field[gz * RES * RES + gy * RES + ix]; if (v > maxF) maxF = v; } }
    else { for (let gx = 0; gx < RES; gx++) { const v = field[ix * RES * RES + gy * RES + gx]; if (v > maxF) maxF = v; } }
    const o = (iy * RES + ix) * 3;
    if (maxF >= ISO) { const sh = 0.55 + 0.45 * Math.min(1, (maxF - ISO) / (1 - ISO)); rgb[o] = fr * sh; rgb[o + 1] = fg * sh; rgb[o + 2] = fb * sh; }
    else { rgb[o] = 20; rgb[o + 1] = 22; rgb[o + 2] = 27; }
  } }
  return rgb;
}

writeFileSync(new URL('../docs/flesh-silhouette.svg', import.meta.url), buildSilhouetteSVG());
writeFileSync(new URL('../docs/flesh-profiles.svg', import.meta.url), buildProfilesSVG());
writeFileSync(new URL('../docs/flesh-silhouette.png', import.meta.url), buildCombinedPNG());
console.log('wrote docs/flesh-silhouette.svg · docs/flesh-profiles.svg · docs/flesh-silhouette.png');

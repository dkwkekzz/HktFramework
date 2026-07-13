// ============================================================================
//  flesh-visualize.mjs — 살 DNA/필드를 **이미지로 렌더**해 직관적으로 보고한다.
//
//    node tools/flesh-visualize.mjs
//
//  CLAUDE.md 작업 방식: "검증은 캡처해 직관적으로 보고한다 — 수치 나열로 끝내지
//  말고 스크린샷·오버레이·비교 이미지로 남긴다. 샌드박스 headless Chromium 이
//  막혀도 Node 로 대체하되 **형태는 시각**이어야 한다."
//
//  브라우저 없이, **실제 X Bot FBX 스켈레톤**(앱과 동일 정규화)에 순수 함수
//  (buildSegs/fillField)로 살 필드를 채운 뒤, 정사영 실루엣(정면·측면)과 프로파일
//  곡선을 SVG(+임베드 PNG)로 굽는다. 결과: docs/flesh-silhouette.svg · docs/flesh-profiles.svg
// ============================================================================
import zlib from 'node:zlib';
import { writeFileSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
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
//  **실제 X Bot / Y Bot FBX** 스켈레톤을 로드해 앱과 동일하게 정규화한다.
//  (합성 리그가 아니라 진짜 뼈 위에서 살 DNA 를 렌더 — 앱 결과의 충실한 프리뷰.)
//  simpleName 규약·본 월드 bbox 정규화(키 1.7m)·발 접지·x 중심 정렬은 main.js 를 따른다.
// ---------------------------------------------------------------------------
const simpleName = n => n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();
const _fbxCache = {};
function loadFBXCh(file, dna) {
  if (!_fbxCache[file]) {
    const buf = readFileSync(new URL(`../public/assets/character/${file}`, import.meta.url));
    _fbxCache[file] = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const obj = new FBXLoader().parse(_fbxCache[file], '');
  const allBones = []; obj.traverse(o => { if (o.isBone) allBones.push(o); });
  // 구동 뼈 = simpleName 별 DFS-첫 뼈(항상 조상 등뼈) — main.js makeCh 규약.
  const seen = new Map(); const drivers = [];
  for (const b of allBones) { const sn = simpleName(b.name); if (!seen.has(sn)) { seen.set(sn, b); drivers.push(b); } }
  // 뼈 월드 bbox 로 키 1.7m 정규화(스킨 아님) → 발 접지 → x/z 중심 (main.js 와 동일).
  obj.scale.setScalar(1); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  const box = new THREE.Box3(); for (const b of drivers) box.expandByPoint(b.getWorldPosition(p));
  const size = new THREE.Vector3(); box.getSize(size);
  obj.scale.setScalar(1.7 / Math.max(size.y, 1e-3)); obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3(); for (const b of drivers) box2.expandByPoint(b.getWorldPosition(p));
  const c = new THREE.Vector3(); box2.getCenter(c);
  obj.position.set(-c.x, -box2.min.y, -c.z); obj.updateMatrixWorld(true);
  const ch = { root: obj, bones: drivers, allBones: drivers, slotX: 0, dna, dnaCompiled: compileDna(dna), bindWorldQ: new Map() };
  const q = new THREE.Quaternion();
  for (const b of drivers) ch.bindWorldQ.set(b, b.getWorldQuaternion(q).clone());
  return ch;
}

// ---------------------------------------------------------------------------
//  DNA → 살 필드(res³) → 정사영 실루엣 RGB 버퍼(패널 하나).
//  view: 'front'(z 투영) | 'side'(x 투영). 각 픽셀 = 그 시선축에 iso 넘는 복셀 존재?
// ---------------------------------------------------------------------------
const RES = 200;
const half = RES / 2, gs = half / HALF;
const BASE_FBX = 'X Bot.fbx';
function silhouette(dna, view, color) {
  const ch = loadFBXCh(BASE_FBX, dna);
  const { segs, cuts, blobs } = buildSegs(ch, simpleName, gs, half);
  const field = new Float32Array(RES ** 3);
  fillField(field, { size: RES, yd: RES, zd: RES * RES }, segs, cuts, blobs);
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
    { label: 'female · 정면(blob 가슴·엉덩이)', uri: silhouette(presetDna('female'), 'front', [255, 180, 200]) },
    { label: 'female · 측면(가슴 볼륨)', uri: silhouette(presetDna('female'), 'side', [255, 180, 200]) },
    { label: 'slim · 정면', uri: silhouette(presetDna('slim'), 'front', [160, 230, 180]) },
    { label: 'bulk · 정면', uri: silhouette(presetDna('bulk'), 'front', [255, 190, 140]) },
  ];
  const pw = 150, ph = 150, gap = 14, padT = 46, padB = 30, padX = 14;
  const W = padX * 2 + panels.length * pw + (panels.length - 1) * gap;
  const H = padT + ph + padB;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif">`;
  s += `<rect width="${W}" height="${H}" fill="#14161a"/>`;
  s += `<text x="${padX}" y="26" fill="#dfe3ea" font-size="16" font-weight="700">살 DNA 실루엣 검증 — 실제 X Bot FBX 스켈레톤(T-포즈), Node 렌더 (res ${RES})</text>`;
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
    silRGB(presetDna('female'), 'front', [255, 180, 200]),
    silRGB(presetDna('female'), 'side', [255, 180, 200]),
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
  const ch = loadFBXCh(BASE_FBX, dna);
  const { segs, cuts, blobs } = buildSegs(ch, simpleName, gs, half);
  const field = new Float32Array(RES ** 3);
  fillField(field, { size: RES, yd: RES, zd: RES * RES }, segs, cuts, blobs);
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

// 콘텐츠 bbox 로 크롭 후 정수배 확대(nearest) — 작은 특징(가슴·엉덩이)을 크게 본다.
function cropScale(rgb, scale) {
  let minx = RES, miny = RES, maxx = 0, maxy = 0;
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) { const o = (y * RES + x) * 3; if (rgb[o] > 30 || rgb[o + 1] > 30 || rgb[o + 2] > 30) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; } }
  const pad = 4; minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad); maxx = Math.min(RES - 1, maxx + pad); maxy = Math.min(RES - 1, maxy + pad);
  const cw = maxx - minx + 1, chh = maxy - miny + 1;
  return { w: cw * scale, h: chh * scale, get: (x, y) => { const sx = minx + ((x / scale) | 0), sy = miny + ((y / scale) | 0); return (sy * RES + sx) * 3; }, rgb };
}
// female 정면·측면 — 크롭·2배 확대 2패널 (blob 볼륨 확인용).
function buildFemalePNG() {
  const scale = 2;
  const A = cropScale(silRGB(presetDna('female'), 'front', [255, 180, 200]), scale);
  const B = cropScale(silRGB(presetDna('female'), 'side', [255, 180, 200]), scale);
  const gap = 12, H = Math.max(A.h, B.h), W = A.w + gap + B.w;
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < out.length; i += 3) { out[i] = 20; out[i + 1] = 22; out[i + 2] = 27; }
  const blit = (P, x0) => { for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) { const s = P.get(x, y), d = (y * W + x0 + x) * 3; out[d] = P.rgb[s]; out[d + 1] = P.rgb[s + 1]; out[d + 2] = P.rgb[s + 2]; } };
  blit(A, 0); blit(B, A.w + gap);
  return encodePNG(W, H, out);
}

writeFileSync(new URL('../docs/flesh-silhouette.svg', import.meta.url), buildSilhouetteSVG());
writeFileSync(new URL('../docs/flesh-profiles.svg', import.meta.url), buildProfilesSVG());
writeFileSync(new URL('../docs/flesh-silhouette.png', import.meta.url), buildCombinedPNG());
writeFileSync(new URL('../docs/flesh-female.png', import.meta.url), buildFemalePNG());
console.log('wrote docs/flesh-silhouette.svg · docs/flesh-profiles.svg · docs/flesh-silhouette.png · docs/flesh-female.png');

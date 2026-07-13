// ============================================================================
//  flesh-shot.mjs — 살 워프 실루엣 캡처 (headless Chromium 대체 시각 검증)
//
//  WebGL 없이 원본 스킨 메시 정점을 월드(바인드)로 변환해 정사영 실루엣을 래스터화한다.
//  각 DNA 상태마다 원본(회색)↔워프(시안)를 겹쳐 그려, 워프가 실루엣을 어떻게 조각했는지
//  (허리 잘록·골반 폭·가슴/둔부 bump) 한눈에 보이게 한다. 결과: tools/flesh-shot.png.
//  `npm run shot` 또는 `node tools/flesh-shot.mjs`.
// ============================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { deflateSync } from 'zlib';
import { defaultDna, presetDna, compileDna } from '../src/fleshdna.js';
import { FleshWarp } from '../src/fleshwarp.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const simpleName = n => n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();
const MODEL = process.argv[2] || 'public/assets/character/Y Bot.fbx';

// ---- makeCh 핵심 재현 (월드=미터) ----
function loadCh(file) {
  const buf = readFileSync(join(ROOT, file));
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const meshes = [], bones = [];
  obj.traverse(o => { if (o.isSkinnedMesh || o.isMesh) meshes.push(o); if (o.isBone) bones.push(o); });
  const boneMap = new Map(); const drivers = []; let dup = 0;
  for (const b of bones) { const sn = simpleName(b.name); if (!boneMap.has(sn)) { boneMap.set(sn, b); drivers.push(b); } else b.name = `${b.name}__dup${dup++}`; }
  for (const b of bones) b.scale.setScalar(1);
  obj.scale.setScalar(1); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  const box = new THREE.Box3(), p = new THREE.Vector3();
  for (const b of drivers) box.expandByPoint(b.getWorldPosition(p));
  const s = new THREE.Vector3(); box.getSize(s);
  obj.scale.setScalar(1.7 / Math.max(s.y, 1e-3)); obj.updateMatrixWorld(true);
  const ch = { root: obj, meshes, bones: drivers, boneMap, allBones: bones, slotX: 0, dna: defaultDna() };
  ch.dnaCompiled = compileDna(ch.dna);
  return ch;
}

// ---- 정사영 실루엣 래스터 ----
const TW = 210, TH = 360, PAD = 12;   // 타일 크기
function splatWorld(warp, cov, W, H, ox, oy, ppm, cy, view) {
  // view: 'front' → (x,y),  'side' → (z,y)
  for (const entry of warp.meshEntries) {
    const pos = entry.mesh.geometry.attributes.position;
    const mw = entry.mesh.matrixWorld;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.array[i * 3], pos.array[i * 3 + 1], pos.array[i * 3 + 2]).applyMatrix4(mw);
      const uu = view === 'front' ? v.x : v.z;
      const px = Math.round(ox + TW / 2 + uu * ppm);
      const py = Math.round(oy + TH / 2 - (v.y - cy) * ppm); // y up, cy 를 타일 세로 중심에
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = px + dx, y = py + dy;
        if (x >= ox && x < ox + TW && y >= oy && y < oy + TH) cov[y * W + x] = 1;
      }
    }
  }
}

function render(file) {
  const ch = loadCh(file);
  const warp = new FleshWarp(ch, simpleName);
  const states = [
    { name: 'original', dna: defaultDna() },
    { name: 'slim', dna: presetDna('slim') },
    { name: 'bulk', dna: presetDna('bulk') },
    { name: 'stylized-f', dna: presetDna('stylized-f') },
  ];
  const cols = states.length, rows = 2; // front, side
  const W = TW * cols, H = TH * rows;
  const img = Buffer.alloc(W * H * 3);
  // 배경
  for (let i = 0; i < W * H; i++) { img[i * 3] = 20; img[i * 3 + 1] = 22; img[i * 3 + 2] = 26; }

  // 원본 커버리지 (기준)
  warp.apply(0); // α=0 = 원본
  const ppm = (TH - 2 * PAD) / 1.9;
  const cy = 0.9;
  const origCov = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const cov = new Uint8Array(W * H);
    splatWorld(warp, cov, W, H, c * TW, r * TH, ppm, cy, r === 0 ? 'front' : 'side');
    origCov.push(cov);
  }
  // 세로 절반만 쓰도록 py 매핑 보정: 위 splat 은 타일 하단 정렬. 다시 계산 대신 그대로 사용.

  for (let c = 0; c < cols; c++) {
    ch.dna = states[c].dna; ch.dnaCompiled = compileDna(ch.dna);
    warp.apply(1);
    for (let r = 0; r < rows; r++) {
      const oc = origCov[c * rows + r];
      const wc = new Uint8Array(W * H);
      splatWorld(warp, wc, W, H, c * TW, r * TH, ppm, cy, r === 0 ? 'front' : 'side');
      for (let y = r * TH; y < (r + 1) * TH; y++) for (let x = c * TW; x < (c + 1) * TW; x++) {
        const k = y * W + x;
        if (oc[k]) { img[k * 3] = 78; img[k * 3 + 1] = 84; img[k * 3 + 2] = 96; }       // 원본 회색
        if (wc[k]) { img[k * 3] = 90; img[k * 3 + 1] = 200; img[k * 3 + 2] = 230; }     // 워프 시안 (위)
      }
    }
    // 컬럼 헤더 색 바 (상태 구분 힌트)
    const hue = [[120, 130, 150], [90, 170, 120], [210, 150, 90], [230, 120, 170]][c];
    for (let x = c * TW; x < (c + 1) * TW; x++) for (let y = 0; y < 4; y++) { const k = y * W + x; img[k * 3] = hue[0]; img[k * 3 + 1] = hue[1]; img[k * 3 + 2] = hue[2]; }
  }
  // 타일 경계선
  for (let x = 0; x < W; x++) { const k = (TH) * W + x; img[k * 3] = 44; img[k * 3 + 1] = 48; img[k * 3 + 2] = 56; }
  for (let c = 1; c < cols; c++) for (let y = 0; y < H; y++) { const k = y * W + c * TW; img[k * 3] = 44; img[k * 3 + 1] = 48; img[k * 3 + 2] = 56; }
  return { img, W, H, states };
}

// ---- 최소 PNG 인코더 (RGB, filter 0) ----
function writePNG(path, img, W, H) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  const idat = deflateSync(raw);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  writeFileSync(path, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return c ^ 0xffffffff; }

const { img, W, H, states } = render(MODEL);
const out = join(ROOT, 'tools', 'flesh-shot.png');
writePNG(out, img, W, H);
console.log(`저장: ${out}  (${W}×${H})`);
console.log(`열: ${states.map(s => s.name).join(' · ')}  /  행: front · side  (회색=원본, 시안=워프)`);

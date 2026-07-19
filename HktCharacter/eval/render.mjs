// ============================================================================
//  eval/render.mjs — 오프라인 소프트 래스터라이저 (WebGL 없이 PNG 스냅샷)
//
//  샌드박스가 headless Chromium 을 막으므로, 파이프라인 결과(근육·피부)를 Node 에서
//  직접 정투영·z버퍼·Lambert 셰이딩으로 PNG 로 굽는다 — 실루엣이 사람처럼 나오는지
//  육안 판정용. (브라우저 인터랙션 확인은 여전히 `npm run dev` 사용자 몫.)
//
//  실행: node eval/render.mjs   →   eval/out/*.png
// ============================================================================
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { loadSkeleton, replant } from '../src/skeleton.js';
import { MuscleLayer } from '../src/muscles.js';
import { bakeSkin } from '../src/skin.js';
import { parseClipFBX, bakeClip, measureGroundY } from '../src/retarget.js';

const W = 520, H = 720;
const toBuf = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

// ---- 최소 PNG 인코더 -------------------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePNG(path, rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// ---- 래스터라이저 ----------------------------------------------------------
// tris: [{p:[v0,v1,v2] world, c:[r,g,b]}], project: 'front'|'side'
function render(tris, project, bg = [20, 22, 26]) {
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = bg[0]; rgba[i * 4 + 1] = bg[1]; rgba[i * 4 + 2] = bg[2]; rgba[i * 4 + 3] = 255; }
  const zbuf = new Float32Array(W * H).fill(Infinity);
  // 카메라: 정투영 + 자동 프레이밍(대상 bbox 를 화면에 꽉 채워 중앙 정렬).
  const hx = (v) => project === 'front' ? v.x : -v.z; // 화면 가로축 월드값
  let minH = Infinity, maxH = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const tri of tris) for (const v of tri.p) {
    const h = hx(v); if (h < minH) minH = h; if (h > maxH) maxH = h;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
  }
  const spanH = Math.max(maxH - minH, 1e-3), spanY = Math.max(maxY - minY, 1e-3);
  const scale = Math.min(W * 0.86 / spanH, H * 0.86 / spanY);
  const cx = W / 2 - (minH + maxH) / 2 * scale;
  const cy = H / 2 + (minY + maxY) / 2 * scale;
  const L = new THREE.Vector3(0.4, 0.7, project === 'front' ? 0.6 : 0.5).normalize();
  const proj = (v) => project === 'front'
    ? { sx: cx + v.x * scale, sy: cy - v.y * scale, d: -v.z }
    : { sx: cx - v.z * scale, sy: cy - v.y * scale, d: -v.x };
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (const tri of tris) {
    const [a, b, c] = tri.p;
    e1.subVectors(b, a); e2.subVectors(c, a); nrm.crossVectors(e1, e2).normalize();
    let lam = nrm.dot(L); if (lam < 0) lam = -lam * 0.55; // 양면 라이팅
    const sh = 0.28 + 0.72 * lam;
    const A = proj(a), B = proj(b), Cc = proj(c);
    const minX = Math.max(0, Math.floor(Math.min(A.sx, B.sx, Cc.sx)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(A.sx, B.sx, Cc.sx)));
    const minY = Math.max(0, Math.floor(Math.min(A.sy, B.sy, Cc.sy)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(A.sy, B.sy, Cc.sy)));
    const area = (B.sx - A.sx) * (Cc.sy - A.sy) - (Cc.sx - A.sx) * (B.sy - A.sy);
    if (Math.abs(area) < 1e-6) continue;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((B.sx - px) * (Cc.sy - py) - (Cc.sx - px) * (B.sy - py)) / area;
        const w1 = ((Cc.sx - px) * (A.sy - py) - (A.sx - px) * (Cc.sy - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * A.d + w1 * B.d + w2 * Cc.d;
        const idx = y * W + x;
        if (d >= zbuf[idx]) continue;
        zbuf[idx] = d;
        rgba[idx * 4] = Math.min(255, tri.c[0] * sh);
        rgba[idx * 4 + 1] = Math.min(255, tri.c[1] * sh);
        rgba[idx * 4 + 2] = Math.min(255, tri.c[2] * sh);
      }
    }
  }
  return rgba;
}

// 지오메트리 → 월드 삼각형 목록 (matrix 적용).
function geoToTris(geo, matrix, color, out) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    for (let k = 0; k < 3; k++) {
      const j = idx ? idx.getX(i + k) : i + k;
      v[k].fromBufferAttribute(pos, j).applyMatrix4(matrix);
    }
    out.push({ p: [v[0].clone(), v[1].clone(), v[2].clone()], c: color });
  }
}

// ---- 빌드 & 렌더 -----------------------------------------------------------
mkdirSync('eval/out', { recursive: true });
const rig = loadSkeleton(toBuf('public/assets/character/X Bot.fbx'));
replant(rig);
const scene = new THREE.Scene(); scene.add(rig.obj);
const muscles = new MuscleLayer(scene); muscles.build(rig);
const caps = muscles.getCapsules();
const { mesh } = bakeSkin(rig, caps); scene.add(mesh);

// (1) 근육 레이어 — T-포즈 정면 (에코르셰)
{
  rig.obj.updateMatrixWorld(true); muscles.update();
  const tris = [];
  for (const item of muscles.items) geoToTris(muscles.geo, item.mesh.matrix, [190, 70, 64], tris);
  writePNG('eval/out/2-muscles-front.png', render(tris, 'front'), W, H);
  console.log(`근육 정면: ${tris.length} 삼각형 → eval/out/2-muscles-front.png`);
}

// (1b) 관절 통과 데모(WP-02) — 왼팔 근육을 중립 vs 팔꿈치 굴곡으로 확대 비교.
//  이두근이 굴곡 시 짧아지고 굵어지는지(부피 보존) 육안 판정용. 이두=밝은 빨강 강조.
{
  const ARM = new Set(['biceps.L', 'triceps.L', 'forearm.L', 'deltoid.L']);
  const armItems = muscles.items.filter(it => ARM.has(it.def.id));
  const color = it => it.def.id === 'biceps.L' ? [235, 90, 80] : [150, 62, 58];
  const collect = () => {
    rig.obj.updateMatrixWorld(true); muscles.update();
    const tris = []; for (const it of armItems) geoToTris(muscles.geo, it.mesh.matrix, color(it), tris);
    return tris;
  };
  const fore = rig.boneMap.get('leftforearm');
  const saved = fore.rotation.clone();
  writePNG('eval/out/2-arm-neutral.png', render(collect(), 'front'), W, H);
  fore.rotation.x += THREE.MathUtils.degToRad(120); // 팔꿈치 굴곡
  writePNG('eval/out/2-arm-curl.png', render(collect(), 'front'), W, H);
  fore.rotation.copy(saved); rig.obj.updateMatrixWorld(true); muscles.update();
  console.log('관절통과 데모: eval/out/2-arm-neutral.png ↔ 2-arm-curl.png (이두 벌크 비교)');
}

// (2)(3) 피부 — 걷기 포즈 정면/측면
const src = parseClipFBX(toBuf('public/assets/anim/walk.fbx'));
const clip = bakeClip(rig, src, '걷기');
rig.obj.position.y = measureGroundY(rig, clip);
const mixer = new THREE.AnimationMixer(rig.obj);
mixer.clipAction(clip).play();
mixer.setTime(clip.duration * 0.35);
scene.updateMatrixWorld(true); mesh.updateMatrixWorld(true);

// 스킨 변형 정점을 월드로 구워 삼각형 생성
const g = mesh.geometry;
const skinnedPos = new THREE.Vector3();
const worldPositions = [];
for (let i = 0; i < g.attributes.position.count; i++) {
  skinnedPos.fromBufferAttribute(g.attributes.position, i);
  mesh.applyBoneTransform(i, skinnedPos);
  worldPositions.push(skinnedPos.clone());
}
function skinTris() {
  const idx = g.index; const out = [];
  const n = idx.count;
  for (let i = 0; i < n; i += 3) {
    out.push({ p: [worldPositions[idx.getX(i)], worldPositions[idx.getX(i + 1)], worldPositions[idx.getX(i + 2)]], c: [217, 168, 143] });
  }
  return out;
}
writePNG('eval/out/3-skin-front.png', render(skinTris(), 'front'), W, H);
writePNG('eval/out/3-skin-side.png', render(skinTris(), 'side'), W, H);
console.log('피부 정면/측면 → eval/out/3-skin-front.png, 3-skin-side.png');

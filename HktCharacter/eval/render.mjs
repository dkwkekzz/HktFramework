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
import { detectLandmarks, landmarkPoints } from '../src/landmarks.js';
import { analyzeJoints } from '../src/joints.js';
import { solveInsertion, synthesizeJointMuscles } from '../src/attach.js';
import { BODY_PRESETS } from '../src/anatomy.js';
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
  for (const item of muscles.items) geoToTris(item.mesh.geometry, item.mesh.matrix, [190, 70, 64], tris);
  writePNG('eval/out/2-muscles-front.png', render(tris, 'front'), W, H);
  console.log(`근육 정면: ${tris.length} 삼각형 → eval/out/2-muscles-front.png`);
}

// (1c) 랜드마크(WP-11) — 뼈 표면 랜드마크 점을 근육 위에 오버레이(§9.2·§17.3 뷰).
//  면별 색: 전=파랑·후=주황·외측=초록·내측=노랑·끝단=흰. 좌우 대칭·프록시 표면 위 육안 확인용.
{
  rig.obj.updateMatrixWorld(true); muscles.update();
  const lm = detectLandmarks(rig);
  const tris = [];
  for (const item of muscles.items) geoToTris(item.mesh.geometry, item.mesh.matrix, [64, 40, 40], tris);
  const cube = (c, r, col) => {
    const o = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
      .map(a => new THREE.Vector3(c.x + a[0] * r, c.y + a[1] * r, c.z + a[2] * r));
    const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
    for (const t of f) tris.push({ p: [o[t[0]].clone(), o[t[1]].clone(), o[t[2]].clone()], c: col });
  };
  const colOf = n => n.includes('Ant') ? [90, 200, 255] : n.includes('Post') ? [255, 120, 90]
    : n.includes('Lat') ? [130, 255, 130] : n.includes('Med') ? [255, 230, 90] : [235, 235, 235];
  for (const s of landmarkPoints(lm)) cube(s.p, 0.012, colOf(s.name));
  writePNG('eval/out/1-landmarks-front.png', render(tris, 'front'), W, H);
  console.log('랜드마크: eval/out/1-landmarks-front.png (면별 색 오버레이)');

  // (1d) 관절 기능(WP-12) — hinge/ball 피벗(흰) + 굴곡축(hinge=청록 막대·ball=자홍 점). §9.3·§17.3.
  const jt = analyzeJoints(rig, lm);
  const tris2 = [];
  for (const item of muscles.items) geoToTris(item.mesh.geometry, item.mesh.matrix, [64, 40, 40], tris2);
  const cube2 = (c, r, col) => {
    const o = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
      .map(a => new THREE.Vector3(c.x + a[0] * r, c.y + a[1] * r, c.z + a[2] * r));
    const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
    for (const t of f) tris2.push({ p: [o[t[0]].clone(), o[t[1]].clone(), o[t[2]].clone()], c: col });
  };
  for (const j of jt.values()) {
    cube2(j.pivot, 0.016, [240, 240, 240]);                        // 피벗 = 흰
    if (j.type === 'hinge') {                                      // hinge 굴곡축 = 청록 막대
      for (let s = -3; s <= 3; s++) cube2(j.pivot.clone().addScaledVector(j.flexionAxis, s * 0.018), 0.008, [60, 230, 220]);
    } else cube2(j.pivot, 0.024, [230, 90, 220]);                  // ball = 자홍(큰 점)
  }
  writePNG('eval/out/1-joints-front.png', render(tris2, 'front'), W, H);
  console.log('관절 기능: eval/out/1-joints-front.png (hinge 축=청록·ball=자홍)');
}

// (1b) 관절 통과 데모(WP-02) — 왼팔 근육을 중립 vs 팔꿈치 굴곡으로 확대 비교.
//  이두근이 굴곡 시 짧아지고 굵어지는지(부피 보존) 육안 판정용. 이두=밝은 빨강 강조.
{
  const ARM = new Set(['biceps.L', 'triceps.L', 'forearm.L', 'deltoid.L']);
  const armItems = muscles.items.filter(it => ARM.has(it.def.id));
  const color = it => it.def.id === 'biceps.L' ? [235, 90, 80] : [150, 62, 58];
  const collect = () => {
    rig.obj.updateMatrixWorld(true); muscles.update();
    const tris = []; for (const it of armItems) geoToTris(it.mesh.geometry, it.mesh.matrix, color(it), tris);
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

// (1e) 활성도(WP-05) — **중립 포즈 고정**에서 공동수축(굴근 이두 0.8 / 신근 삼두 0.3, §10.5)
//  → 길이 불변에도 등척성 팽창(§10.6). 활성도 0 대비. 이두=밝은 빨강.
{
  const ARM = new Set(['biceps.L', 'triceps.L', 'forearm.L', 'deltoid.L']);
  const armItems = muscles.items.filter(it => ARM.has(it.def.id));
  const col = it => it.def.id === 'biceps.L' ? [235, 90, 80] : it.def.id === 'triceps.L' ? [150, 62, 58] : [128, 54, 52];
  const draw = () => { rig.obj.updateMatrixWorld(true); muscles.update(); const tris = []; for (const it of armItems) geoToTris(it.mesh.geometry, it.mesh.matrix, col(it), tris); return tris; };
  muscles.setActivation(0);
  writePNG('eval/out/1-activation-rest.png', render(draw(), 'front'), W, H);
  muscles.setActivation(0.8, id => id === 'biceps.L');
  muscles.setActivation(0.3, id => id === 'triceps.L');
  writePNG('eval/out/1-activation-cocontract.png', render(draw(), 'front'), W, H);
  muscles.setActivation(0);
  console.log('활성도: eval/out/1-activation-{rest,cocontract}.png (등척성 공동수축)');
}

// (1f) 근섬유 방향장(WP-13) — 근육별 섬유 방향을 점열 막대로. fusiform=청록(축 정렬)·
//  pennate 깃근=주황(축에서 깃각만큼 기움). §9.9·§17.3 Fiber directions 뷰.
{
  rig.obj.updateMatrixWorld(true); muscles.update();
  const fibers = muscles.getFibers();
  const tris = [];
  for (const item of muscles.items) geoToTris(item.mesh.geometry, item.mesh.matrix, [56, 34, 34], tris);
  const cube = (c, r, col) => {
    const o = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
      .map(a => new THREE.Vector3(c.x + a[0] * r, c.y + a[1] * r, c.z + a[2] * r));
    const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
    for (const t of f) tris.push({ p: [o[t[0]].clone(), o[t[1]].clone(), o[t[2]].clone()], c: col });
  };
  for (const fb of fibers) {
    const col = fb.pennation > 0 ? [255, 150, 60] : [80, 220, 255];
    const h = fb.len * 0.45;
    for (let s = -3; s <= 3; s++) cube(fb.center.clone().addScaledVector(fb.dir, (s / 3) * h), 0.009, col);
  }
  writePNG('eval/out/1-fibers-front.png', render(tris, 'front'), W, H);
  console.log('근섬유 방향: eval/out/1-fibers-front.png (fusiform=청록·pennate=주황)');
}

// (1g) 부착 솔버(WP-14) — 전완 부착 후보 랜드마크(회색) + 기능으로 도출한 부착: 굴근=전면(초록)·
//  신근=후면(주황). 손 지정 없이 랜드마크+관절 토크로 해부학적 면을 고른다. §9.5·원칙⑤.
{
  rig.obj.updateMatrixWorld(true); muscles.update();
  const lm = detectLandmarks(rig); const jt = analyzeJoints(rig, lm);
  const flex = solveInsertion({ insertionBone: 'leftforearm', joint: 'leftforearm', role: 'flexor' }, lm, jt);
  const ext = solveInsertion({ insertionBone: 'leftforearm', joint: 'leftforearm', role: 'extensor' }, lm, jt);
  const tris = [];
  const ARM = new Set(['biceps.L', 'triceps.L', 'forearm.L', 'deltoid.L']);
  for (const it of muscles.items) if (ARM.has(it.def.id)) geoToTris(it.mesh.geometry, it.mesh.matrix, [58, 36, 36], tris);
  const cube = (c, r, col) => {
    const o = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
      .map(a => new THREE.Vector3(c.x + a[0] * r, c.y + a[1] * r, c.z + a[2] * r));
    const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
    for (const t of f) tris.push({ p: [o[t[0]].clone(), o[t[1]].clone(), o[t[2]].clone()], c: col });
  };
  for (const c of flex.candidates) cube(c.point, 0.009, [120, 120, 130]); // 후보(회색)
  cube(flex.insertion.point, 0.02, [90, 235, 110]);   // 굴근 도출(초록)
  cube(ext.insertion.point, 0.02, [255, 150, 60]);    // 신근 도출(주황)
  writePNG('eval/out/1-attach-solver.png', render(tris, 'front'), W, H);
  console.log(`부착 솔버: eval/out/1-attach-solver.png (굴근→${flex.insertion.face} 초록·신근→${ext.insertion.face} 주황)`);
}

// (1h) 모드 B 기능 합성(WP-08) — 아틀라스 없이 팔꿈치 기능만으로 합성한 굴근(초록)·신근(주황)을
//  기시→정지 점열로. 뼈(회색)만 있으면 근육이 나온다. §9.4B·G5 비인간형 씨앗.
{
  rig.obj.updateMatrixWorld(true);
  const lm = detectLandmarks(rig); const jt = analyzeJoints(rig, lm);
  const synth = synthesizeJointMuscles('leftforearm', lm, jt);
  const tris = [];
  // 팔 뼈 세그먼트를 얇은 막대로(맥락)
  const wp = new THREE.Vector3(), wc = new THREE.Vector3();
  for (const bn of ['leftarm', 'leftforearm', 'lefthand']) {
    const b = rig.boneMap.get(bn); if (!b) continue; b.getWorldPosition(wp);
    for (const k of b.children.filter(k => k.isBone)) { k.getWorldPosition(wc); }
  }
  const cube = (c, r, col) => {
    const o = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
      .map(a => new THREE.Vector3(c.x + a[0] * r, c.y + a[1] * r, c.z + a[2] * r));
    const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
    for (const t of f) tris.push({ p: [o[t[0]].clone(), o[t[1]].clone(), o[t[2]].clone()], c: col });
  };
  for (const m of synth) {
    const col = m.role === 'flexor' ? [90, 235, 110] : [255, 150, 60];
    const a = m.origin.point, b = m.insertion.point;
    for (let s = 0; s <= 8; s++) cube(a.clone().lerp(b, s / 8), 0.008, col); // 기시→정지 근육 경로
    cube(a, 0.016, col); cube(b, 0.016, col);
  }
  writePNG('eval/out/1-modeB-synth.png', render(tris, 'front'), W, H);
  console.log('모드 B 합성: eval/out/1-modeB-synth.png (굴근 초록·신근 주황, 아틀라스 없이 기능에서)');
}

// (4) 체형 프리셋(WP-06) — 같은 골격, muscle/fat 파라미터만 바꾼 rest 피부 실루엣.
//  rig 은 아직 rest(replant) 상태이므로 구운 지오메트리 정점이 곧 월드 rest 좌표다.
for (const name of ['마른', '근육질', '비만']) {
  muscles.build(rig, BODY_PRESETS[name]);
  rig.obj.updateMatrixWorld(true);
  const bm = bakeSkin(rig, muscles.getCapsules(), muscles.profile).mesh;
  const bg = bm.geometry, bi = bg.index, bp = bg.attributes.position, bt = [];
  const bv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < bi.count; i += 3) {
    for (let k = 0; k < 3; k++) bv[k].fromBufferAttribute(bp, bi.getX(i + k));
    bt.push({ p: [bv[0].clone(), bv[1].clone(), bv[2].clone()], c: [217, 168, 143] });
  }
  writePNG(`eval/out/4-body-${name}.png`, render(bt, 'front'), W, H);
  console.log(`체형 ${name} → eval/out/4-body-${name}.png`);
}
muscles.build(rig); // 기본 체형으로 복구 (이후 애니메이션용)

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

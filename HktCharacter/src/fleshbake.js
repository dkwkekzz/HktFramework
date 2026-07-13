// ============================================================================
//  fleshbake.js — 레스트 포즈 살 SDF 를 한 번 폴리곤화 → 자동 스키닝 → SkinnedMesh
//
//  재생 중 필드 계산 0, 시간적 앨리어싱 0. 파이프라인(§6.1):
//    포즈 저장→바인드 복원 → 고해상 필드(fillField 재사용) → MarchingCubes 폴리곤화
//    → 정점 용접 → Taubin 스무딩 → 캡슐 기여도 스키닝 가중치 → 바인딩.
//  스키닝 가중치는 **필드와 동일한 수식**(segContribAt) 이라 관절 이중 바인딩이
//  필드 겹침에서 자동으로 나온다.
// ============================================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import {
  buildSegs, fillField, segContribAt, segAxisDist2, blobContribAt,
  HALF, CENTER_Y, ISO,
} from './mcflesh.js';

const MAX_POLY = 400000;
const WELD = 2000; // 0.5mm 격자 반올림 키

/**
 * 레스트(바인드) 포즈에서 살을 구워 THREE.SkinnedMesh 를 만든다.
 * @param {object} ch  캐릭터 상태 (bones·dnaCompiled·bindLocalQ/P·slotX·root)
 * @param {function} simpleName  이름 정규화
 * @param {object} opts { res=160, material }
 * @returns {{ mesh: THREE.SkinnedMesh, stats: object }}
 */
export function bakeFleshMesh(ch, simpleName, { res = 160, material } = {}) {
  // 1. 포즈 저장 → 바인드 로컬로 복원 (measureClipRootY 패턴 — 렌더 사이 동기 실행).
  //    root(접지·스케일·본 비율)는 현재 값 유지 → 구운 메시가 그대로 따라온다.
  const saved = ch.allBones.map(b => [b, b.quaternion.clone(), b.position.clone()]);
  for (const b of ch.allBones) {
    const lq = ch.bindLocalQ?.get(b), lp = ch.bindLocalP?.get(b);
    if (lq) b.quaternion.copy(lq);
    if (lp) b.position.copy(lp);
  }
  ch.root.updateMatrixWorld(true);

  let out = null, err = null;
  try { out = bakeCore(ch, simpleName, res, material); }
  catch (e) { err = e; }

  // 포즈 원복 — 화면 상태 불변
  for (const [b, q, p] of saved) { b.quaternion.copy(q); b.position.copy(p); }
  ch.root.updateMatrixWorld(true);

  if (err) throw err;
  return out;
}

function bakeCore(ch, simpleName, res, material) {
  const half = res / 2;
  const gs = half / HALF;
  const offsetX = ch.slotX || 0;
  const { segs, cuts, blobs } = buildSegs(ch, simpleName, gs, half);
  if (!segs.length) throw new Error('살 세그먼트 없음 (DNA 전부 r=0?)');

  // 2~3. 고해상 필드 → 폴리곤화 (임시 MarchingCubes, bake 후 해제)
  const dummyMat = new THREE.MeshBasicMaterial();
  const mc = new MarchingCubes(res, dummyMat, false, false, MAX_POLY);
  fillField(mc.field, { size: res, yd: mc.yd, zd: mc.zd }, segs, cuts, blobs);
  mc.isolation = ISO;
  mc.update();
  const vcount = mc.count; // 정점 수 (3 = 삼각형)
  const overflow = vcount / 3 >= MAX_POLY; // 오버플로 가드 (조용한 절단 금지)
  if (vcount < 3) {
    mc.geometry.dispose(); dummyMat.dispose();
    throw new Error('폴리곤 0 — iso 표면이 만들어지지 않음');
  }

  // 오브젝트 공간 정점 f=(grid-half)/half → 월드: world = f×HALF + 중심(+offsetX on x)
  const rawPos = mc.positionArray;
  const wx = new Float32Array(vcount), wy = new Float32Array(vcount), wz = new Float32Array(vcount);
  for (let i = 0; i < vcount; i++) {
    wx[i] = rawPos[i * 3] * HALF + offsetX;
    wy[i] = rawPos[i * 3 + 1] * HALF + CENTER_Y;
    wz[i] = rawPos[i * 3 + 2] * HALF;
  }
  mc.geometry.dispose(); dummyMat.dispose(); // 160³ 임시 버퍼 즉시 해제

  // 4. 정점 용접 — 0.5mm 격자 해시 → 인덱스드 지오메트리 (MC 는 비인덱스드 중복 정점)
  const map = new Map();
  const ux = [], uy = [], uz = [];
  const index = new Uint32Array(vcount);
  for (let i = 0; i < vcount; i++) {
    const kx = Math.round(wx[i] * WELD), ky = Math.round(wy[i] * WELD), kz = Math.round(wz[i] * WELD);
    const key = kx * 8388608 + ky * 2048 + kz; // 정수 해시 (문자열 키보다 빠름)
    let idx = map.get(key);
    if (idx === undefined) { idx = ux.length; map.set(key, idx); ux.push(wx[i]); uy.push(wy[i]); uz.push(wz[i]); }
    index[i] = idx;
  }
  const nU = ux.length;
  const pos = new Float32Array(nU * 3);
  for (let v = 0; v < nU; v++) { pos[v * 3] = ux[v]; pos[v * 3 + 1] = uy[v]; pos[v * 3 + 2] = uz[v]; }

  // 5. Taubin 스무딩 (λ=0.5, μ=−0.53, 10회, uniform weight) — 순 Laplacian 은 수축해
  //    실루엣(DNA 의 약속)이 얇아지므로 금지. 인접은 삼각형 인덱스에서 구성.
  const bbox0 = bbox(pos);
  const nbr = buildAdjacency(index, vcount, nU);
  for (let it = 0; it < 10; it++) { taubinStep(pos, nbr, 0.5); taubinStep(pos, nbr, -0.53); }
  const bbox1 = bbox(pos);

  // 6. 스키닝 가중치 — 정점 월드 → 그리드, 필드와 동일 수식으로 세그먼트별 기여도 상위 4개.
  const boneIndex = new Map(ch.bones.map((b, i) => [b, i]));
  const skinIndex = new Uint16Array(nU * 4);
  const skinWeight = new Float32Array(nU * 4);
  const toGx = x => ((x - offsetX) / HALF + 1) * half;
  const toGy = y => ((y - CENTER_Y) / HALF + 1) * half;
  const toGz = z => (z / HALF + 1) * half;
  let orphans = 0;
  const top = []; // 재사용 버퍼 [idx, w]
  for (let v = 0; v < nU; v++) {
    const gx = toGx(pos[v * 3]), gy = toGy(pos[v * 3 + 1]), gz = toGz(pos[v * 3 + 2]);
    top.length = 0;
    for (const seg of segs) {
      const w = segContribAt(seg, gx, gy, gz);
      if (w > 1e-6) top.push([boneIndex.get(seg.bone) ?? 0, w]);
    }
    for (const blob of blobs) { // blob 정점은 앵커 뼈에 귀속
      const w = blobContribAt(blob, gx, gy, gz);
      if (w > 1e-6) top.push([boneIndex.get(blob.bone) ?? 0, w]);
    }
    if (!top.length) {
      // 기여 0 (이론상 없음, cut 근처 방어) — 최근접 세그먼트 가중치 1
      orphans++;
      let best = 0, bestD = Infinity;
      for (const seg of segs) { const d = segAxisDist2(seg, gx, gy, gz); if (d < bestD) { bestD = d; best = boneIndex.get(seg.bone) ?? 0; } }
      skinIndex[v * 4] = best; skinWeight[v * 4] = 1;
      continue;
    }
    top.sort((a, b) => b[1] - a[1]);
    const n = Math.min(4, top.length);
    let sum = 0; for (let j = 0; j < n; j++) sum += top[j][1];
    for (let j = 0; j < 4; j++) {
      if (j < n) { skinIndex[v * 4 + j] = top[j][0]; skinWeight[v * 4 + j] = top[j][1] / sum; }
      else { skinIndex[v * 4 + j] = 0; skinWeight[v * 4 + j] = 0; }
    }
  }

  // 지오메트리 조립
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.computeVertexNormals();

  // 7. 바인딩 — boneInverses = 바인드 복원 상태 bone.matrixWorld⁻¹, 메시는 씬 루트 identity.
  const boneInverses = ch.bones.map(b => new THREE.Matrix4().copy(b.matrixWorld).invert());
  const skeleton = new THREE.Skeleton(ch.bones, boneInverses);
  const mesh = new THREE.SkinnedMesh(geo, material || new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.6 }));
  mesh.frustumCulled = false;
  mesh.bind(skeleton, new THREE.Matrix4());

  const dz = Math.max(
    Math.abs(bbox1.min[0] - bbox0.min[0]), Math.abs(bbox1.max[0] - bbox0.max[0]),
    Math.abs(bbox1.min[1] - bbox0.min[1]), Math.abs(bbox1.max[1] - bbox0.max[1]),
    Math.abs(bbox1.min[2] - bbox0.min[2]), Math.abs(bbox1.max[2] - bbox0.max[2]),
  );
  // 스무딩 수축 지표 = 최대 bbox 변화 / **최대 축 크기** (객체 크기 대비 변화율).
  const bsize = Math.max(bbox0.max[0] - bbox0.min[0], bbox0.max[1] - bbox0.min[1], bbox0.max[2] - bbox0.min[2], 1e-3);
  return {
    mesh,
    stats: { triangles: vcount / 3, vertices: nU, welded: vcount - nU, overflow, orphans, bboxDrift: dz / bsize },
  };
}

// 삼각형 인덱스 → 정점 인접 리스트 (Int32Array 평탄 + 오프셋)
function buildAdjacency(index, vcount, nU) {
  const sets = Array.from({ length: nU }, () => new Set());
  for (let t = 0; t < vcount; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b);
  }
  return sets.map(s => Array.from(s));
}

// Taubin 한 스텝: p += factor × (이웃 평균 − p)
function taubinStep(pos, nbr, factor) {
  const nU = nbr.length;
  const out = new Float32Array(pos.length);
  for (let v = 0; v < nU; v++) {
    const ns = nbr[v];
    const base = v * 3;
    if (!ns.length) { out[base] = pos[base]; out[base + 1] = pos[base + 1]; out[base + 2] = pos[base + 2]; continue; }
    let sx = 0, sy = 0, sz = 0;
    for (const n of ns) { sx += pos[n * 3]; sy += pos[n * 3 + 1]; sz += pos[n * 3 + 2]; }
    const inv = 1 / ns.length;
    out[base] = pos[base] + factor * (sx * inv - pos[base]);
    out[base + 1] = pos[base + 1] + factor * (sy * inv - pos[base + 1]);
    out[base + 2] = pos[base + 2] + factor * (sz * inv - pos[base + 2]);
  }
  pos.set(out);
}

function bbox(pos) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3)
    for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  return { min, max };
}

// ============================================================================
//  fleshbake.js — 레스트(바인드) 포즈에서 살을 한 번 굽고(bake) 캡슐 기여도로
//  자동 스키닝 → THREE.SkinnedMesh. 재생 중 필드 계산 0, 시간적 앨리어싱 0.
//
//  파이프라인(§6.1): 포즈 저장→바인드 복원 → 고해상 필드 → 폴리곤화 → 정점 용접
//  → Taubin 스무딩 → 필드 기여도 스키닝 가중치 → 스켈레톤 바인딩.
//  필드는 mcflesh 의 fillField·segFieldAt 를 재사용해 실시간 살과 정합한다.
// ============================================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { buildSegments, fillField, segFieldAt, sphereFieldAt, HALF, CENTER_Y, ISO } from './mcflesh.js';

const _dummyMat = new THREE.MeshBasicMaterial();
const MAX_POLY = 400000;      // 삼각형 상한 — 초과 시 조용히 절단되므로 명시 보고
const WELD_KEY = 2000;        // ×2000 반올림 = 0.5mm 격자 용접

// bake 결과: { mesh, stats } — stats 는 상태줄 보고용. simpleName: 이름 정규화 함수.
export function bakeFleshMesh(ch, simpleName, opts = {}) {
  const res = opts.res || 160;
  const smoothIters = opts.smoothIters ?? 6; // Taubin λ/μ 쌍 반복 — 실루엣 수축 ≤1% 예산
  // 1. 포즈 저장 → 바인드 로컬 복원 (measureClipRootY 와 같은 저장→복원 패턴).
  //    root(접지·스케일·본 비율)는 현재 값 유지 — 구운 메시가 그대로 따라온다.
  const saved = ch.allBones.map(b => [b, b.quaternion.clone(), b.position.clone()]);
  for (const b of ch.allBones) {
    const lq = ch.bindLocalQ.get(b), lp = ch.bindLocalP.get(b);
    if (lq) b.quaternion.copy(lq);
    if (lp) b.position.copy(lp);
  }
  ch.root.updateMatrixWorld(true);
  try {
    return buildBakedMesh(ch, simpleName, res, opts.material, smoothIters);
  } finally {
    for (const [b, q, p] of saved) { b.quaternion.copy(q); b.position.copy(p); }
    ch.root.updateMatrixWorld(true);
  }
}

function buildBakedMesh(ch, simpleName, res, material, smoothIters) {
  const size = res, half = size / 2, offsetX = ch.slotX || 0;
  const { segs, spheres } = buildSegments(ch, simpleName, size);
  if (!segs.length) throw new Error('bake: 세그먼트 없음(모두 r=0?)');

  // 2~3. 고해상 필드 → 마칭 큐브 폴리곤화
  const mc = new MarchingCubes(size, _dummyMat, false, false, MAX_POLY);
  mc.isolation = ISO;
  mc.reset();
  fillField(mc.field, { size, yd: mc.yd, zd: mc.zd }, segs, spheres);
  mc.update();
  const rawVerts = mc.count;
  if (rawVerts === 0) throw new Error('bake: 삼각형 0 (빈 필드)');
  const overflow = rawVerts >= MAX_POLY * 3 - 3; // maxPolyCount×3 정점에 닿음 = 절단
  const pos = mc.positionArray;

  // 4. 정점 용접 (0.5mm) — MC 출력은 비인덱스드 중복 정점이라 용접 없이는
  //    스무딩·스키닝이 이음새를 만든다. obj-space[-1,1] → 월드(mesh: scale HALF, y+CENTER_Y).
  const uniq = [];            // 월드 좌표 flat [x,y,z,...]
  const idOf = new Map();
  const tri = [];             // 인덱스 삼각형
  for (let t = 0; t < rawVerts; t += 3) {
    const ids = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      const i = t + j;
      const wx = pos[i * 3] * HALF + offsetX, wy = pos[i * 3 + 1] * HALF + CENTER_Y, wz = pos[i * 3 + 2] * HALF;
      const k = Math.round(wx * WELD_KEY) + '_' + Math.round(wy * WELD_KEY) + '_' + Math.round(wz * WELD_KEY);
      let id = idOf.get(k);
      if (id === undefined) { id = uniq.length / 3; idOf.set(k, id); uniq.push(wx, wy, wz); }
      ids[j] = id;
    }
    if (ids[0] !== ids[1] && ids[1] !== ids[2] && ids[0] !== ids[2]) tri.push(ids[0], ids[1], ids[2]); // 퇴화 삼각형 제외
  }
  const vCount = uniq.length / 3;
  const positions = Float32Array.from(uniq);

  // 5. Taubin 스무딩 (λ/μ 교대 — 순 Laplacian 은 수축해 실루엣이 얇아지므로 금지).
  //    수축 판정은 **트림 실루엣**(2~98% 백분위 폭)으로 — 손끝·정수리 같은 반구
  //    캡은 어떤 스무딩이든 둥글려 전역 bbox 를 흔들지만 그것은 "실루엣 얇아짐"이
  //    아니다. 몸통·사지 폭(트림 폭)이 유지되는지가 진짜 관심사(§12 리스크).
  const neighbors = buildNeighbors(tri, vCount);
  const trimBefore = trimmedExtents(positions);
  taubinSmooth(positions, neighbors, 0.5, -0.53, smoothIters);
  const trimAfter = trimmedExtents(positions);

  // 6. 스키닝 가중치 — 정점 월드 위치에서 **필드와 동일한 수식**으로 세그먼트별
  //    Wyvill 기여도 → 상위 4개 정규화. 관절 이중 바인딩은 필드 겹침에서 자동.
  const boneIndex = new Map(ch.bones.map((b, i) => [b, i]));
  const skinIndex = new Uint16Array(vCount * 4);
  const skinWeight = new Float32Array(vCount * 4);
  const contrib = new Map(); // bone → 누적 기여도
  for (let v = 0; v < vCount; v++) {
    const wx = positions[v * 3], wy = positions[v * 3 + 1], wz = positions[v * 3 + 2];
    const gx = ((wx - offsetX) / HALF + 1) * half, gy = ((wy - CENTER_Y) / HALF + 1) * half, gz = (wz / HALF + 1) * half;
    contrib.clear();
    for (const s of segs) {
      const c = segFieldAt(s, gx, gy, gz);
      if (c > 0) contrib.set(s.bone, (contrib.get(s.bone) || 0) + c);
    }
    for (const sp of spheres) { // bump(양)만 가중치에 귀속 — cut(음)은 정점을 소유하지 않음
      if (sp.strength <= 0) continue;
      const c = sphereFieldAt(sp, gx, gy, gz);
      if (c > 0) contrib.set(sp.bone, (contrib.get(sp.bone) || 0) + c);
    }
    // 상위 4개
    let top = [...contrib.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (!top.length) top = [[nearestSegBone(segs, gx, gy, gz), 1]]; // cut 근처 방어: 최근접 세그먼트
    let sum = 0; for (const [, w] of top) sum += w;
    for (let j = 0; j < 4; j++) {
      if (j < top.length) { skinIndex[v * 4 + j] = boneIndex.get(top[j][0]) ?? 0; skinWeight[v * 4 + j] = top[j][1] / sum; }
      else { skinIndex[v * 4 + j] = 0; skinWeight[v * 4 + j] = 0; }
    }
  }

  // 7. 지오메트리 조립 + 스켈레톤 바인딩. 정점은 이미 월드(바인드), 메시는 identity.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(tri);
  geo.computeVertexNormals();

  const skeleton = new THREE.Skeleton(ch.bones); // 바인드 포즈 상태 → boneInverses 캐시
  const mesh = new THREE.SkinnedMesh(geo, material || new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.6 }));
  mesh.frustumCulled = false;
  mesh.bind(skeleton, new THREE.Matrix4()); // bindMatrix = identity (정점이 월드 바인드)

  let bboxGrow = 0;
  for (let a = 0; a < 3; a++) { const d = Math.abs(trimAfter[a] - trimBefore[a]) / (trimBefore[a] || 1); if (d > bboxGrow) bboxGrow = d; }
  return {
    mesh,
    stats: { rawVerts, vCount, tris: tri.length / 3, overflow, bboxGrow },
  };
}

// tri(인덱스) → 정점별 이웃 배열
function buildNeighbors(tri, vCount) {
  const sets = Array.from({ length: vCount }, () => new Set());
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i], b = tri[i + 1], c = tri[i + 2];
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b);
  }
  return sets.map(s => [...s]);
}

// Taubin λ|μ 스무딩 (uniform weight) — iters 회 (λ 수축 → μ 팽창 쌍)
function taubinSmooth(positions, neighbors, lambda, mu, iters) {
  const n = neighbors.length;
  const tmp = new Float32Array(positions.length);
  const pass = factor => {
    for (let v = 0; v < n; v++) {
      const nb = neighbors[v];
      const o = v * 3;
      if (!nb.length) { tmp[o] = positions[o]; tmp[o + 1] = positions[o + 1]; tmp[o + 2] = positions[o + 2]; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (const u of nb) { sx += positions[u * 3]; sy += positions[u * 3 + 1]; sz += positions[u * 3 + 2]; }
      const inv = 1 / nb.length;
      tmp[o] = positions[o] + factor * (sx * inv - positions[o]);
      tmp[o + 1] = positions[o + 1] + factor * (sy * inv - positions[o + 1]);
      tmp[o + 2] = positions[o + 2] + factor * (sz * inv - positions[o + 2]);
    }
    positions.set(tmp);
  };
  for (let i = 0; i < iters; i++) { pass(lambda); pass(mu); }
}

// 축별 트림 폭(2~98% 백분위 차) — 반구 캡 끝점을 배제한 몸통·사지 실루엣 폭.
function trimmedExtents(positions, lo = 0.02, hi = 0.98) {
  const n = positions.length / 3;
  const out = [0, 0, 0];
  for (let a = 0; a < 3; a++) {
    const arr = new Float32Array(n);
    for (let i = 0; i < n; i++) arr[i] = positions[i * 3 + a];
    arr.sort();
    out[a] = arr[Math.floor(hi * (n - 1))] - arr[Math.floor(lo * (n - 1))];
  }
  return out;
}

// 기여도 0 정점(cut 근처)용 — 축까지 거리²가 최소인 세그먼트의 뼈
function nearestSegBone(segs, x, y, z) {
  let best = segs[0].bone, bestD = Infinity;
  for (const s of segs) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, dz = s.bz - s.az, len2 = dx * dx + dy * dy + dz * dz;
    const px = x - s.ax, py = y - s.ay, pz = z - s.az;
    let t = len2 > 1e-10 ? (px * dx + py * dy + pz * dz) / len2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz, d2 = qx * qx + qy * qy + qz * qz;
    if (d2 < bestD) { bestD = d2; best = s.bone; }
  }
  return best;
}

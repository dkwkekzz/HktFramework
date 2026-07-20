// ============================================================================
//  skin.js — 3단계: 피부 + 스키닝 (굽기)
//
//  근육·뼈 캡슐의 합집합을 음함수 필드(implicit field)로 보고 MarchingCubes 로
//  한 겹의 피부 표면을 뽑아낸다("근육 위에 피부를 씌운다"). 그 표면을 rest 포즈에서
//  **한 번 굽고**, 각 정점을 가까운 뼈들에 스키닝(가중치 바인딩)해 SkinnedMesh 로
//  만든다 — 이후 GPU 스키닝이 애니메이션을 처리한다(재생 중 재폴리곤화 없음 →
//  시간적 앨리어싱 없음). 이것이 "구워서 사람처럼"의 실제 의미다.
//
//  필드: 콤팩트 서포트 Wyvill 커널을 **가산 합이 아니라 부드러운 max(smooth-max)**
//  로 결합한다(WP-09 · 설계서 §9.8 조직 패킹 · 원칙③). 가산 합이면 근육이 겹치는
//  몸통·관절부가 부피를 더해 부풀고 "떠 있는 판때기"가 생겼다 — 이는 "근육은 독립
//  메시가 아니라 공간을 나눠 갖는 조직"이라는 원칙 위반이었다. smooth-max 는 겹치는
//  근육이 부피를 더하지 않고 표면을 공유(union)하게 하며, 단일 캡슐 영역에서는 기존과
//  수학적으로 동일하다(회귀 0). isolation 등가면이 피부.
// ============================================================================
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { boneBox, simpleName } from './skeleton.js';

const RES = 64;          // 필드 격자 해상도
const KERNEL_SCALE = 1.5; // 커널 서포트 = 반지름 × 이 값
const ISO = 0.35;         // 등가면 임계 — 낮을수록 피부가 부풀어 살이 붙는다
// 조직 패킹 블렌드(설계서 §9.8·§9.10 fascia): smooth-max 의 날카로움. 클수록 hard max
// (근육 경계 또렷·분리 노출), 작을수록 겹침부가 매끄럽게 녹는다(fascia webbing). 부위별
// 조절(피부 전달률 §11)은 WP-10 에서 이 상수를 파라미터화한다. 매직넘버 지양(CLAUDE.md).
const FASCIA_K = 6;
const WELD_TOL = 3e-3;    // 정점 용접 허용오차(m)
const MAX_INFLUENCES = 4; // 정점당 뼈 영향 수

// 점 p 와 선분 a-b 최단거리 제곱.
function distSqToSeg(px, py, pz, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = px - a.x, apy = py - a.y, apz = pz - a.z;
  const abLen = abx * abx + aby * aby + abz * abz;
  let t = abLen > 1e-9 ? (apx * abx + apy * aby + apz * abz) / abLen : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}

// 근육·뼈 캡슐 → 피부 SkinnedMesh. rig 은 rest 포즈로 replant 되어 있어야 한다.
export function bakeSkin(rig, capsules) {
  rig.obj.updateMatrixWorld(true);

  // --- 1. 필드 bbox (캡슐 전체 + 반지름 여유) --------------------------------
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const c of capsules) {
    box.expandByPoint(v.copy(c.a).addScalar(c.r));
    box.expandByPoint(v.copy(c.a).addScalar(-c.r));
    box.expandByPoint(v.copy(c.b).addScalar(c.r));
    box.expandByPoint(v.copy(c.b).addScalar(-c.r));
  }
  box.expandByScalar(0.03);
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  half.set(Math.max(half.x, 1e-3), Math.max(half.y, 1e-3), Math.max(half.z, 1e-3));

  // --- 2. MarchingCubes 를 순수 삼각화기로 사용 -------------------------------
  const mc = new MarchingCubes(RES, new THREE.MeshBasicMaterial(), false, false, 90000);
  const hs = mc.halfsize;
  const supp = capsules.map(c => (c.r * KERNEL_SCALE) ** 2);
  for (let z = 0; z < RES; z++) {
    const nz = (z - hs) / hs, wz = center.z + nz * half.z;
    for (let y = 0; y < RES; y++) {
      const ny = (y - hs) / hs, wy = center.y + ny * half.y;
      for (let x = 0; x < RES; x++) {
        const nx = (x - hs) / hs, wx = center.x + nx * half.x;
        // 조직 패킹(§9.8·원칙③): 캡슐 밀도를 '더하지' 않고 스트리밍 LSE 로 smooth-max.
        //  f = m + log(Σ exp(K·(tᵢ−m)))/K  ≥ max(tᵢ). 단일 캡슐이면 s=1 → f=m=t (기존과 동일).
        //  겹침부에서만 max 를 살짝 넘어(fascia webbing) — 가산 합의 부풂(블롭)이 사라진다.
        let m = 0, s = 0, any = false;
        for (let i = 0; i < capsules.length; i++) {
          const d2 = distSqToSeg(wx, wy, wz, capsules[i].a, capsules[i].b);
          if (d2 >= supp[i]) continue;
          const u = 1 - d2 / supp[i], t = u * u * u;
          if (!any) { m = t; s = 1; any = true; }
          else if (t > m) { s = s * Math.exp(FASCIA_K * (m - t)) + 1; m = t; }
          else { s += Math.exp(FASCIA_K * (t - m)); }
        }
        mc.setCell(x, y, z, any ? m + Math.log(s) / FASCIA_K : 0);
      }
    }
  }
  mc.isolation = ISO;
  mc.update();

  // --- 3. 격자 로컬[-1,1] 정점 → 월드 좌표 -----------------------------------
  const src = mc.geometry.attributes.position.array;
  const n = mc.count; // 정점 수
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = center.x + src[i * 3] * half.x;
    pos[i * 3 + 1] = center.y + src[i * 3 + 1] * half.y;
    pos[i * 3 + 2] = center.z + src[i * 3 + 2] * half.z;
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo = mergeVertices(geo, WELD_TOL);
  geo.computeVertexNormals();

  // --- 4. 스키닝 가중치 — 정점을 가까운 뼈 세그먼트에 바인딩 -----------------
  const bones = rig.drivers;
  const segs = []; // { idx, a, b } 뼈 세그먼트 (뼈 → 자식 뼈, 리프는 점)
  const wp = new THREE.Vector3(), wc = new THREE.Vector3();
  bones.forEach((b, idx) => {
    b.getWorldPosition(wp);
    const kids = b.children.filter(k => k.isBone);
    if (kids.length) {
      for (const k of kids) { k.getWorldPosition(wc); segs.push({ idx, a: wp.clone(), b: wc.clone() }); }
    } else {
      segs.push({ idx, a: wp.clone(), b: wp.clone() });
    }
  });

  const vpos = geo.attributes.position.array;
  const vcount = vpos.length / 3;
  const skinIndex = new Uint16Array(vcount * 4);
  const skinWeight = new Float32Array(vcount * 4);
  const cand = []; // { idx, d2 }
  for (let i = 0; i < vcount; i++) {
    const px = vpos[i * 3], py = vpos[i * 3 + 1], pz = vpos[i * 3 + 2];
    // 뼈 인덱스별 최소 거리
    const best = new Map();
    for (const s of segs) {
      const d2 = distSqToSeg(px, py, pz, s.a, s.b);
      const cur = best.get(s.idx);
      if (cur === undefined || d2 < cur) best.set(s.idx, d2);
    }
    cand.length = 0;
    for (const [idx, d2] of best) cand.push({ idx, d2 });
    cand.sort((a, b) => a.d2 - b.d2);
    let wsum = 0;
    const k = Math.min(MAX_INFLUENCES, cand.length);
    for (let j = 0; j < k; j++) {
      const w = 1 / (cand[j].d2 + 1e-5);
      skinIndex[i * 4 + j] = cand[j].idx;
      skinWeight[i * 4 + j] = w;
      wsum += w;
    }
    for (let j = 0; j < 4; j++) skinWeight[i * 4 + j] /= (wsum || 1);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  // --- 5. SkinnedMesh 바인딩 -------------------------------------------------
  const skeleton = new THREE.Skeleton(bones); // 현재(rest) 월드에서 boneInverses 계산
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9a88f, roughness: 0.72, metalness: 0.0 });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.normalizeSkinWeights();
  mesh.bind(skeleton, new THREE.Matrix4()); // bindMatrix = I (지오메트리가 이미 월드)

  const tris = n / 3;
  return { mesh, skeleton, stats: { tris, verts: vcount } };
}

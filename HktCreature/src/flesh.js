// flesh.js — 리그 위에 절차 살(SkinnedMesh)을 기른다.
//
// 절대 원칙: "모양을 그리지" 않는다 — 살은 리그의 뼈 세그먼트(부모관절→자식관절)마다
// 캡슐을 세우고 skinning 가중치로 뼈에 묶은 결과일 뿐이다. 뼈가 표준 스켈레탈
// 애니메이션(=Mixamo 클립)으로 움직이면 GPU 스키닝이 살을 따라 변형한다.
// bind 는 리그 rest 포즈(=Mixamo bind 포즈)에서 잡으므로 클립이 그대로 맞는다.
//
// 정점은 리그와 같은 **월드(cm) 공간**으로 저작한다 — buildRig 가 스케일 그룹 없이
// bone.matrixWorld(cm) 로 Skeleton 역-bind 를 계산하므로 공간이 일치한다. SkinnedMesh 는
// 씬 원점(identity)에 두고, hips 를 그 아래로 넣은 뒤 기본 bindMatrix 로 바인딩하면
// rest 에서 살과 뼈가 정확히 겹친다. 화면 크기는 카메라가 맞춘다(리그를 스케일하지 않음).

import * as THREE from 'three';

// 살 게놈: 뼈 부위별 반지름(cm, 리그 템플릿과 같은 단위)과 전체 굵기 배율.
// 새 크리처의 실루엣은 이 숫자에서 창발한다 (손 조각 없음).
export const DEFAULT_FLESH = {
  girth: 1.0,             // 전체 반지름 배율
  radialSegments: 12,     // 캡슐 둘레 분할
  // 부위별 기본 반지름(cm). simpleName 정규식으로 매칭, 위→아래 순서로 첫 매치.
  radii: [
    [/Hips/, 13], [/Spine2/, 12], [/Spine1/, 12], [/Spine/, 12.5],
    [/Neck/, 4.5], [/HeadTop/, 8], [/Head/, 9],
    [/Shoulder/, 5.5], [/ForeArm/, 4], [/Arm/, 5.5], [/Hand/, 3.5],
    [/UpLeg/, 8.5], [/Leg/, 6], [/Foot/, 5], [/Toe/, 3.5],
    [/Thumb|Index|Middle|Ring|Pinky/, 1.2],
  ],
};

// 손가락은 v1 살에서 생략(뼈는 남아 애니메이션됨) — 실루엣을 깔끔하게.
const SKIP_FLESH = /Thumb|Index|Middle|Ring|Pinky|_End$/;

function radiusFor(name, flesh) {
  for (const [re, r] of flesh.radii) if (re.test(name)) return r;
  return 4;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// 한 세그먼트(부모관절 start → 자식관절 end)를 닫힌 캡슐로 만든다.
// 가중치: 축 방향 비율 t(0=start,1=end) 로 부모↔자식 2본 블렌드 → 관절이 굽는다.
function buildCapsule(start, end, r0, r1, idxA, idxB, R, out) {
  const axis = new THREE.Vector3().subVectors(end, start);
  const len = axis.length();
  if (len < 1e-6) return;
  const dir = axis.clone().multiplyScalar(1 / len);
  // 직교 프레임
  const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(up, dir).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();

  const base = out.pos.length / 3;
  // 축 링: 아래 반구(-1..0), 몸통(0..1), 위 반구(1..2). 각 stack 을 파라미터 p 로.
  const stacks = [];
  const capRings = 3;
  // 아래 반구
  for (let i = capRings; i >= 1; i--) {
    const a = (i / capRings) * (Math.PI / 2); // 0..PI/2
    stacks.push({ along: -Math.sin(a) * r0, radius: Math.cos(a) * r0, center: start, r: r0, t: 0 });
  }
  // 몸통 시작/끝
  stacks.push({ along: 0, radius: r0, center: start, r: r0, t: 0 });
  stacks.push({ along: 0, radius: r1, center: end, r: r1, t: 1 });
  // 위 반구
  for (let i = 1; i <= capRings; i++) {
    const a = (i / capRings) * (Math.PI / 2);
    stacks.push({ along: Math.sin(a) * r1, radius: Math.cos(a) * r1, center: end, r: r1, t: 1 });
  }

  const ringCount = stacks.length;
  for (const s of stacks) {
    // 중심 + 축 오프셋(반구는 관절 바깥으로 튀어나옴)
    const cx = s.center.x + dir.x * s.along;
    const cy = s.center.y + dir.y * s.along;
    const cz = s.center.z + dir.z * s.along;
    const wChild = smoothstep(0.4, 1.0, s.t);
    for (let j = 0; j < R; j++) {
      const th = (j / R) * Math.PI * 2;
      const ct = Math.cos(th), st = Math.sin(th);
      out.pos.push(
        cx + (u.x * ct + v.x * st) * s.radius,
        cy + (u.y * ct + v.y * st) * s.radius,
        cz + (u.z * ct + v.z * st) * s.radius,
      );
      out.skinIndex.push(idxA, idxB, 0, 0);
      out.skinWeight.push(1 - wChild, wChild, 0, 0);
    }
  }
  // 인덱스(링 사이 quad)
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < R; j++) {
      const a = base + i * R + j;
      const b = base + i * R + ((j + 1) % R);
      const c = base + (i + 1) * R + j;
      const d = base + (i + 1) * R + ((j + 1) % R);
      out.index.push(a, c, b, b, c, d);
    }
  }
}

// 리그(buildRig 결과)에서 SkinnedMesh 를 생성해 반환한다.
export function growFlesh(rig, fleshParams = {}, material) {
  const flesh = { ...DEFAULT_FLESH, ...fleshParams };
  const R = flesh.radialSegments;
  const bones = rig.bones;
  const boneIndex = new Map(bones.map((b, i) => [b.name, i]));

  const out = { pos: [], skinIndex: [], skinWeight: [], index: [] };
  const wp = new THREE.Vector3(), wc = new THREE.Vector3();

  // 각 뼈의 각 자식에 대해 세그먼트 캡슐. 소유 뼈 = 부모(세그먼트 길이는 부모의 살).
  for (const bone of bones) {
    if (SKIP_FLESH.test(bone.name)) continue;
    for (const child of bone.children) {
      if (!child.isBone) continue;
      if (SKIP_FLESH.test(child.name)) continue;
      bone.getWorldPosition(wp);
      child.getWorldPosition(wc);
      const r0 = radiusFor(bone.name, flesh) * flesh.girth;
      const r1 = radiusFor(child.name, flesh) * flesh.girth;
      buildCapsule(wp.clone(), wc.clone(), r0, r1,
        boneIndex.get(bone.name), boneIndex.get(child.name), R, out);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.skinWeight, 4));
  geo.setIndex(out.index);
  geo.computeVertexNormals();

  const mesh = new THREE.SkinnedMesh(geo, material || new THREE.MeshStandardMaterial({
    color: 0xff8c69, roughness: 0.75, metalness: 0.0,
  }));
  mesh.name = 'CreatureFlesh';
  mesh.add(rig.hips);          // 스켈레톤 루트를 메시 자식으로(three 표준 SkinnedMesh 구조)
  mesh.bind(rig.skeleton);     // 기본 bindMatrix(=메시 월드=identity) 로 바인딩
  mesh.frustumCulled = false;
  return mesh;
}

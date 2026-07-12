// flesh.js — 로드한 스켈레톤 위에 절차 살(SkinnedMesh)을 기른다.
//
// 절대 원칙: "모양을 그리지" 않는다 — 살은 리그의 뼈 세그먼트(부모관절→자식관절)마다
// 캡슐을 세우고 skinning 가중치로 뼈에 묶은 결과일 뿐이다. 뼈가 표준 스켈레탈
// 애니메이션(=Mixamo 리타깃 클립)으로 움직이면 GPU 스키닝이 살을 따라 변형한다.
//
// 입력은 **로드한 FBX 의 구동 뼈(drivers)** — HktCharacter 로더가 골라준 계층 등뼈들.
// 뼈 이름은 리그마다 다르므로(mixamorig:Hips / Hips …) 부위 매칭은 simpleName 으로 한다.
//
// 좌표계 = 뼈의 월드 공간(로더가 스케일 없이 cm 로 배치). 살 정점을 그 월드에서 저작하고,
// 새 Skeleton(drivers) 로 역-bind 를 잡은 뒤, 살 메시는 씬 원점(identity)에 두고 기본
// bindMatrix 로 바인딩한다. 살 메시와 뼈가 서로 다른 서브트리에 있어도 skinning 은 뼈
// 행렬만 참조하므로 문제없다(뼈의 모든 이동/회전/스케일이 boneMatrix 로 흘러 살에 반영).

import * as THREE from 'three';

// 살 게놈: 부위별 반지름(cm)과 전체 굵기. simpleName 정규식으로 부위 매칭.
export const DEFAULT_FLESH = {
  girth: 1.0,
  radialSegments: 12,
  radii: [
    [/^hips$/, 13], [/^spine2$/, 12], [/^spine1$/, 12], [/^spine$/, 12.5],
    [/^neck$/, 4.5], [/headtop/, 8], [/^head$/, 9],
    [/shoulder$/, 5.5], [/forearm$/, 4], [/arm$/, 5.5], [/^(left|right)hand$/, 3.5],
    [/upleg$/, 8.5], [/leg$/, 6], [/foot$/, 5], [/toe/, 3.5],
    [/thumb|index|middle|ring|pinky/, 1.2],
  ],
};

// 손가락은 v1 살에서 생략(뼈는 남아 애니메이션됨). 리프(_end/toe_end 등)도 생략.
const SKIP_FLESH = /thumb|index|middle|ring|pinky|_?end$|toe_?end/;

function radiusFor(sn, flesh) {
  for (const [re, r] of flesh.radii) if (re.test(sn)) return r;
  return 4;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// 한 세그먼트(부모관절 start → 자식관절 end)를 닫힌 캡슐로. 가중치: 축 비율 t 로 부모↔자식 블렌드.
function buildCapsule(start, end, r0, r1, idxA, idxB, R, out) {
  const axis = new THREE.Vector3().subVectors(end, start);
  const len = axis.length();
  if (len < 1e-4) return;
  const dir = axis.clone().multiplyScalar(1 / len);
  const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(up, dir).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();

  const base = out.pos.length / 3;
  const stacks = [];
  const capRings = 3;
  for (let i = capRings; i >= 1; i--) {
    const a = (i / capRings) * (Math.PI / 2);
    stacks.push({ along: -Math.sin(a) * r0, radius: Math.cos(a) * r0, center: start, t: 0 });
  }
  stacks.push({ along: 0, radius: r0, center: start, t: 0 });
  stacks.push({ along: 0, radius: r1, center: end, t: 1 });
  for (let i = 1; i <= capRings; i++) {
    const a = (i / capRings) * (Math.PI / 2);
    stacks.push({ along: Math.sin(a) * r1, radius: Math.cos(a) * r1, center: end, t: 1 });
  }

  const ringCount = stacks.length;
  for (const s of stacks) {
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

// 로드한 구동 뼈(drivers) 위에 SkinnedMesh 를 생성해 반환한다.
//  drivers    : THREE.Bone[] (로더가 고른 계층 등뼈들)
//  simpleName : (name)=>정규화된 부위명
export function growFlesh(drivers, simpleName, fleshParams = {}, material) {
  const flesh = { ...DEFAULT_FLESH, ...fleshParams };
  const R = flesh.radialSegments;
  const driverSet = new Set(drivers);
  const boneIndex = new Map(drivers.map((b, i) => [b, i]));

  // 뼈 월드 변환 확정.
  drivers[0]?.updateWorldMatrix(true, false);
  const root = drivers[0];
  root?.parent?.updateWorldMatrix(true, false);
  for (const b of drivers) b.updateWorldMatrix(true, false);

  const out = { pos: [], skinIndex: [], skinWeight: [], index: [] };
  const wp = new THREE.Vector3(), wc = new THREE.Vector3();

  // 각 구동 뼈의 각 (구동)자식에 세그먼트 캡슐. 소유 뼈 = 부모.
  for (const bone of drivers) {
    const sn = simpleName(bone.name);
    if (SKIP_FLESH.test(sn)) continue;
    for (const child of bone.children) {
      if (!child.isBone || !driverSet.has(child)) continue;   // 트윈/비구동 자식 스킵
      const csn = simpleName(child.name);
      if (SKIP_FLESH.test(csn)) continue;
      bone.getWorldPosition(wp);
      child.getWorldPosition(wc);
      const r0 = radiusFor(sn, flesh) * flesh.girth;
      const r1 = radiusFor(csn, flesh) * flesh.girth;
      buildCapsule(wp.clone(), wc.clone(), r0, r1, boneIndex.get(bone), boneIndex.get(child), R, out);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.skinWeight, 4));
  geo.setIndex(out.index);
  geo.computeVertexNormals();

  const skeleton = new THREE.Skeleton(drivers);   // 로드 뼈 그대로 공유(역-bind = 현재 rest)
  const mesh = new THREE.SkinnedMesh(geo, material || new THREE.MeshStandardMaterial({
    color: 0xff8c69, roughness: 0.72, metalness: 0.0,
  }));
  mesh.name = 'CreatureFlesh';
  mesh.bind(skeleton);              // 살 메시는 씬 원점(identity) → 기본 bindMatrix=I
  mesh.frustumCulled = false;
  return mesh;
}

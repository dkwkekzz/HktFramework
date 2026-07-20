// ============================================================================
//  landmarks.js — 파이프라인 단계 2: Bone Landmark Detection (설계서 §9.2)
//
//  근육 부착에 쓸 **뼈 표면 랜드마크**를 규칙 기반으로 검출한다. 뼈 메시가 없으므로
//  (우리는 Mixamo 뼈 = 점 계층 + 캡슐 프록시) 랜드마크는 뼈 프록시에서 파생한다:
//    - 장축(proximal→distal): 뼈 원점 → 자식 뼈(원위) 방향. 리프는 부모 축 연장.
//    - 양 끝단: proximal(관절, 뼈 원점) · distal(자식 관절).
//    - 면 분류: anterior(전)·posterior(후)·lateral(외측=정중선 반대)·medial(내측).
//    - 표면 점: 양 끝 × 4면 = 8개(뼈 프록시 반지름만큼 축에서 벗어난 점).
//
//  이 좌표계가 WP-14(Attachment Solver)의 후보 영역·부착 배치 기준이 된다. 현재 근육
//  아틀라스(off/t)는 그대로 두고, 랜드마크는 **추가 인프라**로만 노출한다(회귀 0).
//
//  불변 정합: 뼈→근육 단방향. 랜드마크는 뼈에서만 파생(피부·근육 참조 없음). 월드가
//  아니라 "뼈 + 프레임"에서 매 호출 해석하므로 비율·포즈가 바뀌어도 관계가 유지된다.
// ============================================================================
import * as THREE from 'three';
import { simpleName } from './skeleton.js';
import { BONE_PADDING, FACING } from './anatomy.js';

const ANT = new THREE.Vector3(0, 0, FACING); // 전면 월드 방향
const UPX = new THREE.Vector3(1, 0, 0);
const DEFAULT_RADIUS = 0.04;                 // 뼈 프록시 기본 반지름(BONE_PADDING 미매칭 시)

// 뼈 프록시 반지름 — BONE_PADDING 규칙에서 찾고, 없으면 기본값.
function proxyRadius(sn) {
  const pad = BONE_PADDING.find(p => p.re.test(sn));
  return pad ? pad.r : DEFAULT_RADIUS;
}

// 뼈의 원위(distal) 방향 대표점: 구동 자식 뼈들의 평균 월드 위치. 리프(자식 없음)는 null.
function distalPoint(bone, rig, out) {
  const kids = bone.children.filter(k => k.isBone && rig.boneMap.get(simpleName(k.name)) === k);
  if (!kids.length) return null;
  out.set(0, 0, 0);
  const p = new THREE.Vector3();
  for (const k of kids) out.add(k.getWorldPosition(p));
  return out.multiplyScalar(1 / kids.length);
}

// 한 뼈의 랜드마크 세트를 현재 포즈에서 계산한다.
//  { bone, sn, proximal, distal, axis, length, radius, faces:{ant,post,lat,med}, points:{...} }
function boneLandmarks(bone, rig) {
  const sn = simpleName(bone.name);
  const proximal = bone.getWorldPosition(new THREE.Vector3());
  const dp = distalPoint(bone, rig, new THREE.Vector3());
  // 장축: distal 있으면 proximal→distal, 리프면 부모→자기 방향 연장.
  const axis = new THREE.Vector3();
  let length;
  if (dp) { axis.subVectors(dp, proximal); length = axis.length() || 1e-4; }
  else if (bone.parent && bone.parent.isBone) {
    axis.subVectors(proximal, bone.parent.getWorldPosition(new THREE.Vector3()));
    length = axis.length() || 1e-4;
  } else { axis.set(0, 1, 0); length = 1e-4; }
  axis.multiplyScalar(1 / (axis.length() || 1e-4));
  const distal = dp || proximal.clone().addScaledVector(axis, length);

  // 면 프레임: anterior = ANT 를 축에 수직 투영(축이 ANT 와 평행하면 X 폴백).
  const ant = ANT.clone().addScaledVector(axis, -axis.dot(ANT));
  if (ant.lengthSq() < 1e-6) ant.copy(UPX).addScaledVector(axis, -axis.dot(UPX));
  ant.normalize();
  const post = ant.clone().multiplyScalar(-1);
  // 측면 = 축×전면. lateral 은 정중선(x=0) 반대쪽(팔·다리는 바깥). medial 은 그 반대.
  const side = new THREE.Vector3().crossVectors(axis, ant).normalize();
  const lateral = side.clone();
  if (lateral.x * proximal.x < 0) lateral.multiplyScalar(-1); // lateral.x 를 proximal.x 부호에 맞춤
  const medial = lateral.clone().multiplyScalar(-1);
  const faces = { ant, post, lat: lateral, med: medial };

  // 표면 점: 양 끝(proximal/distal) × 4면. 축에서 radius 만큼 벗어난 점 = 부착 후보 영역.
  const radius = proxyRadius(sn);
  const surf = (end, f) => end.clone().addScaledVector(f, radius);
  const points = {
    proximal: proximal.clone(), distal: distal.clone(),
    proximalAnt: surf(proximal, ant), proximalPost: surf(proximal, post),
    proximalLat: surf(proximal, lateral), proximalMed: surf(proximal, medial),
    distalAnt: surf(distal, ant), distalPost: surf(distal, post),
    distalLat: surf(distal, lateral), distalMed: surf(distal, medial),
  };
  return { bone, sn, proximal, distal, axis, length, radius, faces, points };
}

// 전 구동 뼈의 랜드마크. rig 은 updateMatrixWorld 된 상태여야 한다.
//  Map<simpleName, landmarkSet>. 포즈·비율이 바뀌면 다시 호출(순수 파생).
export function detectLandmarks(rig) {
  rig.obj.updateMatrixWorld(true);
  const map = new Map();
  for (const bone of rig.drivers) map.set(simpleName(bone.name), boneLandmarks(bone, rig));
  return map;
}

// 모든 표면 점을 평평한 배열로 — 검증·렌더 오버레이용.
export function landmarkPoints(map) {
  const out = [];
  for (const lm of map.values())
    for (const [name, p] of Object.entries(lm.points)) out.push({ sn: lm.sn, name, p });
  return out;
}

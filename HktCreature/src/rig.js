// rig.js — 코드로 짓는 Mixamo 표준 스켈레톤.
//
// 절대 원칙: 스켈레톤은 "만든다" — FBX 스킨 메시를 로드하지 않는다. 대신
// Mixamo 표준 리그의 rest 계층(이름·부모·로컬 위치)을 실측한 `RIG_TEMPLATE` 표에서
// THREE.Bone 을 절차 생성한다. 뼈 이름·계층·bind 포즈가 Mixamo 원본과 동일하므로
// Mixamo 클립이 **리타깃 없이 그대로** 이 리그를 구동한다 (=목표의 핵심).
//
// 살(flesh)은 여기서 만들지 않는다 — flesh.js 가 이 리그에 skinning 으로 얹는다.
//
// 좌표계: Mixamo 원본 단위(cm)를 그대로 쓴다(Hips.y≈103). 스케일 그룹을 씌우지
// 않아 Skeleton 역-bind 공간과 살 정점 공간이 항상 일치한다 — 화면 크기는 카메라가 맞춘다.

import * as THREE from 'three';
import { RIG_TEMPLATE } from './rig-template.js';

// 게놈: 크리처 = 숫자 벡터. 뼈 길이 배율만 있어도 체형이 창발한다(팔다리·몸통·목·어깨).
// AI-only 파이프라인의 진입점 — 새 크리처 = 새 게놈 (손으로 그린 에셋 없음).
export const DEFAULT_GENOME = {
  torso: 1.0,       // Spine* 길이 배율
  neck: 1.0,        // Neck/Head 길이 배율
  arm: 1.0,         // Arm/ForeArm/Hand 길이 배율
  leg: 1.0,         // UpLeg/Leg/Foot 길이 배율
  shoulder: 1.0,    // 어깨 폭 배율 (Shoulder 로컬 x)
};

// 뼈 이름 → 게놈 그룹. 로컬 위치(부모→자식 오프셋)에 배율을 곱해 길이를 바꾼다.
// 위치만 스케일하고 회전은 건드리지 않으므로 클립 구동과 충돌하지 않는다.
function genomeScaleFor(name, g) {
  if (/^Spine/.test(name)) return g.torso;
  if (/^(Neck|Head)/.test(name)) return g.neck;
  if (/(Arm|ForeArm|Hand)/.test(name)) return g.arm;
  if (/(UpLeg|Leg|Foot|Toe)/.test(name)) return g.leg;
  return 1.0;
}

// 리그를 절차 생성한다. 반환: { hips, bones, boneMap, skeleton, genome }.
// hips 는 아직 씬에 붙지 않은 자립 계층 — flesh.js 가 SkinnedMesh 아래로 넣는다.
export function buildRig(genome = {}) {
  const g = { ...DEFAULT_GENOME, ...genome };
  const bones = [];
  const boneMap = new Map();

  for (const def of RIG_TEMPLATE) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    const s = genomeScaleFor(def.name, g);
    const sx = /Shoulder$/.test(def.name) ? g.shoulder : 1;  // 어깨 폭은 Shoulder 로컬 x 만
    bone.position.set(def.pos[0] * s * sx, def.pos[1] * s, def.pos[2] * s);
    bone.quaternion.set(def.quat[0], def.quat[1], def.quat[2], def.quat[3]);
    bones.push(bone);
    boneMap.set(def.name, bone);
  }

  let hips = null;
  for (const def of RIG_TEMPLATE) {
    const bone = boneMap.get(def.name);
    if (def.parent) boneMap.get(def.parent).add(bone);
    else hips = bone;
  }

  // rest 월드 변환을 확정한 뒤 Skeleton 생성 → 역-bind 가 이 rest(=Mixamo bind) 포즈로 잡힌다.
  hips.updateWorldMatrix(false, true);
  const skeleton = new THREE.Skeleton(bones);

  return { hips, bones, boneMap, skeleton, genome: g };
}

// 클립을 이 리그에 "그대로" 바인딩 가능하게 만든다 — 리타깃이 아니라 **이름 정규화**만.
// Mixamo export 별로 뼈 이름 접두사가 다르다("mixamorig:Hips" / "mixamorigHips" / "Hips").
// 우리 리그는 접두사 없는 표준 이름을 쓰므로, 트랙 타깃에서 접두사만 벗긴다.
// 포즈 데이터(키프레임 값)는 일절 건드리지 않는다 = "애니메이션을 그대로 사용".
export function normalizeClip(clip) {
  for (const track of clip.tracks) {
    track.name = track.name.replace(/^mixamorig[:_]?/i, '');
  }
  return clip;
}

// ============================================================================
//  joints.js — 파이프라인 단계 3: Joint Function Analysis (설계서 §9.3)
//
//  각 관절이 어떤 운동을 지원하는지(자유도·회전축·범위)를 스켈레톤에서 분석한다.
//  Mixamo 뼈에는 관절 한계가 없으므로, **역할 규칙 + 랜드마크 축**으로 경량 추정한다:
//    - 관절 = 부모 뼈 → 이 뼈 연결(피벗 = 이 뼈 원점).
//    - 자유도/유형: 역할 표(팔꿈치·무릎=hinge 1DOF, 어깨·고관절=ball 3DOF, 척추·목=제한).
//    - 굴곡축(hinge): 랜드마크 면 프레임의 lateral(내외측) — 팔꿈치·무릎은 이 축으로 굽는다.
//      (bind T-포즈는 사지가 펴져 있어 인접 뼈 방향 cross 로는 축이 퇴화 → 랜드마크 축 사용.)
//    - 회전 범위: 유형별 대표값(정확한 생리 복원 아님 — 길항·토크의 상대 근거, §9.3).
//
//  이 관절 기능 그래프가 길항쌍·토크 방향(WP-04)과 기능 합성(모드 B·WP-08)의 전제다.
//  불변 정합: 뼈→관절 단방향 파생. 근육·피부를 참조하지 않는다.
// ============================================================================
import * as THREE from 'three';
import { simpleName } from './skeleton.js';

const D2R = Math.PI / 180;

// 역할 규칙: 뼈 simpleName(좌우 접두어 제거) → 관절 유형·자유도·범위(도).
//  hinge=경첩(굴곡/신전 1축), ball=구관절(3축), pivot=회전, limited=제한 굴곡.
function roleOf(sn) {
  const base = sn.replace(/^(left|right)/, '');
  switch (base) {
    case 'forearm': return { joint: 'elbow', type: 'hinge', dof: 1, range: { min: 0, max: 150 }, axisFace: 'lat' };
    case 'leg':     return { joint: 'knee', type: 'hinge', dof: 1, range: { min: 0, max: 145 }, axisFace: 'lat' };
    case 'arm':     return { joint: 'shoulder', type: 'ball', dof: 3, range: { min: -90, max: 180 }, axisFace: 'lat' };
    case 'upleg':   return { joint: 'hip', type: 'ball', dof: 3, range: { min: -30, max: 120 }, axisFace: 'lat' };
    case 'hand':    return { joint: 'wrist', type: 'hinge', dof: 2, range: { min: -70, max: 80 }, axisFace: 'lat' };
    case 'foot':    return { joint: 'ankle', type: 'hinge', dof: 1, range: { min: -40, max: 40 }, axisFace: 'lat' };
    case 'spine': case 'spine1': case 'spine2': return { joint: 'spine', type: 'limited', dof: 3, range: { min: -30, max: 30 }, axisFace: 'lat' };
    case 'neck':    return { joint: 'neck', type: 'ball', dof: 3, range: { min: -60, max: 60 }, axisFace: 'lat' };
    case 'head':    return { joint: 'atlas', type: 'ball', dof: 3, range: { min: -45, max: 45 }, axisFace: 'lat' };
    default: return null; // 손가락·발가락 등 세부 관절은 비대상(§2.2)
  }
}

// 관절 기능 그래프. rig 은 updateMatrixWorld 상태, landmarks = detectLandmarks(rig) 결과.
//  Map<boneSimpleName, { name, sn, type, dof, pivot, parentBone, childBone, flexionAxis, range }>
export function analyzeJoints(rig, landmarks) {
  rig.obj.updateMatrixWorld(true);
  const map = new Map();
  for (const bone of rig.drivers) {
    if (!bone.parent || !bone.parent.isBone) continue; // 루트(hips)는 관절 없음
    const sn = simpleName(bone.name);
    const role = roleOf(sn);
    if (!role) continue;
    const lm = landmarks.get(sn);
    if (!lm) continue;
    // 굴곡축 = 랜드마크 면 프레임의 지정 축(hinge 는 내외측 lat). 단위 벡터.
    const flexionAxis = (lm.faces[role.axisFace] || lm.faces.lat).clone().normalize();
    map.set(sn, {
      name: role.joint, sn, type: role.type, dof: role.dof,
      pivot: lm.proximal.clone(),          // 관절 피벗 = 이 뼈 원점(랜드마크 근위)
      parentBone: bone.parent, childBone: bone,
      flexionAxis,                          // hinge 회전축(월드)
      range: { min: role.range.min * D2R, max: role.range.max * D2R }, // 라디안
    });
  }
  return map;
}

// 한 근육(부착 두 점)이 주어진 관절에 대해 굴근인지 신근인지 부호로 판정한다(§9.4·§7.4).
//  모멘트암 부호 = (부착 중점 − 피벗) 을 굴곡축 기준 회전면에 투영했을 때 전(+)/후(−).
//  전면 통과(+) → 굴근(agonist), 후면(−) → 신근(antagonist). WP-04 가 소비.
export function momentSign(joint, attachMid, anteriorDir) {
  const r = attachMid.clone().sub(joint.pivot);
  // 회전면 성분(축 제거) 중 전면 방향 성분의 부호.
  r.addScaledVector(joint.flexionAxis, -r.dot(joint.flexionAxis));
  return Math.sign(r.dot(anteriorDir)) || 0;
}

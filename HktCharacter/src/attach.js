// ============================================================================
//  attach.js — 파이프라인 단계 5: Attachment Solver (설계서 §9.5·원칙⑤)
//
//  손으로 지정한 부착 오프셋 대신, **근육의 기능**(어떤 관절의 굴근/신근인가)으로부터 부착을
//  도출한다. 후보 = 뼈 표면 랜드마크(WP-11) 점들, 점수 = 그 점이 관절(WP-12)에 원하는 토크를
//  내는가 + 모멘트암 + 관절면 페널티(§9.5 AttachmentScore). 최고 점수 후보를 부착으로 고른다.
//
//  이것이 "AI/솔버는 후보·파라미터를 제안하고, 기하·기능 제약이 검증·선택한다"(원칙⑤·§12)의
//  결정론 솔버 부분이다. 아틀라스 없이도 부착이 기능에서 나오므로 모드 B(WP-08)의 전제가 된다.
//
//  스코프(경량판): 지금은 **솔버를 검증용/도출용 모듈**로 둔다 — 생산 아틀라스(anatomy.js)를
//  당장 대체하지 않고(손 튜닝 파이프라인 안정성 유지), 솔버가 기능→해부학적으로 맞는 부착 면을
//  뽑아냄을 증명한다. 아틀라스 rewire·모드 B 소비는 후속.
//  불변 정합: 뼈(랜드마크)·관절에서만 파생 — 근육 메시·피부 참조 없음(단방향).
// ============================================================================
import * as THREE from 'three';
import { momentSign } from './joints.js';
import { simpleName } from './skeleton.js';

const _r = new THREE.Vector3();

// 랜드마크 점 이름 → 면(전/후/외/내/끝).
function faceOf(name) {
  return name.includes('Ant') ? 'ant' : name.includes('Post') ? 'post'
    : name.includes('Lat') ? 'lat' : name.includes('Med') ? 'med' : 'end';
}

// 한 부착 후보 점의 점수(§9.5). role: 'flexor'(굴근) | 'extensor'(신근).
//  wantSign = 원하는 모멘트암 부호(굴근 전방 +1 / 신근 후방 −1).
function scorePoint(point, joint, anteriorDir, wantSign) {
  const ms = momentSign(joint, point, anteriorDir);            // 이 점이 내는 토크 부호
  const torque = ms === wantSign ? 1 : ms === 0 ? 0 : -1;      // 방향 일치 보상/불일치 벌점
  _r.copy(point).sub(joint.pivot);                            // 피벗→점
  _r.addScaledVector(joint.flexionAxis, -_r.dot(joint.flexionAxis)); // 회전면 성분(축 제거)
  const arm = _r.length();                                    // 모멘트암
  const armScore = Math.min(arm / 0.04, 1);                   // 4cm 에서 포화
  const jointPenalty = arm < 0.006 ? 1 : 0;                   // 관절면 너무 가까움 벌점
  // AttachmentScore = 토크방향(가중2) + 모멘트암 − 관절면 페널티 (§9.5 경량판)
  return { score: torque * 2 + armScore - jointPenalty, torqueSign: ms, arm };
}

// 한 뼈의 랜드마크 표면 점들을 후보로 점수화해 정렬. 끝점(proximal/distal)은 제외(면 없음).
function rankCandidates(boneLm, joint, anteriorDir, wantSign) {
  const cands = [];
  for (const [name, point] of Object.entries(boneLm.points)) {
    if (name === 'proximal' || name === 'distal') continue;
    const s = scorePoint(point, joint, anteriorDir, wantSign);
    cands.push({ name, face: faceOf(name), point: point.clone(), ...s });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands;
}

// 근육 기능 명세 → 정지부(insertion) 부착 도출(§9.5).
//  spec: { insertionBone, joint, role:'flexor'|'extensor' } (simpleName).
//  반환 { insertion: best, candidates: ranked[] } · 실패 시 null.
export function solveInsertion(spec, landmarks, joints) {
  const joint = joints.get(spec.joint);
  const jointLm = landmarks.get(spec.joint);
  const insLm = landmarks.get(spec.insertionBone);
  if (!joint || !jointLm || !insLm) return null;
  const wantSign = spec.role === 'flexor' ? 1 : -1;
  const ranked = rankCandidates(insLm, joint, jointLm.faces.ant, wantSign);
  return { insertion: ranked[0], candidates: ranked };
}

// 근육 기시(origin) 부착 도출 — 근위 뼈 위, role 쪽 면(굴근=전면/신근=후면)이면서 관절서
//  먼 점(벨리가 길게 뻗도록). 기시는 고정단이라 토크가 아니라 면·거리로 고른다(§9.5).
export function solveOrigin(spec, landmarks, joints) {
  const joint = joints.get(spec.joint);
  const oLm = landmarks.get(spec.originBone);
  if (!joint || !oLm) return null;
  const wantFace = spec.role === 'flexor' ? 'ant' : 'post';
  const cands = [];
  for (const [name, point] of Object.entries(oLm.points)) {
    if (name === 'proximal' || name === 'distal') continue;
    const face = faceOf(name);
    const faceScore = face === wantFace ? 1 : (face === 'ant' || face === 'post') ? -1 : 0;
    const distFromJoint = point.distanceTo(joint.pivot); // 관절서 멀수록 벨리가 길다
    cands.push({ name, face, point: point.clone(), score: faceScore * 2 + Math.min(distFromJoint / 0.2, 1) });
  }
  cands.sort((a, b) => b.score - a.score);
  return { origin: cands[0], candidates: cands };
}

// ── 모드 B: 기능 합성 (설계서 §9.4B·G5) ────────────────────────────────────
// 해부학 아틀라스 없이 **관절 기능만으로** 근육을 만든다. 경첩 관절마다 굴근(agonist)·신근
//  (antagonist) 쌍을 생성하고, 각 근육의 기시·정지를 솔버로 도출한다. 판타지·비인간형 생물의
//  씨앗 — 관절 기능 그래프(WP-12)만 있으면 부착이 나오므로 종족 템플릿이 필요 없다.
export function synthesizeJointMuscles(jointSn, landmarks, joints) {
  const joint = joints.get(jointSn);
  if (!joint || joint.type !== 'hinge') return null; // 경첩(1DOF 굴곡/신전)만 — 굴근/신근 쌍
  const proximalSn = simpleName(joint.parentBone.name); // 근위 뼈(기시 부착)
  const out = [];
  for (const role of ['flexor', 'extensor']) {          // 각 자유도에 길항 쌍(§9.3)
    const ins = solveInsertion({ insertionBone: jointSn, joint: jointSn, role }, landmarks, joints);
    const ori = solveOrigin({ originBone: proximalSn, joint: jointSn, role }, landmarks, joints);
    if (!ins || !ori) return null;
    out.push({ role, joint: jointSn, isAgonist: role === 'flexor', origin: ori.origin, insertion: ins.insertion });
  }
  return out;
}

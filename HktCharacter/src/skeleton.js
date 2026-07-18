// ============================================================================
//  skeleton.js — 1단계: 골격 로드
//
//  X Bot / Y Bot FBX 를 로드하되 **뼈만** 취한다. 봇에 딸린 원본 스킨 메시는
//  우리 파이프라인의 결과물이 아니므로 버린다(참고용으로 obj 트리에는 남지만
//  씬에 세우지 않는다). 골격은 "만드는 것이 아니라 로드하는 것" — 유일한 골격
//  소스는 이 Mixamo 베이스 FBX 다.
// ============================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// "mixamorig:LeftArm" / "mixamorigLeftArm" / "LeftArm" → "leftarm"
export const simpleName = n =>
  n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();

const TARGET_HEIGHT = 1.7; // m — 로드한 골격을 이 키로 정규화

// FBX 버퍼 → 뼈 계층. with-skin FBX 는 같은 이름 뼈가 트윈으로 교차 배치되므로
// DFS 선순회에서 simpleName 별 **첫 뼈**(항상 조상 쪽)만 구동 뼈로 채택한다.
export function loadSkeleton(buf) {
  const obj = new FBXLoader().parse(buf, '');
  const all = [];
  obj.traverse(o => { if (o.isBone) all.push(o); });
  if (!all.length) throw new Error('FBX 에 뼈가 없습니다');

  const boneMap = new Map();   // simpleName → 구동 뼈
  const drivers = [];          // 구동 뼈 목록 (스켈레톤/스키닝 인덱스 기준)
  let dup = 0;
  for (const b of all) {       // traverse = DFS 선순회 (부모 먼저)
    const sn = simpleName(b.name);
    if (!boneMap.has(sn)) { boneMap.set(sn, b); drivers.push(b); }
    else b.name = `${b.name}__dup${dup++}`; // 트윈은 개명해 믹서 이름 충돌 제거
  }

  // 원본 스킨 메시는 숨긴다 — 우리는 뼈만 쓴다.
  obj.traverse(o => { if (o.isMesh || o.isSkinnedMesh) o.visible = false; });

  const rig = { obj, all, drivers, boneMap, baseScale: 1 };
  normalizeHeight(rig);
  cacheBind(rig);
  return rig;
}

// 뼈 월드 위치 bbox (스케일·포즈 반영). 스킨 메시 CPU bbox 아님.
export function boneBox(rig, target = new THREE.Box3()) {
  target.makeEmpty();
  const p = new THREE.Vector3();
  for (const b of rig.drivers) target.expandByPoint(b.getWorldPosition(p));
  return target;
}

// 모든 스케일 1 상태의 골격 높이를 재서 TARGET_HEIGHT 로 맞추는 root 배율.
function normalizeHeight(rig) {
  rig.obj.scale.setScalar(1);
  rig.obj.position.set(0, 0, 0);
  rig.obj.updateMatrixWorld(true);
  const size = new THREE.Vector3();
  boneBox(rig).getSize(size);
  rig.baseScale = TARGET_HEIGHT / Math.max(size.y, 1e-3);
  rig.obj.scale.setScalar(rig.baseScale);
  rig.obj.updateMatrixWorld(true);
}

// 리타깃/스키닝이 참조하는 바인드(rest) 상태를 로드 직후 한 번 캐시.
function cacheBind(rig) {
  rig.obj.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  rig.bindLocalQ = new Map();
  rig.bindLocalP = new Map();
  rig.bindWorldQ = new Map();
  rig.staticParentQ = new Map(); // 뼈가 아닌 부모(정적 노드)의 월드 회전
  for (const b of rig.all) {
    rig.bindLocalQ.set(b, b.quaternion.clone());
    rig.bindLocalP.set(b, b.position.clone());
    rig.bindWorldQ.set(b, b.getWorldQuaternion(q).clone());
    const p = b.parent;
    if (p && !p.isBone && !rig.staticParentQ.has(p))
      rig.staticParentQ.set(p, p.getWorldQuaternion(q).clone());
  }
}

// 발바닥을 y=0 에 붙이고 x/z 중심 정렬 (rest 포즈 기준).
export function replant(rig) {
  rig.obj.position.set(0, 0, 0);
  rig.obj.updateMatrixWorld(true);
  const box = boneBox(rig);
  const c = new THREE.Vector3(); box.getCenter(c);
  rig.obj.position.set(-c.x, -box.min.y, -c.z);
  rig.obj.updateMatrixWorld(true);
}

export function disposeRig(rig) {
  if (!rig) return;
  rig.obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) m.dispose?.();
  });
}

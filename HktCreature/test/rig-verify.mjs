// rig-verify.mjs — 브라우저 없이(Node) 코어를 구동해 목표를 검증한다.
//
// 검증 축:
//  A. 리그를 코드로 짓는가        — buildRig 가 Mixamo 표준 57본 계층을 생성.
//  B. 살을 뼈에 붙였는가          — growFlesh 가 skinning 가중치 정규화된 SkinnedMesh 생성.
//  C. Mixamo 클립을 "그대로" 쓰는가 — 실물 walk/idle/run FBX 의 모든 트랙이 리그 뼈에 바인딩.
//  D. 실제로 움직이는가           — AnimationMixer 로 몇 프레임 돌려 뼈 이동 + NaN 0.
//
// 샌드박스는 headless Chromium 이 막혀 픽셀 육안 대신 Node 로 코어를 직접 구동한다
// (HktCharacter 검증 방식과 동일). 브라우저 육안은 `npm run dev` 후 사용자 확인.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { buildRig, normalizeClip } from '../src/rig.js';
import { growFlesh } from '../src/flesh.js';
import { RIG_TEMPLATE } from '../src/rig-template.js';

globalThis.self = globalThis; // FBXLoader 가 참조하는 최소 스텁
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

const HERE = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fail++; };
const section = (t) => console.log('\n' + t);

function loadClip(name) {
  const buf = readFileSync(join(HERE, '..', 'public', 'assets', 'anim', name));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new FBXLoader().parse(ab, '').animations[0];
}

// ── A. 리그 ────────────────────────────────────────────────
section('A. 코드로 지은 Mixamo 표준 스켈레톤');
const rig = buildRig();
ok(rig.bones.length === RIG_TEMPLATE.length, `본 수 = ${rig.bones.length} (템플릿 ${RIG_TEMPLATE.length})`);
ok(rig.hips.name === 'Hips' && !rig.hips.parent, 'Hips 가 리그 루트');
ok(rig.boneMap.has('LeftHand') && rig.boneMap.has('RightFoot'), '표준 이름(LeftHand/RightFoot) 존재');
// 계층 무결성: 모든 템플릿 부모 링크가 실제로 연결됐는가
let linkOk = true;
for (const def of RIG_TEMPLATE) {
  if (def.parent && rig.boneMap.get(def.name).parent !== rig.boneMap.get(def.parent)) linkOk = false;
}
ok(linkOk, '부모-자식 계층이 템플릿과 일치');
ok(rig.skeleton.boneInverses.length === rig.bones.length, 'Skeleton 역-bind 행렬 생성됨');
// 접두사 없는 이름(=번들 클립과 직접 매칭)
ok(!rig.hips.name.includes('mixamorig'), '뼈 이름에 접두사 없음(그대로 바인딩용)');

// ── B. 살 ─────────────────────────────────────────────────
section('B. 리그에 붙인 절차 살(SkinnedMesh)');
const mesh = growFlesh(rig);
ok(mesh.isSkinnedMesh, 'SkinnedMesh 생성');
const posAttr = mesh.geometry.getAttribute('position');
ok(posAttr && posAttr.count > 100, `정점 ${posAttr?.count ?? 0}개`);
ok(!!mesh.geometry.index && mesh.geometry.index.count % 3 === 0, `삼각형 ${(mesh.geometry.index?.count ?? 0) / 3}개`);
// skinWeight 정규화 + skinIndex 범위
const sw = mesh.geometry.getAttribute('skinWeight');
const si = mesh.geometry.getAttribute('skinIndex');
let wOk = true, iOk = true;
for (let v = 0; v < sw.count; v++) {
  const s = sw.getX(v) + sw.getY(v) + sw.getZ(v) + sw.getW(v);
  if (Math.abs(s - 1) > 1e-3) wOk = false;
  for (const comp of ['X', 'Y', 'Z', 'W']) {
    const idx = si['get' + comp](v);
    if (idx < 0 || idx >= rig.bones.length) iOk = false;
  }
}
ok(wOk, 'skinWeight 합 = 1 (정규화)');
ok(iOk, 'skinIndex 가 모두 유효한 뼈를 가리킴');
// 살이 실제로 여러 뼈에 걸쳐 바인딩됐는가(리지드 한 덩어리가 아님)
const usedBones = new Set();
for (let v = 0; v < si.count; v++) { usedBones.add(si.getX(v)); if (sw.getY(v) > 0.01) usedBones.add(si.getY(v)); }
ok(usedBones.size >= 15, `살이 ${usedBones.size}개 뼈에 분산 바인딩`);

// ── C. Mixamo 클립을 그대로 ───────────────────────────────
section('C. Mixamo 애니메이션을 리타깃 없이 그대로 구동');
const rigNames = new Set(rig.bones.map(b => b.name));
for (const file of ['idle.fbx', 'walk.fbx', 'run.fbx']) {
  const clip = normalizeClip(loadClip(file));
  const targets = [...new Set(clip.tracks.map(t => t.name.split('.')[0]))];
  const resolved = targets.filter(n => rigNames.has(n));
  const unresolved = targets.filter(n => !rigNames.has(n));
  // 모든 트랙 타깃이 리그 뼈에 걸려야 "그대로 사용"이 성립(손가락 포함 → 리그도 손가락 뼈 보유)
  ok(unresolved.length === 0,
    `${file}: 트랙 타깃 ${targets.length}개 전부 리그 뼈에 매칭` +
    (unresolved.length ? ` (미매칭: ${unresolved.slice(0, 4).join(',')}…)` : ''));
}

// ── D. 실제 구동 (몇 프레임) ──────────────────────────────
section('D. AnimationMixer 로 실제 포즈 구동');
const scene = new THREE.Scene();
scene.add(mesh);
const mixer = new THREE.AnimationMixer(mesh);
const clip = normalizeClip(loadClip('walk.fbx'));
const action = mixer.clipAction(clip);
action.play();

const leftArm = rig.boneMap.get('LeftArm');
mixer.update(0); scene.updateMatrixWorld(true);
const p0 = new THREE.Vector3(); leftArm.getWorldPosition(p0);  // 클립 시작(0초) 포즈
// 클립 중반(≈40%)까지 진행 — 한 바퀴 다 돌면 시작 포즈로 되돌아오므로 절반만.
const steps = 10, target = clip.duration * 0.4;
for (let i = 0; i < steps; i++) { mixer.update(target / steps); }
scene.updateMatrixWorld(true);
const p1 = new THREE.Vector3(); leftArm.getWorldPosition(p1);
ok(p1.distanceTo(p0) > 0.5, `LeftArm 이 재생으로 이동 (Δ=${p1.distanceTo(p0).toFixed(2)}cm)`);
// 모든 뼈 행렬에 NaN 없음
let nanFree = true;
for (const b of rig.bones) { for (const e of b.matrixWorld.elements) if (!Number.isFinite(e)) nanFree = false; }
ok(nanFree, '모든 뼈 월드 행렬이 유한(NaN 없음)');
// 스키닝 결과 유한성: 샘플 정점을 실제 skinning 으로 변환
const skinned = new THREE.Vector3();
let skinFinite = true;
for (let v = 0; v < posAttr.count; v += Math.max(1, (posAttr.count / 50) | 0)) {
  skinned.fromBufferAttribute(posAttr, v);
  mesh.applyBoneTransform(v, skinned);
  if (![skinned.x, skinned.y, skinned.z].every(Number.isFinite)) skinFinite = false;
}
ok(skinFinite, '스키닝된 정점 좌표가 유한');

// ── 결과 ──────────────────────────────────────────────────
console.log('\n' + (fail === 0 ? '✅ 전체 통과 — 코드-리그 + 절차살 + Mixamo 그대로 구동 확인'
                                : `❌ ${fail}개 실패`));
process.exit(fail === 0 ? 0 : 1);

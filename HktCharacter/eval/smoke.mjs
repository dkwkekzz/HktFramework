// ============================================================================
//  eval/smoke.mjs — 파이프라인 헤드리스 검증 (WebGL 불필요)
//
//  샌드박스가 headless Chromium 을 막으므로, 실제 모듈(skeleton/muscles/skin/
//  retarget)을 Node 에서 그대로 구동해 3단계가 성립하는지 수치로 검증한다.
//  육안 확인은 `npm run dev` 로 사용자가 별도 수행.
//
//  실행: node eval/smoke.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { loadSkeleton, replant, boneBox } from '../src/skeleton.js';
import { MuscleLayer } from '../src/muscles.js';
import { bakeSkin } from '../src/skin.js';
import { parseClipFBX, bakeClip, measureGroundY } from '../src/retarget.js';

const toBuf = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${msg}`); if (!cond) fails++; };

for (const model of ['X Bot', 'Y Bot']) {
  console.log(`\n=== ${model} ===`);

  // ① 뼈 -------------------------------------------------------------------
  const rig = loadSkeleton(toBuf(`public/assets/character/${model}.fbx`));
  replant(rig);
  ok(rig.drivers.length >= 60, `구동 뼈 ${rig.drivers.length}개 (≥60)`);
  ok(['hips', 'leftarm', 'rightupleg', 'head'].every(n => rig.boneMap.has(n)), '핵심 뼈 매핑 존재');
  const bb = boneBox(rig), size = new THREE.Vector3(); bb.getSize(size);
  ok(Math.abs(size.y - 1.7) < 0.05, `골격 키 ${size.y.toFixed(3)}m (≈1.7)`);
  ok(Math.abs(bb.min.y) < 1e-3, `발 접지 min.y=${bb.min.y.toFixed(4)}`);

  // ② 근육 -----------------------------------------------------------------
  const scene = new THREE.Scene();
  const muscles = new MuscleLayer(scene);
  muscles.build(rig);
  ok(muscles.items.length >= 28, `근육 ${muscles.items.length}개 (≥28)`);
  const caps = muscles.getCapsules();
  ok(caps.length > muscles.items.length, `피부 캡슐 ${caps.length}개 (근육+뼈패딩)`);
  ok(caps.every(c => c.r > 0 && isFinite(c.a.x) && isFinite(c.b.y)), '캡슐 반지름>0·좌표 유한');

  // ③ 피부 (굽기) ----------------------------------------------------------
  const t0 = Date.now();
  const { mesh, skeleton, stats } = bakeSkin(rig, caps);
  const bakeMs = Date.now() - t0;
  ok(mesh.isSkinnedMesh, 'SkinnedMesh 생성');
  ok(stats.tris > 1500, `피부 삼각형 ${stats.tris} (>1500)`);
  const g = mesh.geometry;
  ok(!!g.attributes.skinIndex && !!g.attributes.skinWeight, 'skinIndex/skinWeight 속성 존재');
  const si = g.attributes.skinIndex.array;
  ok(si.every(v => v < skeleton.bones.length), `skinIndex 전부 < 뼈수(${skeleton.bones.length})`);
  const sw = g.attributes.skinWeight.array;
  let wOk = true;
  for (let i = 0; i < sw.length; i += 4) {
    const s = sw[i] + sw[i + 1] + sw[i + 2] + sw[i + 3];
    if (Math.abs(s - 1) > 1e-2) { wOk = false; break; }
  }
  ok(wOk, 'skinWeight 각 정점 합 ≈ 1');
  // 피부 bbox — 사람 실루엣(키 ~1.7, 폭 0.3~0.7)
  g.computeBoundingBox();
  const sz = new THREE.Vector3(); g.boundingBox.getSize(sz);
  ok(sz.y > 1.55 && sz.y < 1.95, `피부 높이 ${sz.y.toFixed(2)}m`);
  // 바인드는 T-포즈(팔 수평) — 폭은 팔 벌린 스팬(≈키). 손끝까지 살이 붙었는지 확인.
  ok(sz.x > 1.2 && sz.x < 1.95, `피부 폭(T-포즈 스팬) ${sz.x.toFixed(2)}m`);
  ok(sz.z > 0.12 && sz.z < 0.5, `피부 두께(전후) ${sz.z.toFixed(2)}m`);
  console.log(`    (굽기 ${bakeMs}ms · 정점 ${stats.verts})`);

  // 애니메이션 ------------------------------------------------------------
  scene.add(rig.obj); scene.add(mesh);
  const src = parseClipFBX(toBuf('public/assets/anim/walk.fbx'));
  ok(!!src, 'walk 소스 파싱');
  const clip = bakeClip(rig, src, '걷기');
  ok(clip && clip.tracks.length > 30, `리타깃 클립 트랙 ${clip?.tracks.length}개`);
  const gy = measureGroundY(rig, clip);
  ok(isFinite(gy), `접지 측정 root.y=${gy.toFixed(3)}`);

  // 피부가 실제로 뼈를 따라 변형되는가 — rest 정점 vs 포즈 정점
  const mixer = new THREE.AnimationMixer(rig.obj);
  mixer.clipAction(clip).play();
  const restV = new THREE.Vector3(), poseV = new THREE.Vector3();
  const sample = Math.floor((g.attributes.position.count) * 0.5);
  mixer.setTime(0); scene.updateMatrixWorld(true); mesh.updateMatrixWorld(true);
  const bt = mesh.applyBoneTransform ? 'applyBoneTransform' : 'boneTransform';
  mesh[bt](sample, restV.fromBufferAttribute(g.attributes.position, sample));
  mixer.setTime(clip.duration * 0.5); scene.updateMatrixWorld(true); mesh.updateMatrixWorld(true);
  mesh[bt](sample, poseV.fromBufferAttribute(g.attributes.position, sample));
  ok(restV.distanceTo(poseV) > 1e-3, `피부 정점 애니메이션 변형 Δ=${restV.distanceTo(poseV).toFixed(4)}m`);

  // 근육 라이브 갱신 (포즈에서 예외 없이)
  let muscleOk = true;
  try { muscles.update(); } catch { muscleOk = false; }
  ok(muscleOk, '포즈에서 근육 라이브 갱신 무예외');
}

console.log(`\n${fails === 0 ? '✅ 전체 통과' : `❌ ${fails}개 실패`}`);
process.exit(fails === 0 ? 0 : 1);

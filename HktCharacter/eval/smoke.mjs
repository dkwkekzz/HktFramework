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

  // WP-01 · 부착 패치 (§19.1 구조 검증 + §7.1 부착 불변) ---------------------
  const att = muscles.getAttachments();
  ok(att.length === muscles.items.length * 2, `부착점 ${att.length}개 (근육×2)`);
  ok(att.every(a => a.r > 0 && isFinite(a.world.x) && isFinite(a.pivot.y)), '부착 반지름>0·좌표 유한');
  const byId = new Map(); // 근육별 origin/insertion 개수
  for (const a of att) { const e = byId.get(a.id) || { o: 0, i: 0 }; e[a.role === 'origin' ? 'o' : 'i']++; byId.set(a.id, e); }
  ok([...byId.values()].every(e => e.o >= 1 && e.i >= 1), '모든 근육이 origin+insertion 보유(§19.1)');
  ok(muscles.items.every(it => it.oBone !== it.iBone), 'origin≠insertion 뼈');
  // §7.1: 팔(상완) 길이 ×1.3 → 부착점이 앵커 뼈와 1:1 이동(비율 변화에 부착 유지)
  const arm = rig.boneMap.get('leftforearm');
  if (arm) {
    const bic0 = att.filter(a => a.id === 'biceps.L');
    const o0 = bic0.find(a => a.role === 'origin'), i0 = bic0.find(a => a.role === 'insertion');
    const fbP0 = arm.getWorldPosition(new THREE.Vector3());
    const savedPos = arm.position.clone();
    arm.position.multiplyScalar(1.3);           // 상완 길이를 로컬 축 그대로 30% 늘림
    rig.obj.updateMatrixWorld(true);
    const boneDelta = arm.getWorldPosition(new THREE.Vector3()).distanceTo(fbP0);
    const bic1 = muscles.getAttachments().filter(a => a.id === 'biceps.L');
    const o1 = bic1.find(a => a.role === 'origin'), i1 = bic1.find(a => a.role === 'insertion');
    ok(o0 && i0 && Math.abs(i0.world.distanceTo(i1.world) - boneDelta) < 2e-3,
      `부착 불변: insertion 이 앵커 뼈와 1:1 이동 (Δ뼈=${boneDelta.toFixed(3)})`);
    ok(o0.world.distanceTo(o1.world) < 2e-3, '부착 불변: 반대쪽 origin 은 뼈 이동에 불변');
    arm.position.copy(savedPos);                // rest 복원 (이후 피부 굽기가 rest 를 봄)
    rig.obj.updateMatrixWorld(true);
  }

  // WP-02 · 관절 통과 → 포즈 반응 (§19.3 기능 검증): 팔꿈치 굴곡 시 이두 단축·굵어짐 ---
  const fore = rig.boneMap.get('leftforearm');
  const biceps = () => muscles.getBellies().find(x => x.id === 'biceps.L');
  if (fore && biceps()) {
    const b0 = biceps();
    const savedRot = fore.rotation.clone();
    fore.rotation.x += THREE.MathUtils.degToRad(120); // 팔꿈치 굴곡
    rig.obj.updateMatrixWorld(true);
    const b1 = biceps();
    ok(b1.len < b0.len * 0.9, `이두 굴곡 시 단축 ${b0.len.toFixed(3)}→${b1.len.toFixed(3)}m (§19.3)`);
    ok(b1.radius > b0.radius * 1.05, `이두 굴곡 시 굵어짐(부피 보존) ${b0.radius.toFixed(4)}→${b1.radius.toFixed(4)}m`);
    fore.rotation.copy(savedRot);               // rest 복원
    rig.obj.updateMatrixWorld(true);
  }

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

  // WP-09 · 조직 패킹(§9.8·§19.2 skin escape): 피부가 캡슐 union 표면을 감싸는가.
  //  가산 합이면 겹침부(몸통·관절)가 부풀어 정점이 멀리 뜬다(판때기). smooth-max union 은
  //  표면을 공유하므로 escape 가 작다. 정점별 최근접 캡슐 표면거리(dist−r)가 임계 초과면 escape.
  {
    const segD = (px, py, pz, a, b) => {
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const apx = px - a.x, apy = py - a.y, apz = pz - a.z;
      const L = abx * abx + aby * aby + abz * abz;
      let t = L > 1e-9 ? (apx * abx + apy * aby + apz * abz) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    const vp = g.attributes.position.array; let escaped = 0; const total = vp.length / 3;
    for (let i = 0; i < vp.length; i += 3) {
      let best = Infinity;
      for (const c of caps) { const d = segD(vp[i], vp[i + 1], vp[i + 2], c.a, c.b) - c.r; if (d < best) best = d; }
      if (best > 0.08) escaped++; // 캡슐 표면에서 8cm 이상 뜬 정점 = escape (fascia webbing 허용 초과)
    }
    ok(escaped / total < 0.02, `skin escape ${(100 * escaped / total).toFixed(1)}% <2% (§19.2 조직 패킹)`);
  }

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

  // WP-06 체형 프리셋 (§5.2 G2): 같은 골격에서 비만이 마른보다 피부가 두껍다 -----
  muscles.build(rig, { muscle: 0.8, fat: 0.0 });
  const leanG = bakeSkin(rig, muscles.getCapsules()).mesh.geometry;
  leanG.computeBoundingBox(); const lz = new THREE.Vector3(); leanG.boundingBox.getSize(lz);
  muscles.build(rig, { muscle: 1.0, fat: 0.07 });
  const fatG = bakeSkin(rig, muscles.getCapsules()).mesh.geometry;
  fatG.computeBoundingBox(); const fz = new THREE.Vector3(); fatG.boundingBox.getSize(fz);
  ok(fz.z > lz.z + 0.05, `체형: 비만 피부 전후 ${fz.z.toFixed(2)} > 마른 ${lz.z.toFixed(2)}m (G2)`);
  muscles.build(rig); // 기본 체형 복구
}

console.log(`\n${fails === 0 ? '✅ 전체 통과' : `❌ ${fails}개 실패`}`);
process.exit(fails === 0 ? 0 : 1);

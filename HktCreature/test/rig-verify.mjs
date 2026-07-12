// rig-verify.mjs — 브라우저 없이(Node) 코어를 구동해 목표를 검증한다.
//
// 흐름은 main.js 와 **같은 공유 코어**(creature.js + flesh.js)를 쓴다:
//  A. 기본 스켈레톤을 제대로 로드하는가 — X Bot/Y Bot FBX → 트윈 교차 리그에서 구동 뼈 선정.
//  B. 그 스켈레톤에 살을 붙였는가      — growFlesh 로 로드 뼈에 바인딩된 SkinnedMesh 생성.
//  C. Mixamo 를 리타깃해 구동하는가     — bakeClip 으로 걷기/뛰기 클립을 구동 뼈에 굽고 재생.
//  D. 실제로 변형되는가                — 재생 후 살 정점이 실제로 이동 + NaN 0.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { simpleName, boneBox, pickDrivers, makeBindCaches, buildSource, bakeClip, measureClipRootY } from '../src/creature.js';
import { growFlesh } from '../src/flesh.js';

globalThis.self = globalThis;
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

const HERE = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const section = t => console.log('\n' + t);

function loadFBX(rel) {
  const buf = readFileSync(join(HERE, '..', rel));
  return new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
}

// main.js makeCh 와 같은 순서로 크리처를 구성(공유 코어).
function makeCh(obj) {
  const meshes = [], bones = [];
  obj.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); if (o.isBone) bones.push(o); });
  const { drivers, boneMap } = pickDrivers(bones);
  for (const m of meshes) m.visible = false;
  obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  const ch = { obj, meshes, bones: drivers, boneMap, allBones: bones, ...makeBindCaches(drivers, bones) };
  // 접지(rest)
  const box = boneBox(drivers), c = new THREE.Vector3(); box.getCenter(c);
  obj.position.set(-c.x, -box.min.y, -c.z); obj.updateMatrixWorld(true);
  return ch;
}

// ── A. 기본 스켈레톤 로드 ─────────────────────────────────
section('A. 기본 스켈레톤을 제대로 로드 (X Bot / Y Bot)');
for (const [name, file] of [['X Bot', 'public/assets/character/X Bot.fbx'], ['Y Bot', 'public/assets/character/Y Bot.fbx']]) {
  const obj = loadFBX(file);
  const ch = makeCh(obj);
  const total = ch.allBones.length;
  ok(ch.bones.length >= 50 && ch.bones.length < total,
    `${name}: 전체 ${total}본 → 구동 뼈 ${ch.bones.length}개 선정(트윈 교차 처리)`);
  ok(ch.boneMap.has('hips') && ch.boneMap.has('lefthand') && ch.boneMap.has('rightfoot'),
    `${name}: 표준 부위(hips/lefthand/rightfoot) 매핑`);
  const box = boneBox(ch.bones);
  ok(Math.abs(box.min.y) < 1, `${name}: rest 접지 발바닥 y≈0 (min.y=${box.min.y.toFixed(2)})`);
}

// 이하 상세 검증은 X Bot 으로.
const obj = loadFBX('public/assets/character/X Bot.fbx');
const ch = makeCh(obj);
const scene = new THREE.Scene(); scene.add(obj);

// ── B. 로드한 스켈레톤에 살 붙이기 ────────────────────────
section('B. 로드한 스켈레톤에 절차 살(SkinnedMesh) 부착');
const flesh = growFlesh(ch.bones, simpleName);
scene.add(flesh); scene.updateMatrixWorld(true);
const pos = flesh.geometry.getAttribute('position');
ok(flesh.isSkinnedMesh && pos.count > 100, `SkinnedMesh 정점 ${pos.count}개`);
const sw = flesh.geometry.getAttribute('skinWeight'), si = flesh.geometry.getAttribute('skinIndex');
let wOk = true, iOk = true;
for (let v = 0; v < sw.count; v++) {
  if (Math.abs(sw.getX(v) + sw.getY(v) + sw.getZ(v) + sw.getW(v) - 1) > 1e-3) wOk = false;
  for (const c of ['X', 'Y', 'Z', 'W']) { const idx = si['get' + c](v); if (idx < 0 || idx >= ch.bones.length) iOk = false; }
}
ok(wOk, 'skinWeight 합 = 1 (정규화)');
ok(iOk, 'skinIndex 가 모두 유효한 로드 뼈를 가리킴');
ok(flesh.skeleton.bones[0] === ch.bones[0], '살이 로드한 스켈레톤 뼈에 직접 바인딩');
// rest 스키닝 유한
const skv = new THREE.Vector3(); let restFinite = true;
for (let v = 0; v < pos.count; v += 61) { skv.fromBufferAttribute(pos, v); flesh.applyBoneTransform(v, skv); if (![skv.x, skv.y, skv.z].every(Number.isFinite)) restFinite = false; }
ok(restFinite, 'rest 스키닝 정점 유한');

// ── C. Mixamo 리타깃 구동 ────────────────────────────────
section('C. Mixamo 클립을 리타깃(bakeClip)해 구동');
const rigNames = new Set(ch.bones.map(b => b.name));
for (const file of ['idle', 'walk', 'run']) {
  const anim = loadFBX(`public/assets/anim/${file}.fbx`);
  const clip = anim.animations.find(a => a.duration > 0.01);
  const src = buildSource(anim, clip);
  const baked = bakeClip(ch, src, file);
  ok(!!baked && baked.tracks.length > 20, `${file}: ${baked?.tracks.length ?? 0}개 트랙 구움`);
  const bad = baked.tracks.filter(t => !rigNames.has(t.name.split('.')[0]));
  ok(bad.length === 0, `${file}: 모든 트랙이 로드 뼈를 타깃 (미매칭 ${bad.length})`);
}

// ── D. 실제 구동 + 살 변형 ───────────────────────────────
section('D. 재생 → 살이 뼈를 따라 변형');
const walkAnim = loadFBX('public/assets/anim/walk.fbx');
const walkClip = walkAnim.animations.find(a => a.duration > 0.01);
const baked = bakeClip(ch, buildSource(walkAnim, walkClip), 'walk');
baked.__rootY = measureClipRootY(ch, baked);
ok(Number.isFinite(baked.__rootY), `접지 사전측정 root.y=${baked.__rootY.toFixed(1)}`);
const mixer = new THREE.AnimationMixer(obj);
mixer.clipAction(baked).play();
obj.position.y = baked.__rootY;
mixer.update(0); scene.updateMatrixWorld(true);
// 살 정점 위치(스키닝 후) 대기 vs 중반 비교
const sampleFlesh = () => {
  const p = new THREE.Vector3(), acc = new THREE.Vector3();
  for (let v = 0; v < pos.count; v += 31) { p.fromBufferAttribute(pos, v); flesh.applyBoneTransform(v, p); acc.add(p); }
  return acc;
};
const a0 = sampleFlesh();
for (let i = 0; i < 10; i++) mixer.update(walkClip.duration * 0.4 / 10);
scene.updateMatrixWorld(true);
const a1 = sampleFlesh();
ok(a1.distanceTo(a0) > 1, `걷기 재생으로 살 정점 이동 (Δ=${a1.distanceTo(a0).toFixed(1)})`);
let posedFinite = true, nanFree = true;
const pv = new THREE.Vector3();
for (let v = 0; v < pos.count; v += 61) { pv.fromBufferAttribute(pos, v); flesh.applyBoneTransform(v, pv); if (![pv.x, pv.y, pv.z].every(Number.isFinite)) posedFinite = false; }
for (const b of ch.bones) for (const e of b.matrixWorld.elements) if (!Number.isFinite(e)) nanFree = false;
ok(posedFinite && nanFree, '포즈 스키닝 정점·뼈 행렬 유한(NaN 없음)');

console.log('\n' + (fail === 0 ? '✅ 전체 통과 — 스켈레톤 로드 + 절차살 부착 + Mixamo 리타깃 구동 확인'
                                : `❌ ${fail}개 실패`));
process.exit(fail === 0 ? 0 : 1);

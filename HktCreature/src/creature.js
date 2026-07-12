// creature.js — 로드·구동뼈·리타깃의 순수 코어 (DOM/씬 비의존).
//
// main.js(브라우저 무대)와 test/rig-verify.mjs(Node 검증)가 **같은 코드**를 쓰도록
// HktCharacter 로더의 핵심 계산만 뽑아 모듈화한다. three 객체만 다룬다.

import * as THREE from 'three';

// 이름 정규화 — "mixamorig:Hips" / "mixamorigHips" / "Hips" → "hips".
export const simpleName = n => n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();

// 뼈 월드 위치 bbox(스케일/포즈 반영).
export function boneBox(bones) {
  const box = new THREE.Box3(), p = new THREE.Vector3();
  for (const b of bones) box.expandByPoint(b.getWorldPosition(p));
  return box;
}

// 구동 뼈 선정 — DFS 선순회에서 simpleName 별 첫 뼈(계층 등뼈) = 구동. 나머지 동명 뼈는
// __dup 로 개명(믹서 이름 충돌 제거). Mixamo with-skin 의 트윈 교차 리그를 이걸로 처리.
export function pickDrivers(bones) {
  const boneMap = new Map(), drivers = []; let dup = 0;
  for (const b of bones) {
    const sn = simpleName(b.name);
    if (!boneMap.has(sn)) { boneMap.set(sn, b); drivers.push(b); }
    else b.name = `${b.name}__dup${dup++}`;
  }
  return { drivers, boneMap };
}

// 바인드 캐시(로드 직후 rest) — bakeClip·flesh 재생성이 참조.
export function makeBindCaches(drivers, allBones) {
  const q = new THREE.Quaternion();
  const bindLocalQ = new Map(), bindLocalP = new Map();
  for (const b of allBones) { bindLocalQ.set(b, b.quaternion.clone()); bindLocalP.set(b, b.position.clone()); }
  const bindWorldQ = new Map(drivers.map(b => [b, b.getWorldQuaternion(q).clone()]));
  const staticParentQ = new Map();
  for (const b of allBones) { const p = b.parent; if (p && !p.isBone && !staticParentQ.has(p)) staticParentQ.set(p, p.getWorldQuaternion(q).clone()); }
  return { bindLocalQ, bindLocalP, bindWorldQ, staticParentQ };
}

// 애니메이션 소스(클립+뼈 바인드 월드 회전) 구성.
export function buildSource(obj, clip) {
  const sBones = []; obj.traverse(o => { if (o.isBone) sBones.push(o); });
  if (!sBones.length || !clip) return null;
  obj.updateMatrixWorld(true);
  const bySName = new Map(), bindWorldQ = new Map(), q = new THREE.Quaternion();
  for (const b of sBones) { const sn = simpleName(b.name); if (!bySName.has(sn)) { bySName.set(sn, b); bindWorldQ.set(sn, b.getWorldQuaternion(q).clone()); } }
  const hipsB = bySName.get('hips');
  const hipsBindY = hipsB ? hipsB.getWorldPosition(new THREE.Vector3()).y : 0;
  return { obj, clip, bySName, bindWorldQ, hipsBindY };
}

// source 클립을 구동 뼈에 월드 공간 리타깃해 새 클립을 굽는다(타깃 뼈 불변 = 오염 없음).
// 위치 트랙은 hips 수직(y)만. ch = { obj, boneMap, allBones, bindLocalQ, bindLocalP, bindWorldQ, staticParentQ }.
export function bakeClip(ch, src, label, fps = 30) {
  if (!src) return null;
  const dur = src.clip.duration;
  const frames = Math.max(2, Math.round(dur * fps) + 1);
  const matched = new Map();
  for (const [sn, b] of ch.boneMap) {
    const sBone = src.bySName.get(sn); if (!sBone) continue;
    matched.set(b, { sBone, corr: src.bindWorldQ.get(sn).clone().invert().multiply(ch.bindWorldQ.get(b)) });
  }
  if (!matched.size) return null;
  const hips = ch.boneMap.get('hips'), hm = hips && matched.get(hips);
  let hp = null;
  if (hm && src.hipsBindY > 1e-6) {
    ch.obj.updateMatrixWorld(true);
    const pm = hips.parent.matrixWorld.clone();
    const bindWorld = ch.bindLocalP.get(hips).clone().applyMatrix4(pm);
    hp = { sBone: hm.sBone, pmInv: pm.invert(), bindWorld, hScale: bindWorld.y / src.hipsBindY, values: new Float32Array(frames * 3) };
  }
  const mixer = new THREE.AnimationMixer(src.obj);
  mixer.clipAction(src.clip).play();
  const times = new Float32Array(frames);
  const values = new Map([...matched.keys()].map(b => [b, new Float32Array(frames * 4)]));
  const worldQ = new Map(ch.allBones.map(b => [b, new THREE.Quaternion()]));
  const sw = new THREE.Quaternion(), wq = new THREE.Quaternion(), inv = new THREE.Quaternion(), idQ = new THREE.Quaternion();
  const sv = new THREE.Vector3(), tv = new THREE.Vector3();
  for (let f = 0; f < frames; f++) {
    const t = Math.min(dur, f / fps); times[f] = t;
    mixer.setTime(t); src.obj.updateMatrixWorld(true);
    if (hp) {
      const dy = (hp.sBone.getWorldPosition(sv).y - src.hipsBindY) * hp.hScale;
      tv.copy(hp.bindWorld); tv.y += dy; tv.applyMatrix4(hp.pmInv);
      hp.values.set([tv.x, tv.y, tv.z], f * 3);
    }
    for (const b of ch.allBones) {
      const pw = b.parent?.isBone ? worldQ.get(b.parent) : (ch.staticParentQ.get(b.parent) || idQ);
      const out = worldQ.get(b), m = matched.get(b);
      if (m) { m.sBone.getWorldQuaternion(sw); wq.copy(sw).multiply(m.corr); const lq = inv.copy(pw).invert().multiply(wq); values.get(b).set([lq.x, lq.y, lq.z, lq.w], f * 4); out.copy(wq); }
      else out.copy(pw).multiply(ch.bindLocalQ.get(b));
    }
  }
  const tracks = [];
  for (const [b] of matched) tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values.get(b)));
  if (hp) tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, times, hp.values));
  return new THREE.AnimationClip(label, dur, tracks);
}

// 클립별 접지 root.y 사전 측정(재생 전 1회 — 재생 중 재측정 금지).
export function measureClipRootY(ch, clip, samples = 12) {
  const saved = ch.allBones.map(b => [b, b.quaternion.clone(), b.position.clone()]);
  const savedY = ch.obj.position.y; ch.obj.position.y = 0;
  const mixer = new THREE.AnimationMixer(ch.obj); mixer.clipAction(clip).play();
  let minY = Infinity;
  for (let i = 0; i <= samples; i++) { mixer.setTime(clip.duration * i / samples); ch.obj.updateMatrixWorld(true); minY = Math.min(minY, boneBox(ch.bones).min.y); }
  mixer.stopAllAction(); mixer.uncacheRoot(ch.obj);
  for (const [b, q, p] of saved) { b.quaternion.copy(q); b.position.copy(p); }
  ch.obj.position.y = savedY; ch.obj.updateMatrixWorld(true);
  return -minY;
}

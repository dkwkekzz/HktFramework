// ============================================================================
//  retarget.js — 애니메이션 구동
//
//  Mixamo 클립(별도 FBX)을 우리 리그의 구동 뼈에 **순수 월드 공간 계산**으로
//  리타깃해 굽는다. 타깃 뼈 상태를 읽지도 쓰지도 않는다(외부 유틸의 상태 오염이
//  과거 붕괴의 원인이었다 — 자체 구현으로 회피). 리타깃된 클립이 뼈를 움직이면
//  근육(라이브)과 피부(스키닝)가 함께 따라온다.
//
//  원리: 원하는 타깃 월드 회전 = srcWorld(t) × corr,
//        corr = srcBindWorld⁻¹ × tgtBindWorld.
//  이를 프레임마다 실제 부모 월드 회전 기준 로컬로 변환해 쿼터니언 트랙으로.
// ============================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { simpleName, boneBox } from './skeleton.js';

// 애니메이션 FBX → 소스(뼈 계층 + 바인드 월드 회전 + hips 바인드 위치).
export function buildSource(obj, clip) {
  const sBones = [];
  obj.traverse(o => { if (o.isBone) sBones.push(o); });
  if (!sBones.length || !clip) return null;
  obj.updateMatrixWorld(true);
  const bySName = new Map(), bindWorldQ = new Map();
  const q = new THREE.Quaternion();
  for (const b of sBones) {
    const sn = simpleName(b.name);
    if (!bySName.has(sn)) { bySName.set(sn, b); bindWorldQ.set(sn, b.getWorldQuaternion(q).clone()); }
  }
  const hipsB = bySName.get('hips');
  const hipsBindP = hipsB ? hipsB.getWorldPosition(new THREE.Vector3()).clone() : null;
  return { obj, clip, bySName, bindWorldQ, hipsBindP };
}

export function parseClipFBX(buf) {
  const obj = new FBXLoader().parse(buf, '');
  const clip = (obj.animations || []).find(a => a.duration > 0.01) || obj.animations?.[0];
  return clip ? buildSource(obj, clip) : null;
}

// 소스 클립을 rig 의 구동 뼈에 리타깃한 새 AnimationClip 을 굽는다.
export function bakeClip(rig, src, label, fps = 30) {
  if (!src) return null;
  const dur = src.clip.duration;
  const frames = Math.max(2, Math.round(dur * fps) + 1);
  const matched = new Map(); // 구동 뼈 → { sBone, corr }
  for (const [sn, b] of rig.boneMap) {
    const sBone = src.bySName.get(sn);
    if (!sBone) continue;
    matched.set(b, { sBone, corr: src.bindWorldQ.get(sn).clone().invert().multiply(rig.bindWorldQ.get(b)) });
  }
  if (!matched.size) return null;

  // hips 이동(x/y/z) 리타깃 — 소스 hips 월드 변위를 키 비율로 스케일. 제자리 재생
  // 유지 위해 x/z 선형 순이동(detrend) 제거. hips 부모는 정적 노드라 1회 캐시.
  const hips = rig.boneMap.get('hips');
  const hm = hips && matched.get(hips);
  let hp = null;
  if (hm && src.hipsBindP && src.hipsBindP.y > 1e-6) {
    rig.obj.updateMatrixWorld(true);
    const pm = hips.parent.matrixWorld.clone();
    const bindWorld = rig.bindLocalP.get(hips).clone().applyMatrix4(pm);
    hp = {
      sBone: hm.sBone, pmInv: pm.invert(), bindWorld,
      hScale: bindWorld.y / src.hipsBindP.y,
      values: new Float32Array(frames * 3), net: new THREE.Vector3(),
    };
  }

  const mixer = new THREE.AnimationMixer(src.obj);
  mixer.clipAction(src.clip).play();
  const times = new Float32Array(frames);
  const values = new Map([...matched.keys()].map(b => [b, new Float32Array(frames * 4)]));
  const worldQ = new Map(rig.all.map(b => [b, new THREE.Quaternion()]));
  const sw = new THREE.Quaternion(), wq = new THREE.Quaternion(), inv = new THREE.Quaternion();
  const idQ = new THREE.Quaternion();
  const sv = new THREE.Vector3();

  if (hp) { // 순이동 측정 (마지막-첫 프레임)
    mixer.setTime(0); src.obj.updateMatrixWorld(true);
    hp.net.copy(hp.sBone.getWorldPosition(sv));
    mixer.setTime(dur); src.obj.updateMatrixWorld(true);
    hp.net.subVectors(hp.sBone.getWorldPosition(sv), hp.net);
  }
  const tv = new THREE.Vector3();
  for (let f = 0; f < frames; f++) {
    const t = Math.min(dur, f / fps);
    times[f] = t;
    mixer.setTime(t);
    src.obj.updateMatrixWorld(true);
    if (hp) {
      hp.sBone.getWorldPosition(sv).sub(src.hipsBindP);
      const k = dur > 1e-6 ? t / dur : 0;
      sv.x -= hp.net.x * k; sv.z -= hp.net.z * k;
      tv.copy(hp.bindWorld).addScaledVector(sv, hp.hScale).applyMatrix4(hp.pmInv);
      hp.values.set([tv.x, tv.y, tv.z], f * 3);
    }
    for (const b of rig.all) { // DFS 선순회 → 부모 worldQ 먼저
      const pw = b.parent?.isBone ? worldQ.get(b.parent)
        : (rig.staticParentQ.get(b.parent) || idQ);
      const out = worldQ.get(b);
      const m = matched.get(b);
      if (m) {
        m.sBone.getWorldQuaternion(sw);
        wq.copy(sw).multiply(m.corr);
        const lq = inv.copy(pw).invert().multiply(wq);
        values.get(b).set([lq.x, lq.y, lq.z, lq.w], f * 4);
        out.copy(wq);
      } else {
        out.copy(pw).multiply(rig.bindLocalQ.get(b));
      }
    }
  }
  const tracks = [];
  for (const [b] of matched)
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values.get(b)));
  if (hp) tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, times, hp.values));
  return new THREE.AnimationClip(label, dur, tracks);
}

// 클립 전체에서 발이 바닥(y=0)에 닿는 root.y 를 사전 측정 (재생 중 재측정 금지).
export function measureGroundY(rig, clip, samples = 12) {
  const saved = rig.all.map(b => [b, b.quaternion.clone(), b.position.clone()]);
  const savedY = rig.obj.position.y;
  rig.obj.position.y = 0;
  const mixer = new THREE.AnimationMixer(rig.obj);
  mixer.clipAction(clip).play();
  let minY = Infinity;
  for (let i = 0; i <= samples; i++) {
    mixer.setTime(clip.duration * i / samples);
    rig.obj.updateMatrixWorld(true);
    minY = Math.min(minY, boneBox(rig).min.y);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(rig.obj);
  for (const [b, q, p] of saved) { b.quaternion.copy(q); b.position.copy(p); }
  rig.obj.position.y = savedY;
  rig.obj.updateMatrixWorld(true);
  return -minY;
}

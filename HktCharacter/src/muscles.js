// ============================================================================
//  muscles.js — 2단계: 근육
//
//  뼈를 "뼈"로 보고, 실제 사람처럼 그 위에 근육을 붙인다. 각 근육은 두 뼈 사이의
//  방추형(fusiform) 벨리 — 방향은 뼈 축을 따르고, 수축(양 끝이 가까워짐)하면
//  부피 보존처럼 굵어진다(bulge). 이 라이브 레이어는 매 프레임 뼈 월드 위치에서
//  다시 계산되므로 애니메이션에 따라 근육이 늘고 부푼다.
//
//  같은 벨리 세그먼트(중심선 + 반지름)를 skin.js 에 넘겨 피부 필드로 쓴다 —
//  즉 "근육 위에 피부를 씌운다"가 한 소스에서 나온다. (구현 접근은 implicit
//  muscle / implicit skinning 연구 계열: 중심축 위의 볼륨 프리미티브 + 부피 보존.)
// ============================================================================
import * as THREE from 'three';
import { simpleName } from './skeleton.js';
import { MUSCLES, BONE_PADDING, FACING } from './anatomy.js';

const ANT = new THREE.Vector3(0, 0, FACING); // 전면 월드 방향
const UPX = new THREE.Vector3(1, 0, 0);
const ZQ = new THREE.Vector3(0, 0, 1);       // 스핀들 로컬 장축

// 근육 벨리의 기하: from/to 뼈 위치에서 축·전면·측면 프레임을 세우고 벨리 중심·
// 반길이·수축 배율을 낸다. 재사용 임시 벡터.
const _from = new THREE.Vector3(), _to = new THREE.Vector3(), _axis = new THREE.Vector3();
const _ant = new THREE.Vector3(), _lat = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

function belly(item, rest) {
  const { def, fromB, toB } = item;
  fromB.getWorldPosition(_from);
  toB.getWorldPosition(_to);
  _axis.subVectors(_to, _from);
  const len = _axis.length() || 1e-4;
  _axis.multiplyScalar(1 / len);
  // 전면 = ANT 를 축에 수직 투영 (축이 ANT 와 평행하면 X 로 폴백)
  _ant.copy(ANT).addScaledVector(_axis, -_axis.dot(ANT));
  if (_ant.lengthSq() < 1e-6) _ant.copy(UPX).addScaledVector(_axis, -_axis.dot(UPX));
  _ant.normalize();
  _lat.crossVectors(_axis, _ant).normalize(); // 좌우 자동 대칭(축 방향이 뒤집힘)
  // 벨리 중심 = 두 뼈 보간(along) + 전/후·측면 오프셋
  _c.copy(_from).addScaledVector(_axis, len * (0.5 + def.along) )
    .addScaledVector(_ant, def.off.a).addScaledVector(_lat, def.off.l);
  const half = 0.5 * len * def.span;
  const contraction = rest ? THREE.MathUtils.clamp(rest / len, 0.7, 1.4) : 1;
  const radius = def.r * (1 + def.bulge * (contraction - 1));
  return { center: _c, axis: _axis, half, radius };
}

export class MuscleLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = 1;
    scene.add(this.group);
    this.geo = new THREE.SphereGeometry(1, 18, 12); // 스케일해 방추형으로
    this.items = [];
    this.restLen = new Map();
    this.rig = null;
  }

  build(rig) {
    this.clear();
    this.rig = rig;
    for (const def of MUSCLES) {
      const fromB = rig.boneMap.get(def.from);
      const toB = rig.boneMap.get(def.to);
      if (!fromB || !toB) continue; // 리그에 없는 뼈면 건너뜀
      const mat = new THREE.MeshStandardMaterial({
        color: def.side === 'C' ? 0xb23a3a : 0xbf4640,
        roughness: 0.62, metalness: 0.0,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      const item = { def, fromB, toB, mesh };
      // rest 길이 캐시 (수축 기준)
      const b = belly(item, null);
      this.restLen.set(item, _from.distanceTo(_to));
      this.items.push(item);
    }
    this.update();
  }

  update() {
    for (const item of this.items) {
      const b = belly(item, this.restLen.get(item));
      _q.setFromUnitVectors(ZQ, b.axis);
      _s.set(b.radius, b.radius, Math.max(b.half, b.radius)); // 장축 z, 방추형
      _m.compose(b.center, _q, _s);
      item.mesh.matrix.copy(_m);
    }
  }

  // 피부 필드용 캡슐 목록: 근육 벨리 + 뼈 패딩(살 얇은 부위 채움).
  // 각 항목 { a, b, r } — 월드 좌표 세그먼트 + 반지름. rest 포즈에서 1회 호출.
  getCapsules() {
    const caps = [];
    for (const item of this.items) {
      const bb = belly(item, this.restLen.get(item));
      const a = bb.center.clone().addScaledVector(bb.axis, -bb.half);
      const b = bb.center.clone().addScaledVector(bb.axis, bb.half);
      caps.push({ a, b, r: bb.radius });
    }
    // 뼈 패딩 — 각 구동 뼈에서 자식 구동 뼈까지 얇은 캡슐
    const wp = new THREE.Vector3(), wc = new THREE.Vector3();
    for (const bone of this.rig.drivers) {
      const sn = simpleName(bone.name);
      const pad = BONE_PADDING.find(p => p.re.test(sn));
      if (!pad) continue;
      bone.getWorldPosition(wp);
      const kids = bone.children.filter(k => k.isBone);
      if (kids.length) {
        for (const k of kids) {
          k.getWorldPosition(wc);
          caps.push({ a: wp.clone(), b: wc.clone(), r: pad.r });
        }
      } else {
        caps.push({ a: wp.clone(), b: wp.clone(), r: pad.r });
      }
    }
    return caps;
  }

  setVisible(v) { this.group.visible = v; }

  clear() {
    for (const item of this.items) {
      this.group.remove(item.mesh);
      item.mesh.material.dispose();
    }
    this.items = [];
    this.restLen.clear();
  }

  dispose() {
    this.clear();
    this.geo.dispose();
    this.group.parent?.remove(this.group);
  }
}

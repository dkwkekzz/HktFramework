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
import { MUSCLES, BONE_PADDING, FACING, patchRadius, DEFAULT_FUSIFORM } from './anatomy.js';

const ANT = new THREE.Vector3(0, 0, FACING); // 전면 월드 방향
const UPX = new THREE.Vector3(1, 0, 0);
const YQ = new THREE.Vector3(0, 1, 0);       // 스핀들 로컬 장축(LatheGeometry 회전축)
const SKIN_CAPS = 4;                          // 피부 필드용 근육당 서브 캡슐 수(프로필 따라 가늘어짐)

// 프로필(기시→정지 반지름 배율) 을 위치 s∈[0,1] 에서 선형 보간.
function sampleProfile(radii, s) {
  const n = radii.length;
  const x = THREE.MathUtils.clamp(s, 0, 1) * (n - 1);
  const i = Math.floor(x), f = x - i;
  return i >= n - 1 ? radii[n - 1] : radii[i] * (1 - f) + radii[i + 1] * f;
}
// 아키텍처별 기본 형상(설계서 §8): w=측면 폭 배율, d=전후 깊이 배율(<1 이면 납작),
// profile=기시→정지 반지름 배율. Fusiform=가는 방추, Fan=부채꼴(기시 넓고 납작),
// Sheet=판(넓고 납작·고른 폭). 근육이 def.w/d/profile 로 개별 override 가능.
const FAN_PROFILE = [1.0, 0.98, 0.9, 0.78, 0.6, 0.4, 0.16];   // 기시 넓음 → 정지 좁음
const SHEET_PROFILE = [0.45, 0.8, 1.0, 1.0, 1.0, 0.8, 0.45];  // 넓고 고른 판
const ARCH = {
  Fusiform: { w: 1.0, d: 0.9, profile: DEFAULT_FUSIFORM },
  Fan: { w: 1.6, d: 0.42, profile: FAN_PROFILE },
  Sheet: { w: 1.4, d: 0.4, profile: SHEET_PROFILE },
};
const archOf = def => ARCH[def.architecture] || ARCH.Fusiform;
const profileRadii = def => def.profile || archOf(def).profile;
// 근육 단면 배율 {w,d} — 아키텍처 기본 + 근육별 override.
const shapeOf = def => ({ w: def.w ?? archOf(def).w, d: def.d ?? archOf(def).d });

// 프로필을 중심선(로컬 y∈[-1,1]) 위로 스웹한 방추형 lathe 지오메트리. 양끝은 얇은 팁으로
// 닫아 힘줄처럼 가늘게 마무리한다. 단면은 원형(반지름=프로필). 근육마다 1회 생성.
function makeSpindleGeo(radii) {
  const N = 24, pts = [];
  pts.push(new THREE.Vector2(1e-3, -1.05)); // 아래 팁(닫힘)
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    pts.push(new THREE.Vector2(Math.max(sampleProfile(radii, s), 1e-3), (s - 0.5) * 2));
  }
  pts.push(new THREE.Vector2(1e-3, 1.05));  // 위 팁(닫힘)
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.computeVertexNormals();
  return geo;
}

// 근육 벨리의 기하: from/to 뼈 위치에서 축·전면·측면 프레임을 세우고 벨리 중심·
// 반길이·수축 배율을 낸다. 재사용 임시 벡터.
const _from = new THREE.Vector3(), _to = new THREE.Vector3(), _axis = new THREE.Vector3();
const _ant = new THREE.Vector3(), _lat = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
const _tmp = new THREE.Vector3();

// 부착 패치의 "축 기저점"(perp 오프셋 전) 을 월드로 해석한다.
//  = 앵커 뼈 원점 + t·(자식 뼈 원점 − 앵커 원점). t=0 이면 관절 피벗 그대로.
//  t>0 이면 원위 뼈를 따라 내려가 근육이 관절을 넘어간다(포즈 반응의 핵심).
function attachBase(patch, out) {
  patch.bone.getWorldPosition(out);
  if (patch.t && patch.child) { patch.child.getWorldPosition(_tmp); out.lerp(_tmp, patch.t); }
  return out;
}

// 벨리 프레임(축·전면·측면)을 origin/insertion 축 기저점에서 세운다. _from/_to 를
// 채우고 _axis/_ant/_lat 을 남긴다 — belly() 와 getAttachments() 가 공유.
function frame(oPatch, iPatch) {
  attachBase(oPatch, _from);
  attachBase(iPatch, _to);
  _axis.subVectors(_to, _from);
  const len = _axis.length() || 1e-4;
  _axis.multiplyScalar(1 / len);
  // 전면 = ANT 를 축에 수직 투영 (축이 ANT 와 평행하면 X 로 폴백)
  _ant.copy(ANT).addScaledVector(_axis, -_axis.dot(ANT));
  if (_ant.lengthSq() < 1e-6) _ant.copy(UPX).addScaledVector(_axis, -_axis.dot(UPX));
  _ant.normalize();
  _lat.crossVectors(_axis, _ant).normalize(); // 좌우 자동 대칭(축 방향이 뒤집힘)
  return len;
}

function belly(item, rest) {
  const { def, oPatch, iPatch } = item;
  const len = frame(oPatch, iPatch);
  // 부착 오프셋을 origin/insertion 각각 프레임에서 적용. 벨리 중심 = 부착 중점 + along.
  const o = oPatch.off, ins = iPatch.off;
  _c.copy(_from).add(_to).multiplyScalar(0.5)
    .addScaledVector(_ant, 0.5 * (o.a + ins.a))
    .addScaledVector(_lat, 0.5 * (o.l + ins.l))
    .addScaledVector(_axis, len * def.along);
  const half = 0.5 * len * def.span;
  // 수축비 = rest 길이 / 현재 길이. 관절을 넘는 근육은 굴곡 시 len 이 줄어 >1 → 굵어짐.
  const contraction = rest ? THREE.MathUtils.clamp(rest / len, 0.7, 1.4) : 1;
  const radius = def.r * (1 + def.bulge * (contraction - 1));
  return { center: _c, axis: _axis, half, radius };
}

export class MuscleLayer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = 1;
    scene.add(this.group);
    this.items = [];       // 각 근육은 자기 방추형 지오메트리를 가진다(프로필 스웹)
    this.restLen = new Map();
    this.rig = null;
  }

  build(rig) {
    this.clear();
    this.rig = rig;
    for (const def of MUSCLES) {
      // 부착 패치를 뼈로 해석. 주(primary) origin/insertion 이 리그에 없으면 건너뜀.
      const oBone = rig.boneMap.get(def.origins[0].bone);
      const iBone = rig.boneMap.get(def.insertions[0].bone);
      if (!oBone || !iBone) continue;
      // 패치를 뼈로 해석. child = 앵커 뼈의 첫 자식 뼈(원위 방향, t 오프셋 기준).
      const resolve = (list) => list
        .map(p => {
          const bone = rig.boneMap.get(p.bone);
          if (!bone) return null;
          // 원위 방향 자식 = 구동 뼈여야 한다. 트윈 중복 뼈(__dup, 같은 위치)는
          // t 오프셋을 삼켜버리므로 제외 — simpleName 이 자기 자신으로 매핑되는 자식만.
          const child = bone.children.find(
            k => k.isBone && rig.boneMap.get(simpleName(k.name)) === k) || null;
          return { bone, child, off: p.off, t: p.t || 0, role: p.role };
        })
        .filter(Boolean); // 리그에 없는 부차 패치는 제외
      const oPatches = resolve(def.origins);
      const iPatches = resolve(def.insertions);
      const mat = new THREE.MeshStandardMaterial({
        color: def.side === 'C' ? 0xb23a3a : 0xbf4640,
        roughness: 0.62, metalness: 0.0,
      });
      const mesh = new THREE.Mesh(makeSpindleGeo(profileRadii(def)), mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      const item = { def, oBone, iBone, oPatches, iPatches, oPatch: oPatches[0], iPatch: iPatches[0], mesh, shape: shapeOf(def) };
      // rest 길이 캐시 (수축 기준) — belly() 가 _from/_to 를 축 기저점으로 채운다
      belly(item, null);
      this.restLen.set(item, _from.distanceTo(_to));
      this.items.push(item);
    }
    this.update();
  }

  // 부착점 목록: 각 근육의 origin/insertion 패치를 현재 포즈에서 월드로 해석한다.
  // 설계서 §7.1·§9.5 — 부착은 뼈 원점 + 벨리 프레임 오프셋(뼈 로컬)으로 정의되므로
  // 뼈 길이·비율이 바뀌어도 |world − pivot| = hypot(off.a, off.l) 가 불변이다.
  // WP-02(경로 솔버)·검증(§19.1)이 소비. rest·포즈 어느 시점에서도 호출 가능.
  getAttachments() {
    const out = [];
    const base = new THREE.Vector3(), pivot = new THREE.Vector3();
    for (const item of this.items) {
      frame(item.oPatch, item.iPatch); // _ant/_lat 갱신 (벨리와 동일 프레임)
      const r = patchRadius(item.def);
      for (const p of [...item.oPatches, ...item.iPatches]) {
        attachBase(p, base);                       // 축 기저점(t 반영)
        p.bone.getWorldPosition(pivot);            // 앵커 뼈 피벗
        const world = base.clone().addScaledVector(_ant, p.off.a).addScaledVector(_lat, p.off.l);
        out.push({
          id: item.def.id, role: p.role, bone: simpleName(p.bone.name),
          pivot: pivot.clone(), world, r,
        });
      }
    }
    return out;
  }

  // 근육별 벨리 요약(현재 포즈): { id, len(=2×half), radius(피크), center, axis }.
  // 검증(§19.3)·후속 WP 가 근육 상태를 읽는 공개 API — getCapsules 는 피부용 다중 캡슐
  // 이라 근육 단위 측정에는 이걸 쓴다.
  getBellies() {
    return this.items.map(item => {
      const b = belly(item, this.restLen.get(item));
      return { id: item.def.id, len: 2 * b.half, radius: b.radius, center: b.center.clone(), axis: b.axis.clone() };
    });
  }

  update() {
    for (const item of this.items) {
      const b = belly(item, this.restLen.get(item)); // _lat/_axis/_ant 프레임을 남긴다
      const sh = item.shape;
      // 롤 고정 기저: 로컬 x→lat(측면), y→axis(장축), z→ant(전후). 이래야 w(폭)·d(깊이)
      // 비등방 스케일이 해부학 방향과 일치한다(넓적한 근육이 전후로 눌린다).
      _m.makeBasis(_lat, b.axis, _ant);
      _m.scale(_s.set(b.radius * sh.w, b.half, b.radius * sh.d));
      _m.setPosition(b.center);
      item.mesh.matrix.copy(_m);
    }
  }

  // 피부 필드용 캡슐 목록: 근육 벨리 + 뼈 패딩(살 얇은 부위 채움).
  // 각 항목 { a, b, r } — 월드 좌표 세그먼트 + 반지름. rest 포즈에서 1회 호출.
  getCapsules() {
    const caps = [];
    for (const item of this.items) {
      const bb = belly(item, this.restLen.get(item));
      const radii = profileRadii(item.def);
      // 벨리를 축 방향으로 SKIN_CAPS 개 서브 캡슐로 나눠, 각 구간 반지름을 프로필로
      // 준다 — 피부가 근육의 방추형 테이퍼(가는 힘줄 끝)를 따라간다. 얇은 끝도 최소치는
      // 남겨 인접 근육/뼈와 피부 필드가 끊기지 않게 한다.
      // 피부 필드는 원형 캡슐만 지원하므로, 납작한 근육(w≠d)은 면적 보존 유효 반지름
      // (√(w·d))으로 근사한다 — 넓적한 판이 과도하게 둥글게 부풀지 않게. (진짜 납작한
      // 피부 단면은 skin.js 의 타원 프리미티브가 필요 → 후속.)
      const eff = Math.sqrt(item.shape.w * item.shape.d);
      for (let k = 0; k < SKIN_CAPS; k++) {
        const s0 = k / SKIN_CAPS, s1 = (k + 1) / SKIN_CAPS;
        const a = bb.center.clone().addScaledVector(bb.axis, bb.half * (2 * s0 - 1));
        const b = bb.center.clone().addScaledVector(bb.axis, bb.half * (2 * s1 - 1));
        const r = bb.radius * eff * Math.max(sampleProfile(radii, (s0 + s1) / 2), 0.4);
        caps.push({ a, b, r });
      }
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
      item.mesh.geometry.dispose();   // 근육마다 고유 방추형 지오메트리
      item.mesh.material.dispose();
    }
    this.items = [];
    this.restLen.clear();
  }

  dispose() {
    this.clear();
    this.group.parent?.remove(this.group);
  }
}

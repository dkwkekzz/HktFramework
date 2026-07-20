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
//  side: 근육의 좌우('L'/'R'/'C'). 측면 축 _lat 의 좌우 정합에 쓴다.
function frame(oPatch, iPatch, side) {
  attachBase(oPatch, _from);
  attachBase(iPatch, _to);
  _axis.subVectors(_to, _from);
  const len = _axis.length() || 1e-4;
  _axis.multiplyScalar(1 / len);
  // 전면 = ANT 를 축에 수직 투영 (축이 ANT 와 평행하면 X 로 폴백)
  _ant.copy(ANT).addScaledVector(_axis, -_axis.dot(ANT));
  if (_ant.lengthSq() < 1e-6) _ant.copy(UPX).addScaledVector(_axis, -_axis.dot(UPX));
  _ant.normalize();
  _lat.crossVectors(_axis, _ant).normalize();
  // 좌우 대칭 교정: 뼈가 완벽 대칭이면 cross(axis,ant) 는 우측에서 미러의 '음수'로 나온다
  //  (lat_R = −M·lat_L, M=x-미러) → 측면 오프셋 l 이 좌우 반대로 적용돼 2l 만큼 어긋났다.
  //  우측 lat 을 뒤집어 진짜 미러(lat_R = M·lat_L)로 만든다. side 로 판정(중심선 뼈 부착
  //  근육도 side 는 L/R 이라 견고). 단방향 뼈→근육 유지.
  if (side === 'R') _lat.negate();
  return len;
}

// 근육 중심 경로(설계서 §6 Route Solver): 기본은 from→to 직선. wrap 이 있으면 관절 표면을
//  우회하는 via 점을 넣어 from→via→to 로 뼈를 피한다(§6·§7.5 — 관통 방지·길항 신장). frame()
//  이 _from/_to/_ant/_lat/_axis 를 세팅하므로 호출 전제. 반환 { pts:[from,(via),to], len }.
const _via = new THREE.Vector3(), _off = new THREE.Vector3(), _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
const _cp = new THREE.Vector3(), _ab = new THREE.Vector3(), _wn = new THREE.Vector3();
// 세그먼트 a-b 에서 점 p 최근접점.
function closestOnSeg(a, b, p, out) {
  _ab.subVectors(b, a); const L = _ab.lengthSq();
  let t = L > 1e-9 ? _ab.dot(_cp.subVectors(p, a)) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return out.copy(a).addScaledVector(_ab, t);
}
function computePath(item) {
  const { def, oPatch, iPatch } = item;
  frame(oPatch, iPatch, def.side);
  const pts = [_from.clone(), _to.clone()];
  if (def.wrap && item.wrapBone) {
    // 조건부 wrap(§6): 직선 from→to 가 관절 wrap 구를 관통할 때만 표면으로 우회하는 via 를
    //  넣는다. 안 하면 직선 유지(이두 chord 단축 보존). via 를 항상 관절 피벗에 두면 정지부가
    //  그 피벗을 중심으로 회전해 경로 길이가 포즈 불변이 되는 함정을 피한다.
    item.wrapBone.getWorldPosition(_via);                 // wrap 중심(관절)
    const R = def.wrap.clearance + def.r * (item.muscleScale || 1);
    closestOnSeg(_from, _to, _via, _cp);                  // 세그먼트의 관절 최근접점
    if (_cp.distanceTo(_via) < R) {                       // 관통 → 표면으로 밀어낸 via
      _wn.subVectors(_cp, _via);                          // 관절→최근접 방향(밀어낼 면)
      if (_wn.lengthSq() < 1e-8) _wn.copy(_ant).multiplyScalar(def.wrap.face === 'post' ? -1 : 1);
      _wn.normalize();
      pts.splice(1, 0, _via.clone().addScaledVector(_wn, R));
    }
  }
  let len = 0; for (let i = 0; i < pts.length - 1; i++) len += pts[i].distanceTo(pts[i + 1]);
  return { pts, len };
}
// 폴리라인에서 호 길이 분율 f∈[0,1] 지점.
function pointAtArc(pts, f, out) {
  let total = 0; for (let i = 0; i < pts.length - 1; i++) total += pts[i].distanceTo(pts[i + 1]);
  const target = THREE.MathUtils.clamp(f, 0, 1) * total;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = pts[i].distanceTo(pts[i + 1]);
    if (acc + seg >= target) return out.copy(pts[i]).lerp(pts[i + 1], (target - acc) / (seg || 1));
    acc += seg;
  }
  return out.copy(pts[pts.length - 1]);
}

// 관절 굴곡각(rad, 0=폄): 관절 뼈의 부모→관절 방향과 관절→자식 방향 사이 각. rest(T-포즈
//  펴짐)에서 ~0, 굴곡할수록 커진다. 기능 근육(§10.1)의 길이를 관절각에 잇는 데 쓴다.
const _jp = new THREE.Vector3(), _jc = new THREE.Vector3(), _jj = new THREE.Vector3();
const _jv1 = new THREE.Vector3(), _jv2 = new THREE.Vector3();
function jointFlexion(ji) {
  ji.parent.getWorldPosition(_jp); ji.bone.getWorldPosition(_jj); ji.child.getWorldPosition(_jc);
  _jv1.subVectors(_jj, _jp); _jv2.subVectors(_jc, _jj);
  const l1 = _jv1.length(), l2 = _jv2.length();
  if (l1 < 1e-5 || l2 < 1e-5) return 0;
  return Math.acos(THREE.MathUtils.clamp(_jv1.dot(_jv2) / (l1 * l2), -1, 1));
}

function belly(item, rest) {
  const { def, oPatch, iPatch } = item;
  const info = computePath(item);   // frame() 세팅 + 경로 폴리라인
  const geoLen = info.len;
  const o = oPatch.off, ins = iPatch.off;
  // 프레임 오프셋(전후·측면·along)을 경로 전체에 적용 → 오프셋된 벨리 폴리라인.
  _off.set(0, 0, 0)
    .addScaledVector(_ant, 0.5 * (o.a + ins.a))
    .addScaledVector(_lat, 0.5 * (o.l + ins.l))
    .addScaledVector(_axis, geoLen * def.along);
  const pts = info.pts.map(p => p.add(_off)); // 오프셋 적용(제자리)
  pointAtArc(pts, 0.5, _c);         // 벨리 중심 = 오프셋 경로 호 중앙
  // 길이·수축: 기본은 기하 경로 길이(관절 넘는 근육은 굴곡 시 짧아져 굵어짐). jointInf(기능
  //  근육 §7.4·§10.1)면 길이를 **관절 굴곡각의 함수**로 override — 길항근(삼두 sign=+1)은 굴곡
  //  시 신장(얇아짐), 주동근(sign=−1)은 단축. 기하로 안 잡히는 관절각↔길이 관계를 gain 으로 잇는다.
  let len = geoLen, contraction;
  if (item.jointInf && rest) {
    const scale = THREE.MathUtils.clamp(1 + item.jointInf.sign * item.jointInf.gain * jointFlexion(item.jointInf), 0.6, 1.6);
    len = rest * scale;
    contraction = 1 / scale;        // 늘면 얇아짐(부피 보존)
  } else {
    contraction = rest ? THREE.MathUtils.clamp(rest / geoLen, 0.7, 1.4) : 1;
  }
  const half = 0.5 * len * def.span;
  const radius = def.r * (item.muscleScale || 1) * (1 + def.bulge * (contraction - 1));
  return { center: _c, axis: _axis, half, radius, pts, len };
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

  // profile: 체형(§5.2 경량판) { muscle: 근육량 배율(반지름), fat: 지방층 두께(m) }.
  // 같은 골격에서 마른/평균/근육질/비만을 파라미터만으로 만든다(설계서 G2·§9.10).
  build(rig, profile = null) {
    this.clear();
    this.rig = rig;
    this.profile = { muscle: 1, fat: 0, transfer: 0.5, fascia: 2, ...(profile || {}) };
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
      // wrap 관절 뼈 해석(§6·§7.5) — 없으면 null(직선 경로).
      const wrapBone = def.wrap ? rig.boneMap.get(def.wrap.joint) : null;
      // 기능 근육 관절 영향(§7.4·§10.1) — 관절 뼈 + 그 부모·구동 자식을 잡아 굴곡각을 잰다.
      //  sign: 길항근(antagonist)=+1(굴곡 시 신장), 주동근=−1(단축).
      let jointInf = null;
      if (def.jointInf) {
        const jb = rig.boneMap.get(def.jointInf.joint);
        const parent = jb && jb.parent && jb.parent.isBone ? jb.parent : null;
        const child = jb && jb.children.find(k => k.isBone && rig.boneMap.get(simpleName(k.name)) === k);
        if (jb && parent && child) jointInf = { bone: jb, parent, child, gain: def.jointInf.gain, sign: def.jointInf.antagonist ? 1 : -1 };
      }
      const item = { def, oBone, iBone, oPatches, iPatches, oPatch: oPatches[0], iPatch: iPatches[0], mesh, shape: shapeOf(def), muscleScale: this.profile.muscle, wrapBone, jointInf };
      // rest 길이 캐시 (수축 기준) — wrap 우회 경로의 rest 길이(직선이면 |from−to|)
      this.restLen.set(item, computePath(item).len);
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
      frame(item.oPatch, item.iPatch, item.def.side); // _ant/_lat 갱신 (벨리와 동일 프레임)
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
      return {
        id: item.def.id, len: 2 * b.half, radius: b.radius, center: b.center.clone(), axis: b.axis.clone(),
        pts: b.pts.map(p => p.clone()), wrapped: b.pts.length > 2, // wrap 우회 경로(§6) 여부·경로점
      };
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
    const fat = this.profile.fat; // 지방층: 피부 캡슐을 균일하게 부풀림(§9.10 GlobalFat)
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
      // 벨리는 경로의 span 분율을 호 중앙에 차지. 서브 캡슐이 (wrap 우회) 폴리라인을 따른다.
      const span = item.def.span, lo = 0.5 - 0.5 * span;
      for (let k = 0; k < SKIN_CAPS; k++) {
        const s0 = k / SKIN_CAPS, s1 = (k + 1) / SKIN_CAPS;
        pointAtArc(bb.pts, lo + s0 * span, _pa);
        pointAtArc(bb.pts, lo + s1 * span, _pb);
        const r = bb.radius * eff * Math.max(sampleProfile(radii, (s0 + s1) / 2), 0.4) + fat;
        caps.push({ a: _pa.clone(), b: _pb.clone(), r });
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
          caps.push({ a: wp.clone(), b: wc.clone(), r: pad.r + fat });
        }
      } else {
        caps.push({ a: wp.clone(), b: wp.clone(), r: pad.r + fat });
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

// ============================================================================
//  fleshwarp.js — 원본 스킨 메시 워프 (FLESH-PLAN Phase W, 1차 경로)
//
//  원리: 원본 스킨 메시의 정점을 바인드 포즈에서 DNA 가 지시하는 만큼 방사 방향으로
//  이동시킨다(모프). 원본이 이미 가진 얼굴·손가락·근육 라인·UV·재질은 살아 있고, DNA 는
//  실루엣(반경 프로파일·flatten·bump)만 조각한다. 변형은 바인드 로컬 공간 1회 계산 —
//  바인드에서 three 스키닝은 position 속성 공간에서 항등이므로, 로컬 공간에서 계산한
//  변위를 position 에 구우면 이후 GPU 스키닝이 그대로 애니메이션한다(프레임 비용 0).
//
//  **비율 워프(단위 무관)**: 절대 반지름이 아니라 기준 DNA 대비 비율을 쓴다.
//    g_v = 1 + α·(R/R_ref − 1),  g_u = 1 + α·(R·f/(R_ref·f_ref) − 1)
//  DNA=기본이면 g≡1(무변형), α=0 도 항등 — 원본↔DNA 사이의 보간이다.
//  정점의 축 수직 오프셋 q 를 세그먼트 프레임 (û,v̂) 로 분해해 각각 g_u·g_v 배 — 절대
//  단위가 개입하지 않아 항등이 정확하다. bump/cut(W2)만 절대 미터 변위라 세그먼트
//  localPerMeter 로 환산해 더한다.
// ============================================================================
import * as THREE from 'three';
import { compileDna, defaultDna, lutAt, LUT_N } from './fleshdna.js';

const MIN_W = 0.02;      // 이보다 작은 스킨 가중치는 무시
const DEG_EPS = 0.2;     // flatten dir 이 축과 거의 평행하면 (그리드 단위) 프레임 퇴화 가드

export class FleshWarp {
  // ch: 캐릭터 상태(meshes·bones·boneMap·bindWorldQ), simpleName: 이름 정규화.
  constructor(ch, simpleName) {
    this.ch = ch;
    this.simpleName = simpleName;
    this.refCompiled = compileDna(defaultDna()); // 기준(무변형) DNA — 비율 분모
    this.meshEntries = [];
    this._build();
  }

  // 바인드 포즈(로드 직후) 1회 전처리: 정점 귀속 + 세그먼트 로컬 프레임 + 원본 백업.
  _build() {
    const { ch, simpleName } = this;
    ch.root.updateMatrixWorld(true);
    // 구동 뼈의 자식-세그먼트 목록: 부모 뼈 → [{parent, child}] (§3.1 부모 키)
    const segsByParent = new Map();
    for (const b of ch.bones) {
      if (!b.parent?.isBone) continue;
      if (!segsByParent.has(b.parent)) segsByParent.set(b.parent, []);
      segsByParent.get(b.parent).push(b);
    }

    const skinned = ch.meshes.filter(m => m.isSkinnedMesh && m.geometry?.attributes?.position);
    for (const mesh of skinned) {
      mesh.updateMatrixWorld(true);
      const m4inv = mesh.matrixWorld.clone().invert();
      // 이 메시 로컬 공간에서의 세그먼트 프레임 (부모 뼈 → 세그먼트 배열)
      const segList = [];       // { parentBone, childBone, A, dirAxis, len, u, v, hasFrame, key }
      const segIndex = new Map(); // childBone → segList idx
      const wp = new THREE.Vector3(), wq = new THREE.Vector3();
      for (const [parent, children] of segsByParent) {
        for (const child of children) {
          const A = parent.getWorldPosition(wp).clone().applyMatrix4(m4inv);
          const B = child.getWorldPosition(wq).clone().applyMatrix4(m4inv);
          const axis = B.clone().sub(A); const len = axis.length() || 1e-6; axis.multiplyScalar(1 / len);
          // 미터↔로컬 배율 — 월드 세그먼트 길이 대비 로컬 길이
          const worldLen = child.getWorldPosition(wq).distanceTo(parent.getWorldPosition(wp)) || 1e-6;
          const localPerMeter = len / worldLen;
          const parentKey = simpleName(parent.name), childKey = simpleName(child.name);
          const frame = this._segFrame(child, parentKey, childKey, axis, A, m4inv);
          segList.push({
            parentBone: parent, childBone: child, A: A.clone(), dirAxis: axis.clone(), len,
            localPerMeter, parentKey, childKey, key: parentKey + '>' + childKey,
            u: frame?.u || null, v: frame?.v || null,
          });
          segIndex.set(child, segList.length - 1);
        }
      }

      // 정점 귀속 — 스킨 영향 뼈마다: 그 뼈가 부모인 세그먼트 중 클램프 거리 최소.
      const pos = mesh.geometry.attributes.position;
      const nV = pos.count;
      const orig = new Float32Array(pos.array); // 원본 1회 백업 (누적 오염 방지)
      mesh.userData.fleshOrig = orig;
      const skIdx = mesh.geometry.attributes.skinIndex;
      const skW = mesh.geometry.attributes.skinWeight;
      const skelBones = mesh.skeleton?.bones || [];
      // 스킨 인덱스 뼈 → 이 메시 세그먼트들의 "부모"(= 구동 뼈) 로 해석 (§5W.3: __dup 제거)
      const skinBoneToParent = skelBones.map(sb => {
        const sn = simpleName((sb.name || '').replace(/__dup\d+$/, ''));
        const driving = ch.boneMap.get(sn);
        return driving && segsByParent.has(driving) ? driving : null;
      });

      const influences = new Array(nV);
      const vLocal = new THREE.Vector3(), qv = new THREE.Vector3();
      for (let i = 0; i < nV; i++) {
        vLocal.set(orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]);
        const infl = [];
        for (let k = 0; k < 4; k++) {
          const w = skW ? skW.getComponent(i, k) : (k === 0 ? 1 : 0);
          if (w < MIN_W) continue;
          const bi = skIdx ? skIdx.getComponent(i, k) : 0;
          const parentBone = skinBoneToParent[bi];
          if (!parentBone) continue;           // r=0/미매칭 뼈 → 변위 0 (원본 유지)
          // 후보 세그먼트(부모=parentBone) 중 클램프 거리 최소 선택
          let best = -1, bestD = Infinity, bestT = 0;
          for (const child of segsByParent.get(parentBone)) {
            const si = segIndex.get(child); const seg = segList[si];
            const rx = vLocal.x - seg.A.x, ry = vLocal.y - seg.A.y, rz = vLocal.z - seg.A.z;
            const tp = (rx * seg.dirAxis.x + ry * seg.dirAxis.y + rz * seg.dirAxis.z) / seg.len;
            const tc = tp < 0 ? 0 : (tp > 1 ? 1 : tp);
            const cx = tc * seg.len;
            qv.set(rx - seg.dirAxis.x * cx, ry - seg.dirAxis.y * cx, rz - seg.dirAxis.z * cx);
            const d = qv.length();
            if (d < bestD) { bestD = d; best = si; bestT = tc; }
          }
          if (best < 0) continue;
          const seg = segList[best];
          // 최종 q 를 비클램프-축점 기준으로 재계산 (축 오버슈트 보존 — 반경만 스케일)
          const rx = vLocal.x - seg.A.x, ry = vLocal.y - seg.A.y, rz = vLocal.z - seg.A.z;
          const tp = (rx * seg.dirAxis.x + ry * seg.dirAxis.y + rz * seg.dirAxis.z) / seg.len;
          const cx = tp * seg.len;
          qv.set(rx - seg.dirAxis.x * cx, ry - seg.dirAxis.y * cx, rz - seg.dirAxis.z * cx);
          const rec = { segIdx: best, t: bestT, w };
          if (seg.u) { rec.qu = qv.dot(seg.u); rec.qv = qv.dot(seg.v); }
          else { rec.qx = qv.x; rec.qy = qv.y; rec.qz = qv.z; } // 무-flatten: q 통째 스케일
          infl.push(rec);
        }
        influences[i] = infl;
      }

      this.meshEntries.push({ mesh, orig, influences, segList, m4inv, m3: new THREE.Matrix3().setFromMatrix4(m4inv) });
    }
  }

  // 세그먼트 로컬 프레임 (û, v̂). flatten 있으면 dir 추적(바인드=dir), 없으면 월드 +z 투영.
  // spheres 배치·flatten 분해에 공유. **모든 비-r0 세그먼트에 프레임을 만든다** — 프리셋
  // (stylized-f 등)이 기본 DNA 엔 없던 flatten·bump 를 얹어도 프레임이 준비돼 있어야 한다.
  // (기준 refCompiled 로 프레임 유무를 판정하면 프리셋 bump 가 누락된다.)
  _segFrame(child, parentKey, childKey, axisLocal, A, m4inv) {
    const spec = this.refCompiled.resolve(parentKey, childKey);
    if (!spec) return null; // r=0 세그먼트(손가락 등) — 변위 없음
    const dirWorld = spec.flatten ? spec.flatten.dir : [0, 0, 1];
    // 바인드 월드 dir 을 로컬 방향으로: 월드 두 점을 로컬로 매핑해 차 (스케일/회전 흡수)
    const pWorld = child.getWorldPosition(new THREE.Vector3());
    const tip = pWorld.clone().add(new THREE.Vector3(dirWorld[0], dirWorld[1], dirWorld[2]).multiplyScalar(0.1));
    const pLoc = pWorld.applyMatrix4(m4inv);
    const dLoc = tip.applyMatrix4(m4inv).sub(pLoc).normalize();
    const dot = dLoc.dot(axisLocal);
    const u = dLoc.clone().addScaledVector(axisLocal, -dot);
    if (u.length() < DEG_EPS) { // 축과 평행 → +x 폴백
      u.set(1, 0, 0).addScaledVector(axisLocal, -axisLocal.x);
      if (u.length() < DEG_EPS) u.set(0, 1, 0).addScaledVector(axisLocal, -axisLocal.y);
    }
    u.normalize();
    const v = axisLocal.clone().cross(u).normalize();
    return { u, v };
  }

  // DNA·α 변경 시 재적용 — 원본에서 항상 재계산(누적 오염 방지).
  apply(alpha = 1) {
    const dna = this.ch.dna;
    const compiled = this.ch.dnaCompiled || compileDna(dna);
    for (const entry of this.meshEntries) {
      // 세그먼트별 g_u·g_v LUT + bump/cut 구를 이번 DNA·α 로 컴파일
      const segG = entry.segList.map(seg => this._compileSegG(seg, compiled, alpha));
      const hasSpheres = segG.some(g => g && g.spheres && g.spheres.length);
      const pos = entry.mesh.geometry.attributes.position;
      const orig = entry.orig, arr = pos.array, influences = entry.influences;
      const nV = pos.count;
      for (let i = 0; i < nV; i++) {
        let dx = 0, dy = 0, dz = 0;
        const infl = influences[i];
        for (let j = 0; j < infl.length; j++) {
          const r = infl[j]; const g = segG[r.segIdx];
          if (!g) continue;
          const w = r.w;
          const gu = lutInterp(g.guLut, r.t), gv = lutInterp(g.gvLut, r.t);
          if (r.qu !== undefined) { // flatten 분해
            const su = (gu - 1), sv = (gv - 1);
            dx += w * (g.ux * r.qu * su + g.vx * r.qv * sv);
            dy += w * (g.uy * r.qu * su + g.vy * r.qv * sv);
            dz += w * (g.uz * r.qu * su + g.vz * r.qv * sv);
          } else { // 균등 스케일 (g_u=g_v)
            const s = gv - 1;
            dx += w * r.qx * s; dy += w * r.qy * s; dz += w * r.qz * s;
          }
        }
        // W2 — bump/cut 변위장 (로컬 공간)
        if (hasSpheres) {
          const vx = orig[i * 3], vy = orig[i * 3 + 1], vz = orig[i * 3 + 2];
          for (const g of segG) {
            if (!g || !g.spheres) continue;
            for (const s of g.spheres) {
              const rx = vx - s.cx, ry = vy - s.cy, rz = vz - s.cz;
              const d2 = rx * rx + ry * ry + rz * rz;
              if (d2 >= s.Rc2) continue;
              const d = Math.sqrt(d2) || 1e-6;
              const f = 1 - d2 / s.Rc2; const mag = s.disp * f * f * f; // 미터×로컬 변위(부호)
              dx += (rx / d) * mag; dy += (ry / d) * mag; dz += (rz / d) * mag;
            }
          }
        }
        arr[i * 3] = orig[i * 3] + dx;
        arr[i * 3 + 1] = orig[i * 3 + 1] + dy;
        arr[i * 3 + 2] = orig[i * 3 + 2] + dz;
      }
      pos.needsUpdate = true;
      entry.mesh.geometry.computeVertexNormals();
      entry.mesh.geometry.attributes.normal.needsUpdate = true;
    }
  }

  // 세그먼트 하나의 g_u/g_v LUT + bump/cut 구(로컬) 컴파일.
  _compileSegG(seg, compiled, alpha) {
    const cur = compiled.resolve(seg.parentKey, seg.childKey);
    const ref = this.refCompiled.resolve(seg.parentKey, seg.childKey);
    if (!cur || !ref) return null; // r=0 세그먼트 — 변위 없음
    const fCur = cur.flatten ? cur.flatten.f : 1, fRef = ref.flatten ? ref.flatten.f : 1;
    const guLut = new Float32Array(LUT_N), gvLut = new Float32Array(LUT_N);
    for (let i = 0; i < LUT_N; i++) {
      const R = cur.lut[i], Rr = ref.lut[i] || 1e-6;
      gvLut[i] = 1 + alpha * (R / Rr - 1);
      guLut[i] = 1 + alpha * ((R * fCur) / (Rr * fRef) - 1);
    }
    const out = {
      guLut, gvLut,
      ux: seg.u?.x || 0, uy: seg.u?.y || 0, uz: seg.u?.z || 0,
      vx: seg.v?.x || 0, vy: seg.v?.y || 0, vz: seg.v?.z || 0,
    };
    // bump/cut → 로컬 구 (offset·r 을 localPerMeter 로 환산, u/v/axis 프레임)
    if (cur.spheres.length && seg.u) {
      const lpm = seg.localPerMeter;
      out.spheres = cur.spheres.map(sp => {
        const cxAxis = sp.t * seg.len;
        const cx = seg.A.x + seg.dirAxis.x * cxAxis + (sp.offset[0] * seg.u.x + sp.offset[1] * seg.v.x + sp.offset[2] * seg.dirAxis.x) * lpm;
        const cy = seg.A.y + seg.dirAxis.y * cxAxis + (sp.offset[0] * seg.u.y + sp.offset[1] * seg.v.y + sp.offset[2] * seg.dirAxis.y) * lpm;
        const cz = seg.A.z + seg.dirAxis.z * cxAxis + (sp.offset[0] * seg.u.z + sp.offset[1] * seg.v.z + sp.offset[2] * seg.dirAxis.z) * lpm;
        const Rc = 2.5 * sp.r * lpm; // 영향 반경 = BLEND×r (미터) → 로컬
        return { cx, cy, cz, Rc2: Rc * Rc, disp: alpha * sp.strength * sp.r * lpm };
      });
    }
    return out;
  }

  // 원본으로 되돌린다 (off 모드).
  restore() {
    for (const entry of this.meshEntries) {
      const pos = entry.mesh.geometry.attributes.position;
      pos.array.set(entry.orig);
      pos.needsUpdate = true;
      entry.mesh.geometry.computeVertexNormals();
      entry.mesh.geometry.attributes.normal.needsUpdate = true;
    }
  }
}

// LUT 선형 보간 — apply 핫루프용.
function lutInterp(lut, t) {
  if (t <= 0) return lut[0];
  if (t >= 1) return lut[LUT_N - 1];
  const s = t * (LUT_N - 1), i = s | 0;
  return lut[i] + (lut[i + 1] - lut[i]) * (s - i);
}

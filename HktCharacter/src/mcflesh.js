// ============================================================================
//  mcflesh.js — 스켈레톤 → 살 DNA 캡슐 SDF → THREE.MarchingCubes 실시간 폴리곤화
//
//  세그먼트(부모→자식 뼈)마다 캡슐 하나. 반지름은 살 DNA 프로파일 LUT(부모 키 매칭,
//  §3.1)로 t 축을 따라 변한다. 각 캡슐이 Wyvill 밀도 f(d)=(1-d²/R²)³ (R=BLEND×blend×r)
//  를 필드에 "더하면" 겹치는 곳이 자연히 부드럽게 붙는다(메타볼). bump/cut 은 부호 붙은
//  구로 같은 필드에 가/감산한다. 매 프레임: reset → fillField → MarchingCubes update().
//
//  ⚠ 지위(FLESH-PLAN v1.1): 베이스 메시가 있는 캐릭터의 1차 경로는 원본 메시 워프
//  (src/fleshwarp.js)다. 이 SDF→MC 경로는 뼈-only 리그용 폴백 + DNA 프리뷰다.
//  fillField 는 워프·bake·Node 검증이 공유하는 순수 함수(단일 진실 원천).
// ============================================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { LUT_N } from './fleshdna.js';

export const RES = 64;          // 필드 해상도 — 복셀 2.3/64 ≈ 3.6cm (떨림 완화)
export const HALF = 1.15;       // 볼륨 반경(m) — 키 1.7m 캐릭터 + 팔 벌림 여유
export const CENTER_Y = 0.9;    // 볼륨 중심 높이
export const BLEND = 2.5;       // 블렌드 반경 = BLEND×blend×살 반지름 — 클수록 완만 = 덜 떨림
export const ISO = (1 - 1 / (BLEND * BLEND)) ** 3; // d=반지름 지점이 표면이 되는 값 (≈0.593)

// ---------------------------------------------------------------------------
//  fillField — 필드 채우기 순수 함수 (단일 진실 원천).
//  segs: [{ ax,ay,az, bx,by,bz, lut, rScale, rMaxGrid, ux?,uy?,uz?,f? }]
//        — 전부 그리드 공간 사전 변환 완료. lut 은 미터 반지름, rScale=BLEND×blend×gs.
//        flatten 세그먼트는 ux/uy/uz(그리드 단위 u 벡터) + f(비율)를 싣는다.
//  spheres: [{ cx,cy,cz, Rc, strength }] — bump(+)/cut(-) 통합, 그리드 공간.
//  dims: { size, yd, zd }  field: Float32Array
// ---------------------------------------------------------------------------
export function fillField(field, dims, segs, spheres) {
  const { size, yd, zd } = dims;
  const LAST = LUT_N - 1;
  for (const seg of segs) {
    const { ax, ay, az, bx, by, bz, lut, rScale } = seg;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz;
    const Rmax = seg.rMaxGrid;
    const hasFlat = seg.f !== undefined;
    const ux = seg.ux, uy = seg.uy, uz = seg.uz, inv_f2 = hasFlat ? 1 / (seg.f * seg.f) : 1;
    const x0 = Math.max(1, Math.floor(Math.min(ax, bx) - Rmax)), x1 = Math.min(size - 2, Math.ceil(Math.max(ax, bx) + Rmax));
    const y0 = Math.max(1, Math.floor(Math.min(ay, by) - Rmax)), y1 = Math.min(size - 2, Math.ceil(Math.max(ay, by) + Rmax));
    const z0 = Math.max(1, Math.floor(Math.min(az, bz) - Rmax)), z1 = Math.min(size - 2, Math.ceil(Math.max(az, bz) + Rmax));
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        let idx = z * zd + y * yd + x0;
        for (let x = x0; x <= x1; x++, idx++) {
          const px = x - ax, py = y - ay, pz = z - az;
          let t = len2 > 1e-10 ? (px * dx + py * dy + pz * dz) / len2 : 0;
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz;
          let d2 = qx * qx + qy * qy + qz * qz;
          if (hasFlat) { // 타원 단면: u 방향 성분을 1/f² 로 (u 방향 반경 = f×R)
            const s = qx * ux + qy * uy + qz * uz;
            d2 = s * s * inv_f2 + (d2 - s * s);
          }
          // LUT 선형 보간 (핫루프) → 미터 반지름 → 그리드
          const sf = t * LAST, li = sf | 0;
          const r = li >= LAST ? lut[LAST] : lut[li] + (lut[li + 1] - lut[li]) * (sf - li);
          const R = r * rScale, R2 = R * R;
          if (d2 >= R2) continue;
          const g = 1 - d2 / R2;
          field[idx] += g * g * g; // Wyvill — 겹치면 자동 smooth blend
        }
      }
    }
  }
  // bump/cut — 부호 붙은 구 가/감산 (순서 무관, 음수 허용 — MC 는 iso 교차만 본다)
  for (const sp of spheres) {
    const { cx, cy, cz, Rc, strength } = sp;
    const R2 = Rc * Rc;
    const x0 = Math.max(1, Math.floor(cx - Rc)), x1 = Math.min(size - 2, Math.ceil(cx + Rc));
    const y0 = Math.max(1, Math.floor(cy - Rc)), y1 = Math.min(size - 2, Math.ceil(cy + Rc));
    const z0 = Math.max(1, Math.floor(cz - Rc)), z1 = Math.min(size - 2, Math.ceil(cz + Rc));
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        let idx = z * zd + y * yd + x0;
        for (let x = x0; x <= x1; x++, idx++) {
          const qx = x - cx, qy = y - cy, qz = z - cz;
          const d2 = qx * qx + qy * qy + qz * qz;
          if (d2 >= R2) continue;
          const g = 1 - d2 / R2;
          field[idx] += strength * g * g * g;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
//  월드 좌표 → 그리드 좌표 (볼륨 원점 = 구석, 셀 크기 1). offsetX 는 슬롯 정렬용.
// ---------------------------------------------------------------------------
function toGrid(p, half, offsetX) {
  return [
    ((p.x - offsetX) / HALF + 1) * half,
    ((p.y - CENTER_Y) / HALF + 1) * half,
    (p.z / HALF + 1) * half,
  ];
}

export class McFlesh {
  constructor(scene) {
    this.material = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.6 });
    this.mc = new MarchingCubes(RES, this.material, false, false, 100000);
    this.mc.isolation = ISO;
    this.mc.position.set(0, CENTER_Y, 0);
    this.mc.scale.setScalar(HALF);       // 오브젝트 공간 -1..1 → 월드 ±HALF
    this.mc.frustumCulled = false;
    this.mc.visible = false;
    scene.add(this.mc);
    this._wa = new THREE.Vector3();
    this._wb = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._v = new THREE.Vector3();
  }

  setVisible(on) { this.mc.visible = !!on; }
  get visible() { return this.mc.visible; }

  // ch: 캐릭터 상태(bones·slotX·dnaCompiled·bindWorldQ), simpleName: 이름 정규화 함수.
  // 볼륨은 원점 중심이라 뼈 월드 x 에서 슬롯 x 오프셋을 빼 정렬한다.
  update(ch, simpleName) {
    const mc = this.mc, size = mc.size, half = mc.halfsize, field = mc.field;
    mc.reset();
    const gs = half / HALF;               // 월드 m → 그리드 단위 배율
    const offsetX = ch.slotX || 0;
    const compiled = ch.dnaCompiled;
    const seen = new Set();                // 리그 2벌 FBX 중복 세그먼트 방지 (부모>자식 키)
    const segs = [], spheres = [];
    for (const b of ch.bones) {
      if (!b.parent?.isBone) continue;
      const childKey = simpleName(b.name);
      const parentKey = simpleName(b.parent.name);
      const key = parentKey + '>' + childKey;
      if (seen.has(key)) continue;
      seen.add(key);
      const spec = compiled.resolve(parentKey, childKey);
      if (!spec) continue;
      const [ax, ay, az] = toGrid(b.parent.getWorldPosition(this._wa), half, offsetX);
      const [bx, by, bz] = toGrid(b.getWorldPosition(this._wb), half, offsetX);
      const rScale = BLEND * spec.blend * gs;
      const seg = { ax, ay, az, bx, by, bz, lut: spec.lut, rScale, rMaxGrid: spec.rMax * rScale };
      // 세그먼트 로컬 프레임 (그리드 단위): â(축), u(flatten dir 추적 또는 월드 +z 투영), v=â×u
      let axx = bx - ax, axy = by - ay, axz = bz - az;
      const al = Math.hypot(axx, axy, axz) || 1; axx /= al; axy /= al; axz /= al;
      const u = this._frameU(ch, b, spec.flatten, axx, axy, axz);
      if (spec.flatten && u) { // flatten 은 축과 거의 평행하면 이번 프레임 생략(u=null)
        seg.ux = u.x; seg.uy = u.y; seg.uz = u.z; seg.f = spec.flatten.f;
      }
      segs.push(seg);
      // bump/cut 구 중심을 세그먼트 로컬 프레임에서 계산
      if (spec.spheres.length) {
        const uu = u || this._frameU(ch, b, { dir: [0, 0, 1], f: 1 }, axx, axy, axz) || { x: 1, y: 0, z: 0 };
        const vx = axy * uu.z - axz * uu.y, vy = axz * uu.x - axx * uu.z, vz = axx * uu.y - axy * uu.x;
        for (const sp of spec.spheres) {
          const cxw = ax + (bx - ax) * sp.t, cyw = ay + (by - ay) * sp.t, czw = az + (bz - az) * sp.t;
          const o0 = sp.offset[0] * gs, o1 = sp.offset[1] * gs, o2 = sp.offset[2] * gs;
          spheres.push({
            cx: cxw + o0 * uu.x + o1 * vx + o2 * axx,
            cy: cyw + o0 * uu.y + o1 * vy + o2 * axy,
            cz: czw + o0 * uu.z + o1 * vz + o2 * axz,
            Rc: BLEND * sp.r * gs,
            strength: sp.strength,
          });
        }
      }
    }
    fillField(field, { size, yd: mc.yd, zd: mc.zd }, segs, spheres);
    mc.update(); // 마칭 큐브 → BufferGeometry 갱신
  }

  // flatten dir(바인드 월드) 을 현재 포즈로 추적 → 축 직교화 → 그리드 단위 u.
  // dNow = qWorld(b) · qBindWorld(b)⁻¹ · dir. 퇴화(축과 평행)면 null.
  _frameU(ch, b, flatten, axx, axy, axz) {
    if (!flatten) return null;
    const qb = ch.bindWorldQ?.get(b);
    b.getWorldQuaternion(this._q);
    if (qb) this._q2.copy(qb).invert().premultiply(this._q); // qWorld · qBind⁻¹
    else this._q2.identity();
    const d = this._v.set(flatten.dir[0], flatten.dir[1], flatten.dir[2]).applyQuaternion(this._q2);
    const dot = d.x * axx + d.y * axy + d.z * axz;
    let ux = d.x - dot * axx, uy = d.y - dot * axy, uz = d.z - dot * axz;
    const ul = Math.hypot(ux, uy, uz);
    if (ul < 0.2) return null; // 단면상 의미 없음 → flatten 생략
    return { x: ux / ul, y: uy / ul, z: uz / ul };
  }
}

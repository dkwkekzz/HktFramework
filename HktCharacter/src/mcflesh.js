// ============================================================================
//  mcflesh.js — 스켈레톤 → 살 DNA SDF → THREE.MarchingCubes 실시간 폴리곤화
//
//  뼈(parent→child)마다 캡슐 세그먼트 하나. 반지름은 하드코딩이 아니라 **살 DNA**
//  (src/fleshdna.js) 의 profile 을 33-지점 LUT 로 구운 값을 쓴다. 각 캡슐이 Wyvill
//  밀도 f(d) = (1 - d²/R²)³ (d<R, R = BLEND×살 반지름) 를 필드에 "더하면" 겹치는
//  곳이 자연히 부드럽게 붙는다(메타볼). ISO ≈ d=반지름 지점이 표면.
//
//  필드 채우기(fillField)는 순수 함수로 분리 — 실시간·bake·Node 검증이 공유하는
//  **단일 진실 원천**. update() 는 뼈 월드 → 그리드 공간 변환 + 세그먼트/구 목록
//  조립만 하고 채우기는 fillField 에 위임한다.
// ============================================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { compileDna, LUT_N } from './fleshdna.js';

export const RES = 64;   // 필드 해상도 — 복셀 2.3/64 ≈ 3.6cm (떨림 완화)
export const HALF = 1.15;       // 볼륨 반경(m) — 키 1.7m 캐릭터 + 팔 벌림 여유
export const CENTER_Y = 0.9;    // 볼륨 중심 높이
export const BLEND = 2.5;       // 블렌드 반경 = BLEND×살 반지름 — 클수록 완만 = 덜 떨림
export const ISO = (1 - 1 / (BLEND * BLEND)) ** 3; // d=반지름 지점이 표면인 값 (≈0.593)

// ---------------------------------------------------------------------------
//  fillField — 세그먼트(캡슐) + 구(bump/cut) 를 필드에 가산하는 순수 함수.
//  전부 **그리드 공간**(원점=볼륨 구석, 셀 크기 1)에서 사전 변환된 값을 받는다.
//
//  dims    : { size, yd, zd }  — MarchingCubes 필드 인덱싱 (idx = z*zd + y*yd + x)
//  segs[]  : { ax,ay,az, bx,by,bz, lut, fr, rmaxGrid, flatten:{ux,uy,uz,invf2}|null }
//            fr = BLEND×blend×gs (LUT 반지름 m → 그리드 필드 반경 배율)
//  spheres[]: { cx,cy,cz, rGrid, strength }  (strength 부호: bump +, cut −)
// ---------------------------------------------------------------------------
export function fillField(field, dims, segs, spheres) {
  const { size, yd, zd } = dims;
  const NLUT = LUT_N - 1;
  for (const s of segs) {
    const { ax, ay, az, bx, by, bz, lut, fr, rmaxGrid, flatten } = s;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz;
    const x0 = Math.max(1, Math.floor(Math.min(ax, bx) - rmaxGrid)), x1 = Math.min(size - 2, Math.ceil(Math.max(ax, bx) + rmaxGrid));
    const y0 = Math.max(1, Math.floor(Math.min(ay, by) - rmaxGrid)), y1 = Math.min(size - 2, Math.ceil(Math.max(ay, by) + rmaxGrid));
    const z0 = Math.max(1, Math.floor(Math.min(az, bz) - rmaxGrid)), z1 = Math.min(size - 2, Math.ceil(Math.max(az, bz) + rmaxGrid));
    const hasF = !!flatten;
    const ux = hasF ? flatten.ux : 0, uy = hasF ? flatten.uy : 0, uz = hasF ? flatten.uz : 0;
    const invf2 = hasF ? flatten.invf2 : 1;
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        let idx = z * zd + y * yd + x0;
        for (let x = x0; x <= x1; x++, idx++) {
          const px = x - ax, py = y - ay, pz = z - az;
          let t = len2 > 1e-10 ? (px * dx + py * dy + pz * dz) / len2 : 0;
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz;
          const d2 = qx * qx + qy * qy + qz * qz;
          // LUT 선형 보간 (t∈[0,1] → 반지름 m) → 그리드 필드 반경
          const spos = t * NLUT; let li = spos | 0; if (li >= NLUT) li = NLUT - 1;
          const rM = lut[li] + (lut[li + 1] - lut[li]) * (spos - li);
          const R = rM * fr, R2 = R * R;
          // flatten: u 방향 성분을 f 로 압축한 유효 거리² (§5.2)
          let de2 = d2;
          if (hasF) { const sdot = qx * ux + qy * uy + qz * uz; de2 = sdot * sdot * invf2 + (d2 - sdot * sdot); }
          if (de2 >= R2) continue;
          const g = 1 - de2 / R2;
          field[idx] += g * g * g; // Wyvill — 겹치면 자동 smooth blend
        }
      }
    }
  }
  // 구 (bump 가산 / cut 감산) — 가산 필드라 순서 무관, 음수 허용(MC 는 iso 교차만 본다)
  for (const sp of spheres) {
    const { cx, cy, cz, rGrid, strength } = sp;
    const R2 = rGrid * rGrid;
    const x0 = Math.max(1, Math.floor(cx - rGrid)), x1 = Math.min(size - 2, Math.ceil(cx + rGrid));
    const y0 = Math.max(1, Math.floor(cy - rGrid)), y1 = Math.min(size - 2, Math.ceil(cy + rGrid));
    const z0 = Math.max(1, Math.floor(cz - rGrid)), z1 = Math.min(size - 2, Math.ceil(cz + rGrid));
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        let idx = z * zd + y * yd + x0;
        for (let x = x0; x <= x1; x++, idx++) {
          const px = x - cx, py = y - cy, pz = z - cz;
          const d2 = px * px + py * py + pz * pz;
          if (d2 >= R2) continue;
          const g = 1 - d2 / R2;
          field[idx] += strength * g * g * g;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
//  월드 → 그리드 좌표 변환 (볼륨 원점 구석 기준, 셀 크기 1). offsetX 로 슬롯 정렬.
// ---------------------------------------------------------------------------
function toGridX(x, half, offsetX) { return ((x - offsetX) / HALF + 1) * half; }
function toGridY(y, half) { return ((y - CENTER_Y) / HALF + 1) * half; }
function toGridZ(z, half) { return (z / HALF + 1) * half; }

// flatten/bump 의 세그먼트 로컬 프레임 u 축: dir(바인드 월드) 를 현재 회전으로 옮긴 뒤
// 세그먼트 축 â 에 직교화. dir 없으면 월드 +z 투영(퇴화 시 +x). 퇴화(|u|<0.2)면 null.
const _dNow = new THREE.Vector3(), _qw = new THREE.Quaternion(), _qr = new THREE.Quaternion();
function computeU(dir, bindWorldQ, worldQ, axx, axy, axz) {
  if (dir) {
    _dNow.set(dir[0], dir[1], dir[2]);
    if (bindWorldQ) { _qr.copy(worldQ).multiply(_qw.copy(bindWorldQ).invert()); _dNow.applyQuaternion(_qr); }
  } else {
    _dNow.set(0, 0, 1); // 월드 +z (전방)
  }
  let dot = _dNow.x * axx + _dNow.y * axy + _dNow.z * axz;
  let ux = _dNow.x - dot * axx, uy = _dNow.y - dot * axy, uz = _dNow.z - dot * axz;
  let len = Math.hypot(ux, uy, uz);
  if (len < 0.2) {
    if (dir) return null;                 // flatten: 축과 거의 평행 → 이 프레임 생략
    dot = axx; ux = 1 - dot * axx; uy = -dot * axy; uz = -dot * axz; len = Math.hypot(ux, uy, uz); // +x fallback
    if (len < 1e-6) return null;
  }
  return { x: ux / len, y: uy / len, z: uz / len };
}

// ---------------------------------------------------------------------------
//  buildSegments — 캐릭터의 뼈·DNA 를 임의 해상도(size) 그리드 공간의 캡슐/구
//  목록으로 변환. 실시간(size=RES)·bake(size=160)·Node 검증이 공유한다.
//  각 seg/sphere 에 소속 뼈(bone) 를 실어 bake 스키닝이 기여도→가중치를 귀속.
// ---------------------------------------------------------------------------
const _wa = new THREE.Vector3(), _wb = new THREE.Vector3(), _bq = new THREE.Quaternion();

// 부모마다 "정합 자식"(부모 방향과 가장 나란한 자식) 1개만 캡슐로 삼는다. 곁가지
// (Spine2→Shoulder, Hips→UpLeg)는 캡슐에서 빠지고 자기 자신의 세그먼트로 그려진다.
function primaryChildSet(bones) {
  const byParent = new Map();
  const wp = new THREE.Vector3(), wc = new THREE.Vector3(), wg = new THREE.Vector3();
  for (const b of bones) { const par = b.parent; if (!par?.isBone) continue; if (!byParent.has(par)) byParent.set(par, []); byParent.get(par).push(b); }
  const set = new Set();
  for (const [par, kids] of byParent) {
    if (kids.length === 1) { set.add(kids[0]); continue; }
    // 부모 방향 = (부모 - 조부모), 조부모 없으면 월드 +y
    par.getWorldPosition(wp);
    let dx = 0, dy = 1, dz = 0;
    if (par.parent?.isBone) { par.parent.getWorldPosition(wg); dx = wp.x - wg.x; dy = wp.y - wg.y; dz = wp.z - wg.z; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l; }
    let best = kids[0], bestDot = -Infinity;
    for (const k of kids) {
      k.getWorldPosition(wc);
      let cx = wc.x - wp.x, cy = wc.y - wp.y, cz = wc.z - wp.z; const l = Math.hypot(cx, cy, cz) || 1; cx /= l; cy /= l; cz /= l;
      const dot = cx * dx + cy * dy + cz * dz;
      if (dot > bestDot) { bestDot = dot; best = k; }
    }
    set.add(best);
  }
  return set;
}

export function buildSegments(ch, simpleName, size) {
  const half = size / 2;
  const gs = half / HALF;             // 월드 m → 그리드 단위 배율
  const offsetX = ch.slotX || 0;
  const compiled = ch.dnaCompiled || (ch.dnaCompiled = compileDna(ch.dna));
  const segs = [], spheres = [];
  const sphereKeys = new Set();       // bump/cut 은 키당 1회만 배치(분기 뼈 중복 방지)
  // 캡슐 = 부모 뼈 → 자식 뼈. **프로파일·스키닝은 부모 뼈로** 귀속한다 — Mixamo 는 뼈의
  // 살이 그 뼈에서 자식 쪽으로 뻗으므로(예: Arm→ForeArm 구간 = 상완, Head→HeadTop = 두개골),
  // 부모 키로 조회해야 해부학 라벨·애니메이션 바인딩이 맞는다.
  const primary = ch._primaryChild || (ch._primaryChild = primaryChildSet(ch.bones));
  for (const b of ch.bones) {
    const par = b.parent;
    if (!par?.isBone) continue;
    if (!primary.has(b)) continue;   // 분기 뼈는 정합(straightest) 자식으로만 캡슐 — 곁가지
                                     // (어깨·고관절)는 자기 세그먼트로 렌더돼 슬래브 벌크 방지
    const key = simpleName(par.name);
    const r = compiled.resolve(key);
    if (!r) continue;                 // r=0 세그먼트(손가락 등) 생략
    const a = par.getWorldPosition(_wa);
    const c = b.getWorldPosition(_wb);
    let ax = toGridX(a.x, half, offsetX), ay = toGridY(a.y, half), az = toGridZ(a.z, half);
    let bx = toGridX(c.x, half, offsetX), by = toGridY(c.y, half), bz = toGridZ(c.z, half);
    const fr = BLEND * r.blend * gs;
    const rmaxGrid = r.rMax * fr;
    // 세그먼트 축 단위벡터 (그리드)
    let axx = bx - ax, axy = by - ay, axz = bz - az;
    const alen = Math.hypot(axx, axy, axz) || 1; axx /= alen; axy /= alen; axz /= alen;
    // offset: 캡슐을 뼈에서 스킨 중심선으로 이동 (Mixamo 뼈는 몸 중심이 아니라 등/관절에
    // 치우쳐 있어, 이동 없이는 살이 뼈 기준 대칭으로 부풀어 벌크해진다). u,v 프레임에서 배치.
    if (r.offset) {
      const su = computeU(null, null, null, axx, axy, axz); // 월드 +z 투영 = u
      if (su) {
        const vx = axy * su.z - axz * su.y, vy = axz * su.x - axx * su.z, vz = axx * su.y - axy * su.x;
        const o0 = r.offset[0] * gs, o1 = r.offset[1] * gs, o2 = r.offset[2] * gs;
        const dx = o0 * su.x + o1 * vx + o2 * axx, dy = o0 * su.y + o1 * vy + o2 * axy, dz = o0 * su.z + o1 * vz + o2 * axz;
        ax += dx; ay += dy; az += dz; bx += dx; by += dy; bz += dz;
      }
    }
    // flatten u (필요 시) — 회전 추적은 살이 귀속된 부모 뼈 기준
    let flatten = null, uvec = null;
    if (r.flatten) {
      const worldQ = par.getWorldQuaternion(_bq);
      uvec = computeU(r.flatten.dir, ch.bindWorldQ?.get(par), worldQ, axx, axy, axz);
      if (uvec) flatten = { ux: uvec.x, uy: uvec.y, uz: uvec.z, invf2: 1 / (r.flatten.f * r.flatten.f) };
    }
    segs.push({ ax, ay, az, bx, by, bz, lut: r.lut, fr, rmaxGrid, flatten, bone: par });
    // 구 (bump/cut) — 키당 1회만(분기 뼈에서 중복 배치 방지)
    if (r.spheres.length && !sphereKeys.has(key)) {
      sphereKeys.add(key);
      const su = uvec || computeU(null, null, null, axx, axy, axz); // dir 없으면 월드 +z 투영
      if (su) {
        const vx = axy * su.z - axz * su.y, vy = axz * su.x - axx * su.z, vz = axx * su.y - axy * su.x;
        for (const sp of r.spheres) {
          const lx = ax + (bx - ax) * sp.t, ly = ay + (by - ay) * sp.t, lz = az + (bz - az) * sp.t;
          const o0 = sp.offset[0] * gs, o1 = sp.offset[1] * gs, o2 = sp.offset[2] * gs;
          spheres.push({
            cx: lx + o0 * su.x + o1 * vx + o2 * axx,
            cy: ly + o0 * su.y + o1 * vy + o2 * axy,
            cz: lz + o0 * su.z + o1 * vz + o2 * axz,
            rGrid: BLEND * sp.r * gs, strength: sp.strength, bone: par,
          });
        }
      }
    }
  }
  return { segs, spheres };
}

// 한 점(그리드 공간)에서의 세그먼트 Wyvill 기여도 — fillField 와 **동일 수식**.
// bake 스키닝 가중치가 이 함수를 재사용해 필드와 정합한다(§6.1-6).
const NLUT = LUT_N - 1;
export function segFieldAt(seg, x, y, z) {
  const { ax, ay, az, bx, by, bz, lut, fr, flatten } = seg;
  const dx = bx - ax, dy = by - ay, dz = bz - az, len2 = dx * dx + dy * dy + dz * dz;
  const px = x - ax, py = y - ay, pz = z - az;
  let t = len2 > 1e-10 ? (px * dx + py * dy + pz * dz) / len2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz, d2 = qx * qx + qy * qy + qz * qz;
  const spos = t * NLUT; let li = spos | 0; if (li >= NLUT) li = NLUT - 1;
  const rM = lut[li] + (lut[li + 1] - lut[li]) * (spos - li);
  const R2 = (rM * fr) * (rM * fr);
  let de2 = d2;
  if (flatten) { const sdot = qx * flatten.ux + qy * flatten.uy + qz * flatten.uz; de2 = sdot * sdot * flatten.invf2 + (d2 - sdot * sdot); }
  if (de2 >= R2) return 0;
  const g = 1 - de2 / R2; return g * g * g;
}

export function sphereFieldAt(sp, x, y, z) {
  const px = x - sp.cx, py = y - sp.cy, pz = z - sp.cz, d2 = px * px + py * py + pz * pz;
  const R2 = sp.rGrid * sp.rGrid;
  if (d2 >= R2) return 0;
  const g = 1 - d2 / R2; return sp.strength * g * g * g;
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
  }

  setVisible(on) { this.mc.visible = !!on; }
  get visible() { return this.mc.visible; }

  // ch: 캐릭터 상태. ch.bones(구동 뼈, 월드 최신), ch.dnaCompiled(compileDna 결과),
  //     ch.bindWorldQ(flatten 회전 추적), ch.slotX(볼륨 정렬 오프셋) 를 읽는다.
  update(ch, simpleName) {
    const mc = this.mc;
    mc.reset();
    const { segs, spheres } = buildSegments(ch, simpleName, mc.size);
    fillField(mc.field, { size: mc.size, yd: mc.yd, zd: mc.zd }, segs, spheres);
    mc.update(); // 마칭 큐브 → BufferGeometry 갱신
  }
}

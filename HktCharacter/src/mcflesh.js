// ============================================================================
//  mcflesh.js — 스켈레톤 → 살 DNA SDF → THREE.MarchingCubes 실시간 폴리곤화
//
//  뼈(parent→child)마다 세그먼트 하나. 각 세그먼트가 축을 따라 프로파일 반지름의
//  캡슐형 밀도 f(d) = (1 - d²/R²)³ (d<R, R = BLEND×살반지름) 를 필드에 "더하면"
//  겹치는 곳이 자연히 부드럽게 붙는다(메타볼). iso = (1-1/BLEND²)³ ≈ 0.593 이
//  d=살반지름 지점을 표면으로 만든다.
//
//  반지름·형태는 하드코딩이 아니라 **살 DNA**(fleshdna.js) 가 소유한다:
//    - 세그먼트별 프로파일 LUT(부모0→자식1 축의 반지름 곡선)
//    - flatten(타원 단면) · cut(구 감산) · blend(폭 배율) · groups(두께 배율)
//  필드 채우기(fillField)는 실시간·bake·Node 검증이 공유하는 순수 함수다.
// ============================================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

export const RES = 64;          // 필드 해상도 — 복셀 2.3/64 ≈ 3.6cm (떨림 완화)
export const HALF = 1.15;       // 볼륨 반경(m) — 키 1.7m 캐릭터 + 팔 벌림 여유
export const CENTER_Y = 0.9;    // 볼륨 중심 높이
export const BLEND = 2.5;       // 블렌드 반경 = BLEND×살 반지름 — 클수록 필드가 완만
export const ISO = (1 - 1 / (BLEND * BLEND)) ** 3; // d=반지름 지점이 표면 (≈0.593)

const LUT_MAX = 32; // LUT 마지막 인덱스 (길이 33)

// ---------------------------------------------------------------------------
//  fillField — 세그먼트/컷 리스트를 필드에 채우는 **순수 함수** (단일 진실 원천).
//  실시간(RES 64)·bake(RES 160)·Node 검증이 전부 이 함수를 공유한다.
//
//  segs: [{ ax,ay,az, bx,by,bz, lut(Float32Array 33, 미터), rscale, rMax,
//           flatten?:{ux,uy,uz,finv2m1} }]  — 전부 **그리드 공간** 사전 변환 완료.
//    · 그리드 반지름 R = lut보간값 × rscale.  rMax = 세그먼트 최대 그리드 반지름(bbox용).
//    · flatten.finv2m1 = 1/f² − 1 (u 방향 유효거리 확대량).
//  cuts: [{ cx,cy,cz, Rc, strength }] — 그리드 공간 구 감산.
//  dims: { size, yd, zd }  field: Float32Array
// ---------------------------------------------------------------------------
export function fillField(field, dims, segs, cuts) {
  const { size, yd, zd } = dims;

  for (const seg of segs) {
    const { ax, ay, az, bx, by, bz, lut, rscale, rMax, flatten } = seg;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz;
    const x0 = Math.max(1, Math.floor(Math.min(ax, bx) - rMax)), x1 = Math.min(size - 2, Math.ceil(Math.max(ax, bx) + rMax));
    const y0 = Math.max(1, Math.floor(Math.min(ay, by) - rMax)), y1 = Math.min(size - 2, Math.ceil(Math.max(ay, by) + rMax));
    const z0 = Math.max(1, Math.floor(Math.min(az, bz) - rMax)), z1 = Math.min(size - 2, Math.ceil(Math.max(az, bz) + rMax));
    const ux = flatten ? flatten.ux : 0, uy = flatten ? flatten.uy : 0, uz = flatten ? flatten.uz : 0;
    const finv2m1 = flatten ? flatten.finv2m1 : 0;
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        let idx = z * zd + y * yd + x0;
        for (let x = x0; x <= x1; x++, idx++) {
          const px = x - ax, py = y - ay, pz = z - az;
          let t = len2 > 1e-10 ? (px * dx + py * dy + pz * dz) / len2 : 0;
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz;
          let d2 = qx * qx + qy * qy + qz * qz;
          if (flatten) {
            const s = qx * ux + qy * uy + qz * uz; // u 방향 성분
            d2 += s * s * finv2m1;                 // s²/f² + (d²−s²) 와 동치
          }
          // 프로파일 LUT 선형 보간 → 그리드 반지름
          const sc = t * LUT_MAX; let i = sc | 0; if (i > LUT_MAX - 1) i = LUT_MAX - 1;
          const r = lut[i] + (lut[i + 1] - lut[i]) * (sc - i);
          const R = r * rscale, R2 = R * R;
          if (d2 >= R2) continue;
          const g = 1 - d2 / R2;
          field[idx] += g * g * g; // Wyvill — 겹치면 자동 smooth blend
        }
      }
    }
  }

  // 컷(구 감산) — 가산 필드라 순서 무관, 음수 허용(MC 는 iso 교차만 본다).
  for (const c of cuts) {
    const { cx, cy, cz, Rc, strength } = c;
    const Rc2 = Rc * Rc;
    const x0 = Math.max(1, Math.floor(cx - Rc)), x1 = Math.min(size - 2, Math.ceil(cx + Rc));
    const y0 = Math.max(1, Math.floor(cy - Rc)), y1 = Math.min(size - 2, Math.ceil(cy + Rc));
    const z0 = Math.max(1, Math.floor(cz - Rc)), z1 = Math.min(size - 2, Math.ceil(cz + Rc));
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        let idx = z * zd + y * yd + x0;
        for (let x = x0; x <= x1; x++, idx++) {
          const ddx = x - cx, ddy = y - cy, ddz = z - cz;
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 >= Rc2) continue;
          const g = 1 - d2 / Rc2;
          field[idx] -= strength * g * g * g;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
//  buildSegs — ch(뼈 월드 최신) + 컴파일된 DNA → 그리드 공간 segs·cuts.
//  실시간(McFlesh.update)과 bake(fleshbake) 가 공유한다. gs = 월드m→그리드 배율.
//  breathMul: 그룹별 프레임 배율(F5, 기본 없음).
// ---------------------------------------------------------------------------
const _wa = new THREE.Vector3();
const _wb = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _dir = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();

export function buildSegs(ch, simpleName, gs, half, breathMul = null) {
  const compiled = ch.dnaCompiled;
  const segs = [], cuts = [];
  const offsetX = ch.slotX || 0;
  const seen = new Set(); // 리그 2벌 FBX 중복 세그먼트 방지
  const toGridX = wx => ((wx - offsetX) / HALF + 1) * half;
  const toGridY = wy => ((wy - CENTER_Y) / HALF + 1) * half;
  const toGridZ = wz => (wz / HALF + 1) * half;

  for (const b of ch.bones) {
    if (!b.parent?.isBone) continue;
    const key = simpleName(b.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const spec = compiled.resolve(key);
    if (!spec) continue; // r=0 (손가락 등) → 살 생략

    const a = b.parent.getWorldPosition(_wa);
    const c = b.getWorldPosition(_wb);
    const ax = toGridX(a.x), ay = toGridY(a.y), az = toGridZ(a.z);
    const bx = toGridX(c.x), by = toGridY(c.y), bz = toGridZ(c.z);

    // 세그먼트 축(그리드=월드와 방향 동일, 균등 스케일)
    _ax.set(bx - ax, by - ay, bz - az);
    const axLen = _ax.length();
    if (axLen > 1e-6) _ax.multiplyScalar(1 / axLen);

    const bMul = breathMul && spec.group ? (breathMul[spec.group] ?? 1) : 1;
    const rscale = BLEND * spec.blend * gs * bMul;

    // flatten — dir 을 현재 포즈로 회전 추적 후 축 직교화
    let flatten = null;
    let uSet = false;
    if (spec.flatten) {
      // dNow = qWorld · qBindWorld⁻¹ · dir
      b.getWorldQuaternion(_q);
      const qb = ch.bindWorldQ?.get(b);
      _dir.fromArray(spec.flatten.dir);
      if (qb) { _qb.copy(qb).invert(); _dir.applyQuaternion(_qb); }
      _dir.applyQuaternion(_q);
      // 축 직교화
      const dp = _dir.dot(_ax);
      _u.copy(_dir).addScaledVector(_ax, -dp);
      if (_u.length() >= 0.2) { // 퇴화 가드: 축과 거의 평행이면 이 프레임 flatten 생략
        _u.normalize();
        const f = spec.flatten.f;
        flatten = { ux: _u.x, uy: _u.y, uz: _u.z, finv2m1: 1 / (f * f) - 1 };
        uSet = true;
      }
    }

    segs.push({ ax, ay, az, bx, by, bz, lut: spec.lut, rscale, rMax: spec.rMax * rscale, flatten });

    // cut — 세그먼트 로컬 프레임(â, u, v)에서 오프셋 이동한 구를 감산
    if (spec.cuts.length) {
      // u: flatten u 재사용, 없으면 월드 +z 를 축 직교 투영(퇴화 시 +x)
      if (!uSet) {
        _u.set(0, 0, 1);
        const dp = _u.dot(_ax); _u.addScaledVector(_ax, -dp);
        if (_u.length() < 0.2) { _u.set(1, 0, 0); const d2 = _u.dot(_ax); _u.addScaledVector(_ax, -d2); }
        _u.normalize();
      }
      _v.crossVectors(_ax, _u); // â × u
      for (const cut of spec.cuts) {
        const t = cut.t;
        // 컷 중심(그리드) = lerp(a,b,t) + (offset·u + offset·v + offset·â)×gs
        const bcx = ax + (bx - ax) * t, bcy = ay + (by - ay) * t, bcz = az + (bz - az) * t;
        const o0 = cut.offset[0] * gs, o1 = cut.offset[1] * gs, o2 = cut.offset[2] * gs;
        cuts.push({
          cx: bcx + _u.x * o0 + _v.x * o1 + _ax.x * o2,
          cy: bcy + _u.y * o0 + _v.y * o1 + _ax.y * o2,
          cz: bcz + _u.z * o0 + _v.z * o1 + _ax.z * o2,
          Rc: BLEND * cut.r * gs,
          strength: cut.strength,
        });
      }
    }
  }
  return { segs, cuts };
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

  // ch: 캐릭터 상태(bones 월드 최신·dnaCompiled·slotX·bindWorldQ), simpleName: 이름 정규화.
  update(ch, simpleName, breathMul = null) {
    const mc = this.mc, size = mc.size, half = mc.halfsize, field = mc.field;
    mc.reset();
    const gs = half / HALF; // 월드 m → 그리드 단위 배율
    const { segs, cuts } = buildSegs(ch, simpleName, gs, half, breathMul);
    fillField(field, { size, yd: mc.yd, zd: mc.zd }, segs, cuts);
    mc.update(); // 마칭 큐브 → BufferGeometry 갱신
  }
}

// ============================================================================
//  mcflesh.js — 스켈레톤 → 캡슐 SDF → THREE.MarchingCubes 실시간 폴리곤화
//
//  뼈(parent→child)마다 캡슐 세그먼트 하나. 각 캡슐이 Wyvill 밀도
//  f(d) = (1 - d²/R²)³ (d<R) 를 필드에 "더하면" 겹치는 곳이 자연히 부드럽게
//  붙는다(메타볼). isolation ≈ d=반지름 지점이 표면.
//
//  ── 살 게놈 연동 (genome-encoding-principles 이식) ──
//  세그먼트 반지름은 더 이상 하드코딩 RADII 가 아니라 **살 게놈**을 전개한 결과다
//  (src/fleshdna.js). 뼈 이름 → 프로파일 LUT(부위별 두께·형태 유전자 변조) 를 읽어
//  축 위치 t 의 반지름을 LUT 보간으로 얻는다. 위상(뼈)은 게놈 밖 고정, 살(반지름)만
//  게놈이 소유한다 — 채널 분리(CLAUDE.md · FLESH-PLAN §1). 필드 채우기(fillField)는
//  순수 함수로 분리해 Node 검증과 공유한다.
//  주: 이 실시간 SDF 경로는 원형 단면만 채운다(flatten 은 애니메이션 회전 추적이
//  필요 → warp/bake 경로 담당). 게놈의 flatten 유전자는 스탯·특징·워프가 소비한다.
// ============================================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { compileFlesh, defaultGenome } from './fleshdna.js';

const RES = 64;          // 필드 해상도 — 복셀 2.3/64 ≈ 3.6cm (떨림 완화)
const HALF = 1.15;       // 볼륨 반경(m) — 키 1.7m 캐릭터 + 팔 벌림 여유
const CENTER_Y = 0.9;    // 볼륨 중심 높이
const BLEND = 2.5;       // 블렌드 반경 = BLEND×살 반지름 — 클수록 필드가 완만 = 덜 떨림
const ISO = (1 - 1 / (BLEND * BLEND)) ** 3; // d=반지름 지점이 표면이 되는 값 (≈0.593)

// ── 순수 필드 채우기 (단일 진실 원천 — 실시간·bake·Node 검증 공유) ──────────
//  segs: [{ ax,ay,az, bx,by,bz, lut(Float32Array len N), rMaxG, len2 }] — 전부 그리드 공간.
//    rMaxG = LUT 최대 반지름 × BLEND × blend × gs (bbox 순회용, 보수적).
//  dims: { size, yd, zd }  field: Float32Array (호출자가 reset)
export function fillField(field, dims, segs) {
  const { size, yd, zd } = dims;
  for (const s of segs) {
    const { ax, ay, az, bx, by, bz, lut, rMaxG, len2 } = s;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const N1 = lut.length - 1;
    const x0 = Math.max(1, Math.floor(Math.min(ax, bx) - rMaxG)), x1 = Math.min(size - 2, Math.ceil(Math.max(ax, bx) + rMaxG));
    const y0 = Math.max(1, Math.floor(Math.min(ay, by) - rMaxG)), y1 = Math.min(size - 2, Math.ceil(Math.max(ay, by) + rMaxG));
    const z0 = Math.max(1, Math.floor(Math.min(az, bz) - rMaxG)), z1 = Math.min(size - 2, Math.ceil(Math.max(az, bz) + rMaxG));
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        let idx = z * zd + y * yd + x0;
        for (let x = x0; x <= x1; x++, idx++) {
          // 점→선분 거리² + t 위치의 LUT 보간 반지름
          const px = x - ax, py = y - ay, pz = z - az;
          let t = len2 > 1e-10 ? (px * dx + py * dy + pz * dz) / len2 : 0;
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz;
          const d2 = qx * qx + qy * qy + qz * qz;
          // LUT 선형 보간 → 살 반지름 × 필드 배율 (s.rScale 은 미리 곱해 lut 에 반영)
          const fs = t * N1, fi = fs | 0, R = (lut[fi] + (lut[fi + 1 > N1 ? N1 : fi + 1] - lut[fi]) * (fs - fi));
          const R2 = R * R;
          if (d2 >= R2 || R2 <= 0) continue;
          const g = 1 - d2 / R2;
          field[idx] += g * g * g; // Wyvill — 겹치면 자동 smooth blend
        }
      }
    }
  }
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
    this._fallback = compileFlesh(defaultGenome()); // ch.fleshPheno 없을 때 대비
  }

  setVisible(on) { this.mc.visible = !!on; }
  get visible() { return this.mc.visible; }

  // ch: 캐릭터 상태 { bones, slotX, fleshPheno }, simpleName: 이름 정규화 함수.
  // fleshPheno = compileFlesh(ch.fleshGenome) — 뼈 이름→세그먼트 LUT 평가기.
  update(ch, simpleName) {
    const bones = ch.bones, offsetX = ch.slotX || 0;
    const pheno = ch.fleshPheno || this._fallback;
    const mc = this.mc, size = mc.size, half = mc.halfsize, field = mc.field;
    mc.reset();
    const gs = half / HALF;              // 월드 m → 그리드 단위 배율
    const fieldScale = BLEND * gs;       // 살 반지름 → 필드 반경 배율 (blend 별도 곱)
    const seen = new Set();              // 리그 2벌 FBX 중복 세그먼트 방지
    const segs = [];
    for (const b of bones) {
      if (!b.parent?.isBone) continue;
      const key = simpleName(b.name);
      if (seen.has(key)) continue;
      seen.add(key);
      const seg = pheno.resolve(key);
      if (!seg) continue;               // r=0(손가락 등) → 살 생략
      // 월드 → 그리드 공간 (그리드 원점 = 볼륨 구석, 셀 크기 1)
      const a = b.parent.getWorldPosition(this._wa); a.x -= offsetX;
      const c = b.getWorldPosition(this._wb); c.x -= offsetX;
      const ax = (a.x / HALF + 1) * half, ay = ((a.y - CENTER_Y) / HALF + 1) * half, az = (a.z / HALF + 1) * half;
      const bx = (c.x / HALF + 1) * half, by = ((c.y - CENTER_Y) / HALF + 1) * half, bz = (c.z / HALF + 1) * half;
      // LUT 를 필드 반경 단위로 스케일한 사본 (fillField 는 곱셈 없이 소비)
      const bf = fieldScale * seg.blend;
      const lut = new Float32Array(seg.lut.length);
      for (let i = 0; i < lut.length; i++) lut[i] = seg.lut[i] * bf;
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      segs.push({ ax, ay, az, bx, by, bz, lut, rMaxG: seg.rMax * bf, len2: dx * dx + dy * dy + dz * dz });
    }
    fillField(field, { size, yd: mc.yd, zd: mc.zd }, segs);
    // 표면색은 게놈 L4 (표면 층) 에서 — 다른 층에 영향 없음
    const col = pheno.color;
    this.material.color.setRGB(col.r, col.g, col.b);
    mc.update(); // 마칭 큐브 → BufferGeometry 갱신
  }
}

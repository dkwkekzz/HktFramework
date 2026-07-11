// ============================================================================
//  mcflesh.js — 스켈레톤 → 캡슐 SDF → THREE.MarchingCubes 실시간 폴리곤화
//
//  뼈(parent→child)마다 캡슐 세그먼트 하나. 각 캡슐이 Wyvill 밀도
//  f(d) = (1 - d²/R²)³ (d<R, R = 2×반지름) 를 필드에 "더하면" 겹치는 곳이
//  자연히 부드럽게 붙는다(메타볼). isolation 0.42 ≈ d=반지름 지점이 표면.
//  매 프레임: reset → 세그먼트별 bbox 안 복셀만 채움 → update() 가 마칭 큐브로
//  삼각형 생성. v1 레이마칭과 달리 "진짜 메시"라 일반 라이팅/재질을 탄다.
// ============================================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

const RES = 64;          // 필드 해상도 — 복셀 2.2/64 ≈ 3.6cm (떨림 완화)
const HALF = 1.15;       // 볼륨 반경(m) — 키 1.7m 캐릭터 + 팔 벌림 여유
const CENTER_Y = 0.9;    // 볼륨 중심 높이
const BLEND = 2.5;       // 블렌드 반경 = BLEND×살 반지름 — 클수록 필드가 완만 = 덜 떨림
const ISO = (1 - 1 / (BLEND * BLEND)) ** 3; // d=반지름 지점이 표면이 되는 값 (≈0.593)

// 뼈 이름(simpleName) → 살 반지름(m). 위에서부터 첫 매칭.
const RADII = [
  [/thumb|index|middle|ring|pinky/, 0],      // 손가락: 이 해상도에선 생략
  [/end$/, 0.02],                            // 리프 본(정수리·발끝 등): 끝을 가늘게
  [/head/, 0.085], [/neck/, 0.045],
  [/hips/, 0.105], [/spine2/, 0.105], [/spine1/, 0.095], [/spine/, 0.09],
  [/shoulder/, 0.05], [/forearm/, 0.04], [/arm/, 0.048], [/hand/, 0.035],
  [/upleg/, 0.075], [/leg/, 0.055], [/foot/, 0.04], [/toe/, 0.03],
];
const radiusFor = name => {
  for (const [re, r] of RADII) if (re.test(name)) return r;
  return 0.04;
};

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
  }

  setVisible(on) { this.mc.visible = !!on; }
  get visible() { return this.mc.visible; }

  // bones: THREE.Bone[] (월드 변환 최신 상태), simpleName: 이름 정규화 함수,
  // offsetX: 선택 캐릭터의 슬롯 x — 볼륨은 원점 중심이라 뼈 월드 x 에서 빼 정렬한다.
  update(bones, simpleName, offsetX = 0) {
    const mc = this.mc, size = mc.size, half = mc.halfsize, field = mc.field;
    mc.reset();
    const gs = half / HALF; // 월드 m → 그리드 단위 배율
    const seen = new Set(); // 리그 2벌 FBX(예: samba) 중복 세그먼트 방지
    for (const b of bones) {
      if (!b.parent?.isBone) continue;
      const key = simpleName(b.name);
      if (seen.has(key)) continue;
      seen.add(key);
      const rb = radiusFor(key);
      if (!rb) continue;
      const ra = radiusFor(simpleName(b.parent.name)) || rb; // 테이퍼: 부모→자신 반지름 보간
      // 월드 → 그리드 공간 (그리드 원점 = 볼륨 구석, 셀 크기 1)
      const a = b.parent.getWorldPosition(this._wa); a.x -= offsetX;
      const c = b.getWorldPosition(this._wb); c.x -= offsetX;
      const ax = (a.x / HALF + 1) * half, ay = ((a.y - CENTER_Y) / HALF + 1) * half, az = (a.z / HALF + 1) * half;
      const bx = (c.x / HALF + 1) * half, by = ((c.y - CENTER_Y) / HALF + 1) * half, bz = (c.z / HALF + 1) * half;
      const Ra = ra * BLEND * gs, Rb = rb * BLEND * gs;
      const Rmax = Math.max(Ra, Rb);
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const len2 = dx * dx + dy * dy + dz * dz;
      // 세그먼트 bbox + Rmax 만 순회 (전체 필드 대비 수백 배 절약)
      const x0 = Math.max(1, Math.floor(Math.min(ax, bx) - Rmax)), x1 = Math.min(size - 2, Math.ceil(Math.max(ax, bx) + Rmax));
      const y0 = Math.max(1, Math.floor(Math.min(ay, by) - Rmax)), y1 = Math.min(size - 2, Math.ceil(Math.max(ay, by) + Rmax));
      const z0 = Math.max(1, Math.floor(Math.min(az, bz) - Rmax)), z1 = Math.min(size - 2, Math.ceil(Math.max(az, bz) + Rmax));
      for (let z = z0; z <= z1; z++) {
        for (let y = y0; y <= y1; y++) {
          let idx = z * mc.zd + y * mc.yd + x0;
          for (let x = x0; x <= x1; x++, idx++) {
            // 점→선분 거리² + t 위치의 보간 반지름
            const px = x - ax, py = y - ay, pz = z - az;
            let t = len2 > 1e-10 ? (px * dx + py * dy + pz * dz) / len2 : 0;
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz;
            const d2 = qx * qx + qy * qy + qz * qz;
            const R = Ra + (Rb - Ra) * t, R2 = R * R;
            if (d2 >= R2) continue;
            const g = 1 - d2 / R2;
            field[idx] += g * g * g; // Wyvill — 겹치면 자동 smooth blend
          }
        }
      }
    }
    mc.update(); // 마칭 큐브 → BufferGeometry 갱신
  }
}

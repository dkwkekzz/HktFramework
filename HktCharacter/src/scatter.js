// ============================================================================
//  scatter.js — 환경 스캐터 렌더. scatterLayout.js 가 계산한 배치를
//  타입별 InstancedMesh 로 세운다 (정적 — 빌드 시 1회 행렬 기록, 프레임 비용 0).
//
//  요소는 전부 절차 지오메트리(에셋 불필요): 잔디 다발(원뿔 3개 머지),
//  바위(납작한 정이십면체), 발광 수정(길쭉한 정팔면체), 나무(원기둥+원뿔 2단).
//  지오메트리·재질은 생성자에서 1회 생성해 공유하고, rebuild 는 InstancedMesh
//  만 교체한다.
// ============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildScatterLayout } from './scatterLayout.js';

// 잔디 다발 — 살짝 기운 원뿔 3개를 바닥 기준(y=0)으로 머지
function makeTuftGeo() {
  const blades = [];
  const spec = [ // [반지름, 높이, x오프셋, z오프셋, 기울임(rad), yaw(rad)]
    [0.030, 0.26, 0, 0, 0.22, 0],
    [0.026, 0.20, 0.035, 0.01, -0.30, 2.1],
    [0.026, 0.17, -0.03, -0.02, 0.12, 4.2],
  ];
  for (const [rad, h, ox, oz, tilt, yaw] of spec) {
    const g = new THREE.ConeGeometry(rad, h, 5);
    g.translate(0, h / 2, 0);
    g.rotateZ(tilt);
    g.rotateY(yaw);
    g.translate(ox, 0, oz);
    blades.push(g);
  }
  return mergeGeometries(blades);
}

function makeTreeGeos() {
  const trunk = new THREE.CylinderGeometry(0.05, 0.09, 0.9, 6);
  trunk.translate(0, 0.45, 0);
  const c1 = new THREE.ConeGeometry(0.55, 1.15, 7);
  c1.translate(0, 1.28, 0);
  const c2 = new THREE.ConeGeometry(0.38, 0.85, 7);
  c2.translate(0, 1.95, 0);
  return { trunk, canopy: mergeGeometries([c1, c2]) };
}

export class EnvScatter {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'envScatter';
    scene.add(this.group);
    this.mode = 'rmt'; // 'rmt' | 'uniform' | 'off'
    this.seed = 1;

    const tree = makeTreeGeos();
    this.geo = {
      grass: makeTuftGeo(),
      rock: new THREE.IcosahedronGeometry(0.17, 0).scale(1, 0.6, 0.82).translate(0, 0.075, 0),
      crystal: new THREE.OctahedronGeometry(0.1, 0).scale(0.55, 1.9, 0.55).translate(0, 0.13, 0),
      trunk: tree.trunk,
      canopy: tree.canopy,
    };
    this.mat = {
      grass: new THREE.MeshStandardMaterial({ color: 0x44603c, roughness: 1 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x4a5260, roughness: 0.95 }),
      crystal: new THREE.MeshStandardMaterial({
        color: 0x7fb4ff, emissive: 0x2563eb, emissiveIntensity: 1.1, roughness: 0.3,
      }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x4d3d2c, roughness: 1 }),
      canopy: new THREE.MeshStandardMaterial({ color: 0x2c4a34, roughness: 1 }),
    };
  }

  rebuild() {
    // InstancedMesh 만 교체 — 지오메트리/재질은 공유라 dispose 하지 않는다
    for (const m of [...this.group.children]) { this.group.remove(m); m.dispose(); }
    if (this.mode === 'off') return;

    const byType = {};
    for (const it of buildScatterLayout(this.mode, this.seed))
      (byType[it.type] ??= []).push(it);

    // 잔디: 폭은 √s 로 완만하게, 높이는 s 그대로 — 크기 다양성이 실루엣에 남게
    this._inst('grass', byType.grass, it => [Math.sqrt(it.s), it.s, Math.sqrt(it.s)], 0.10);
    this._inst('rock', byType.rock, it => [it.s * (1 + it.tint * 0.3), it.s, it.s * (1 - it.tint * 0.3)], 0.06);
    this._inst('crystal', byType.crystal, it => [it.s, it.s, it.s], 0, 0.18);
    this._inst('trunk', byType.tree, it => [it.s, it.s, it.s]);
    this._inst('canopy', byType.tree, it => [it.s, it.s, it.s], 0.05);
  }

  // list 의 각 항목을 scaleOf(it) 배율로 인스턴스화. tintAmp: 명도 변주, tiltAmp: 기울임(rad)
  _inst(key, list, scaleOf, tintAmp = 0, tiltAmp = 0) {
    if (!list?.length) return;
    const mesh = new THREE.InstancedMesh(this.geo[key], this.mat[key], list.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
    list.forEach((it, i) => {
      e.set(tiltAmp * it.tint * 2, it.yaw, tiltAmp * (Math.abs(it.tint) - 0.25) * 2);
      q.setFromEuler(e);
      const [sx, sy, sz] = scaleOf(it);
      M.compose(v.set(it.x, 0, it.z), q, sc.set(sx, sy, sz));
      mesh.setMatrixAt(i, M);
      // instanceColor 는 material.color 에 곱해진다 — 1 근처 명도 변주만 준다
      if (tintAmp) mesh.setColorAt(i, c.setScalar(1 + it.tint * tintAmp * 2));
    });
    if (tintAmp && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false; // 인스턴스 전체 bbox 미계산 상태로 컬링되는 것 방지
    this.group.add(mesh);
  }
}

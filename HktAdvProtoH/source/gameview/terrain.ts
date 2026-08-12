// 3D 지형 — 완만한 하이트필드 (표현 전용 무대, World 의미 없음).
// height() 는 스프라이트를 지형 표면에 얹기 위해 렌더러가 공유하는 표현 함수다.

import * as THREE from 'three';

export const TERRAIN_SIZE = 40; // 한 변 길이 (world 단위)
const SEGMENTS = 96;

// 결정적 완만 기복 — 게임 영역이 걷기 좋게 낮은 진폭
export function terrainHeight(x: number, z: number): number {
  return (
    0.55 * Math.sin(x * 0.32) +
    0.45 * Math.cos(z * 0.27) +
    0.3 * Math.sin((x + z) * 0.16) +
    0.18 * Math.cos(x * 0.7 - z * 0.5)
  );
}

export function buildTerrain(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2); // XZ 평면으로
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grassLow = new THREE.Color('#4e7a3a');
  const grassHigh = new THREE.Color('#7fae5a');
  const rock = new THREE.Color('#8a8578');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    // 높이에 따른 풀/바위 그라데이션
    const t = THREE.MathUtils.clamp((y + 1.2) / 2.6, 0, 1);
    const c = grassLow.clone().lerp(grassHigh, t);
    if (y > 1.05) c.lerp(rock, THREE.MathUtils.clamp((y - 1.05) / 0.5, 0, 0.7));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  return mesh;
}

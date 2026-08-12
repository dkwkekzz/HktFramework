// 3D Terrain — mining-field Scene 의 평탄한 야외 지형.
// 크기·색·그리드는 View 의 표현 선택이다 (Spec 은 scene 이름만 계약한다).

import * as THREE from 'three';

export const TERRAIN_SIZE = 40; // World.Bounds 와 일치하는 표현 크기

export function createTerrain(): THREE.Group {
  const group = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE),
    new THREE.MeshLambertMaterial({ color: 0x5e7c4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'terrain-ground';
  group.add(ground);

  const grid = new THREE.GridHelper(TERRAIN_SIZE, TERRAIN_SIZE, 0x4a6238, 0x4a6238);
  (grid.material as THREE.Material).opacity = 0.35;
  (grid.material as THREE.Material).transparent = true;
  group.add(grid);

  return group;
}
